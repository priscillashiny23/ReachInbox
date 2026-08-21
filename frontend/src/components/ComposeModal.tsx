import React, { useState, useRef } from "react";
import { 
  Upload, AlertCircle, ArrowLeft, 
  Paperclip, Clock, Bold, Italic, Underline, AlignLeft, 
  AlignCenter, AlignRight, List, Quote, Undo2, Redo2 
} from "lucide-react";
import apiService from "../services/api";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ComposeModalProps {
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onRefresh: () => void;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  onClose,
  onSuccess,
  onError,
  onRefresh,
}) => {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [typedRecipient, setTypedRecipient] = useState("");
  
  // Default scheduling startTime is 2 minutes in the future
  const defaultStartTime = new Date(Date.now() + 120000);
  const tzOffset = defaultStartTime.getTimezoneOffset() * 60000;
  const localISOTime = new Date(defaultStartTime.getTime() - tzOffset).toISOString().slice(0, 16);
  
  const [startTime, setStartTime] = useState(localISOTime);
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(10);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showSendLater, setShowSendLater] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const [attachments, setAttachments] = useState<{ filename: string; content: string; contentType: string }[]>([]);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        const base64Data = result.split(",")[1];
        setAttachments((prev) => [
          ...prev,
          {
            filename: file.name,
            content: base64Data,
            contentType: file.type || "application/octet-stream"
          }
        ]);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEditorInput = () => {
    if (editorRef.current) {
      setBody(editorRef.current.innerHTML);
    }
  };

  const execFormatting = (command: string, value: string = "") => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
    document.execCommand(command, false, value);
    handleEditorInput();
  };

  /**
   * Parse uploaded lead CSV/TXT files
   */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValidationError(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) {
          setValidationError("The uploaded file is empty.");
          return;
        }

        const rawEntries = text.split(/[\s,;\t\r\n]+/);
        const parsedEmails: string[] = [];
        let invalidCount = 0;

        for (const entry of rawEntries) {
          const cleaned = entry.trim();
          if (!cleaned) continue;

          if (
            cleaned.toLowerCase() === "email" || 
            cleaned.toLowerCase() === "emails" || 
            cleaned.toLowerCase() === "recipient"
          ) {
            continue;
          }

          if (EMAIL_REGEX.test(cleaned)) {
            parsedEmails.push(cleaned.toLowerCase());
          } else {
            if (cleaned.includes("@") || cleaned.includes(".")) {
              invalidCount++;
            }
          }
        }

        if (parsedEmails.length === 0) {
          setValidationError("No valid email addresses were found in the file.");
          setRecipients([]);
          return;
        }

        const uniqueEmails = Array.from(new Set(parsedEmails));
        setRecipients(uniqueEmails);
      } catch (err) {
        setValidationError("Failed to parse the lead file. Please check its format.");
      }
    };

    reader.onerror = () => {
      setValidationError("Error reading file.");
    };

    reader.readAsText(file);
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleRecipientInputBlurOrComma = (val: string) => {
    if (!val.trim()) return;
    const emails = val
      .split(/[\s,;]+/)
      .map(e => e.trim().toLowerCase())
      .filter(e => EMAIL_REGEX.test(e));
    if (emails.length > 0) {
      setRecipients(prev => Array.from(new Set([...prev, ...emails])));
      setTypedRecipient("");
    }
  };

  const selectPresetTime = (preset: "tomorrow" | "tomorrow-10" | "tomorrow-11" | "tomorrow-3") => {
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    if (preset === "tomorrow") {
      target.setHours(now.getHours(), now.getMinutes());
    } else if (preset === "tomorrow-10") {
      target.setHours(10, 0, 0, 0);
    } else if (preset === "tomorrow-11") {
      target.setHours(11, 0, 0, 0);
    } else if (preset === "tomorrow-3") {
      target.setHours(15, 0, 0, 0);
    }
    const offset = target.getTimezoneOffset() * 60000;
    const localISO = new Date(target.getTime() - offset).toISOString().slice(0, 16);
    setStartTime(localISO);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Finalize typing recipient input if any remains
    if (typedRecipient.trim()) {
      handleRecipientInputBlurOrComma(typedRecipient);
    }

    // Validation checks
    const finalRecipients = recipients.length > 0 
      ? recipients 
      : typedRecipient.trim() && EMAIL_REGEX.test(typedRecipient.trim().toLowerCase())
        ? [typedRecipient.trim().toLowerCase()]
        : [];

    if (!subject.trim()) {
      setValidationError("Subject is required.");
      return;
    }
    if (!body.trim()) {
      setValidationError("Email body is required.");
      return;
    }
    if (finalRecipients.length === 0) {
      setValidationError("Please enter or upload at least one valid recipient.");
      return;
    }
    if (!startTime) {
      setValidationError("Please select a scheduling start time.");
      return;
    }

    const selectedTime = new Date(startTime);
    if (selectedTime.getTime() < Date.now() - 5000) {
      setValidationError("Start time cannot be in the past.");
      return;
    }

    if (delaySeconds < 0) {
      setValidationError("Delay between emails cannot be negative.");
      return;
    }

    if (hourlyLimit <= 0) {
      setValidationError("Hourly rate limit must be at least 1.");
      return;
    }

    setIsSubmitting(true);

    try {
      await apiService.scheduleEmails({
        subject,
        body,
        recipients: finalRecipients,
        startTime: selectedTime.toISOString(),
        delayBetweenEmailsMs: delaySeconds * 1000,
        hourlyLimit,
        attachments,
      });

      onSuccess(`Successfully scheduled ${finalRecipients.length} emails!`);
      onRefresh();
      onClose();
    } catch (err: any) {
      console.error(err);
      const msg = err.message || "Failed to schedule emails. Please try again.";
      setValidationError(msg);
      onError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="compose-window">
      {/* Top Composing Actions Header bar */}
      <header className="compose-header">
        <div className="compose-header-left">
          <ArrowLeft onClick={onClose} style={{ cursor: "pointer", color: "var(--text-primary)" }} size={20} />
          <span>Compose New Email</span>
        </div>

        <div className="compose-header-right" style={{ display: "flex", alignItems: "center", gap: "16px", position: "relative" }}>
          {validationError && (
            <span style={{ color: "var(--color-failed-text)", fontSize: "0.8rem", display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <AlertCircle size={14} /> {validationError}
            </span>
          )}
          
          <input
            type="file"
            ref={attachmentInputRef}
            style={{ display: "none" }}
            multiple
            onChange={handleAttachmentChange}
          />

          <button 
            type="button" 
            className="btn-text-icon" 
            title="Attach file"
            onClick={() => attachmentInputRef.current?.click()}
            style={{ padding: "6px" }}
          >
            <Paperclip size={18} />
          </button>

          <button 
            type="button" 
            className="btn-text-icon" 
            title="Send Later"
            onClick={() => setShowSendLater(!showSendLater)}
            style={{ padding: "6px", color: showSendLater ? "var(--color-primary)" : "var(--text-secondary)" }}
          >
            <Clock size={18} />
          </button>

          <button 
            type="button" 
            className="btn btn-outline-green" 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            style={{ padding: "6px 20px" }}
          >
            {isSubmitting ? "Sending..." : "Send later"}
          </button>

          {/* Send Later Popover dropdown menu */}
          {showSendLater && (
            <div className="send-later-popover" style={{ top: "48px", right: "0" }}>
              <div className="popover-title">Send Later</div>
              <div className="form-group" style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label className="body-sm" style={{ fontWeight: 500, color: "var(--text-secondary)" }}>Pick date & time</label>
                <input 
                  type="datetime-local" 
                  className="login-input" 
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  style={{ fontSize: "0.8rem", padding: "8px 12px" }}
                />
              </div>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "6px" }}>
                <div className="suggested-time-item" onClick={() => { selectPresetTime("tomorrow"); setShowSendLater(false); }}>
                  Tomorrow
                </div>
                <div className="suggested-time-item" onClick={() => { selectPresetTime("tomorrow-10"); setShowSendLater(false); }}>
                  Tomorrow, 10:00 AM
                </div>
                <div className="suggested-time-item" onClick={() => { selectPresetTime("tomorrow-11"); setShowSendLater(false); }}>
                  Tomorrow, 11:00 AM
                </div>
                <div className="suggested-time-item" onClick={() => { selectPresetTime("tomorrow-3"); setShowSendLater(false); }}>
                  Tomorrow, 3:00 PM
                </div>
              </div>
              
              <div className="popover-footer">
                <button 
                  type="button" 
                  className="btn" 
                  onClick={() => setShowSendLater(false)} 
                  style={{ fontSize: "0.8rem", padding: "4px 8px", color: "var(--text-secondary)", border: "none" }}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-outline-green" 
                  onClick={() => setShowSendLater(false)} 
                  style={{ fontSize: "0.8rem", padding: "4px 12px" }}
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Composing Recipient/Scheduling parameter metadata list */}
      <div className="compose-fields-grid">
        <div className="compose-field-row">
          <span className="compose-field-label">From</span>
          <select className="compose-field-select" disabled>
            <option>sender@example.com</option>
          </select>
        </div>

        <div className="compose-field-row">
          <span className="compose-field-label">To</span>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <input 
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              accept=".csv,.txt"
              onChange={handleFileUpload}
            />

            <div style={{ display: "flex", gap: "10px", alignItems: "center", width: "100%" }}>
              <div className="recipient-chips-container" style={{ flexGrow: 1 }}>
                {recipients.map((r, idx) => (
                  <span key={idx} className="recipient-chip">
                    <span>{r}</span>
                    <button 
                      type="button" 
                      onClick={() => setRecipients(prev => prev.filter((_, i) => i !== idx))}
                      style={{ 
                        border: "none", 
                        background: "transparent", 
                        color: "var(--color-primary)", 
                        cursor: "pointer", 
                        marginLeft: "6px", 
                        fontSize: "0.95rem", 
                        lineHeight: 1,
                        fontWeight: "bold",
                        display: "inline-flex",
                        alignItems: "center"
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}

                <input
                  type="text"
                  className="compose-field-input-naked"
                  placeholder={recipients.length === 0 ? "recipient@example.com (press Enter or comma to add)" : "add more..."}
                  style={{ 
                    flexGrow: 1, 
                    border: "none", 
                    background: "transparent", 
                    outline: "none",
                    fontSize: "0.9rem",
                    color: "var(--text-primary)",
                    padding: "4px 0",
                    minWidth: "150px"
                  }}
                  value={typedRecipient}
                  onChange={(e) => setTypedRecipient(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      handleRecipientInputBlurOrComma(typedRecipient);
                    }
                  }}
                  onBlur={() => handleRecipientInputBlurOrComma(typedRecipient)}
                  disabled={isSubmitting}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                <button type="button" className="btn-upload-list" onClick={triggerFileSelect}>
                  <Upload size={13} />
                  Upload List
                </button>
                {recipients.length > 0 && (
                  <button 
                    type="button" 
                    className="btn-upload-list" 
                    onClick={() => { setRecipients([]); }}
                    style={{ color: "var(--color-failed-text)" }}
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {recipients.length > 0 && (
              <div style={{ paddingLeft: "4px", marginTop: "2px" }}>
                <span className="body-sm" style={{ color: "var(--color-primary)", fontWeight: 600 }}>
                  ({recipients.length} leads loaded)
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="compose-field-row">
          <span className="compose-field-label">Subject</span>
          <input
            type="text"
            className="compose-field-input"
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            disabled={isSubmitting}
          />
        </div>
        <div className="compose-field-row" style={{ display: "flex", gap: "24px", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%" }}>
            <span className="compose-field-label" style={{ width: "140px", flexShrink: 0 }}>Delay between 2 emails</span>
            <input
              type="number"
              className="compose-field-input"
              style={{ width: "70px", textAlign: "center" }}
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(parseInt(e.target.value, 10) || 0)}
              min="0"
              required
              disabled={isSubmitting}
            />
            
            <span className="compose-field-label" style={{ width: "auto", marginLeft: "24px", flexShrink: 0 }}>Hourly Limit</span>
            <input
              type="number"
              className="compose-field-input"
              style={{ width: "70px", textAlign: "center" }}
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10) || 1)}
              min="1"
              required
              disabled={isSubmitting}
            />
          </div>
        </div>
      </div>

      {attachments.length > 0 && (
        <div style={{ padding: "8px 24px", display: "flex", flexWrap: "wrap", gap: "8px", borderBottom: "1px solid var(--border-light)", backgroundColor: "#ffffff" }}>
          {attachments.map((file, idx) => (
            <div 
              key={idx} 
              style={{ 
                display: "inline-flex", 
                alignItems: "center", 
                gap: "8px", 
                padding: "4px 10px", 
                backgroundColor: "var(--bg-sidebar)", 
                border: "1px solid var(--border-medium)", 
                borderRadius: "var(--radius-md)",
                fontSize: "0.8rem"
              }}
            >
              <span>📎 {file.filename}</span>
              <button 
                type="button" 
                onClick={() => removeAttachment(idx)}
                style={{ 
                  background: "none", 
                  border: "none", 
                  color: "var(--color-failed-text)", 
                  cursor: "pointer", 
                  padding: "2px",
                  display: "inline-flex",
                  alignItems: "center",
                  fontWeight: "bold"
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Editor rich text styling bar */}
      <div className="editor-toolbar">
        <button type="button" className="editor-toolbar-btn" title="Undo" onClick={() => execFormatting('undo')}><Undo2 size={15} /></button>
        <button type="button" className="editor-toolbar-btn" title="Redo" onClick={() => execFormatting('redo')}><Redo2 size={15} /></button>
        <div style={{ width: "1px", height: "18px", backgroundColor: "var(--border-medium)", margin: "0 6px" }}></div>
        <button type="button" className="editor-toolbar-btn" style={{ fontWeight: "bold" }} title="Bold" onClick={() => execFormatting('bold')}><Bold size={15} /></button>
        <button type="button" className="editor-toolbar-btn" style={{ fontStyle: "italic" }} title="Italic" onClick={() => execFormatting('italic')}><Italic size={15} /></button>
        <button type="button" className="editor-toolbar-btn" style={{ textDecoration: "underline" }} title="Underline" onClick={() => execFormatting('underline')}><Underline size={15} /></button>
        <div style={{ width: "1px", height: "18px", backgroundColor: "var(--border-medium)", margin: "0 6px" }}></div>
        <button type="button" className="editor-toolbar-btn" title="Align Left" onClick={() => execFormatting('justifyLeft')}><AlignLeft size={15} /></button>
        <button type="button" className="editor-toolbar-btn" title="Align Center" onClick={() => execFormatting('justifyCenter')}><AlignCenter size={15} /></button>
        <button type="button" className="editor-toolbar-btn" title="Align Right" onClick={() => execFormatting('justifyRight')}><AlignRight size={15} /></button>
        <div style={{ width: "1px", height: "18px", backgroundColor: "var(--border-medium)", margin: "0 6px" }}></div>
        <button type="button" className="editor-toolbar-btn" title="Bulleted list" onClick={() => execFormatting('insertUnorderedList')}><List size={15} /></button>
        <button type="button" className="editor-toolbar-btn" title="Block Quote" onClick={() => execFormatting('formatBlock', 'blockquote')}><Quote size={15} /></button>
      </div>

      {/* ContentEditable reply area */}
      <div
        ref={editorRef}
        className="editor-textarea"
        contentEditable
        onInput={handleEditorInput}
        style={{ 
          minHeight: "180px", 
          outline: "none", 
          overflowY: "auto",
          backgroundColor: "#ffffff",
          color: "var(--text-primary)"
        }}
        {...({ placeholder: "Type Your Reply..." } as any)}
      />
    </div>
  );
};

export default ComposeModal;
