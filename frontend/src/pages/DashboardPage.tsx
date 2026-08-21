import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Clock, Send, Search, Filter, RefreshCw, ChevronDown,
  Star, Archive, Trash2, LogOut, ArrowLeft,
  User, Plus, MoreVertical, CheckCircle, AlertCircle
} from "lucide-react";
import apiService from "../services/api";
import type { Email, User as UserType } from "../types";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { EmptyState } from "../components/EmptyState";
import { ComposeModal } from "../components/ComposeModal";

const stripHtml = (htmlStr: string) => {
  try {
    const doc = new DOMParser().parseFromString(htmlStr, "text/html");
    return doc.body.textContent || "";
  } catch {
    return htmlStr;
  }
};

interface DashboardPageProps {
  user: UserType;
  onLogout: () => void;
}

interface Toast {
  id: string;
  type: "success" | "error";
  message: string;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<"scheduled" | "sent" | "archived">("scheduled");
  const [scheduledEmails, setScheduledEmails] = useState<Email[]>([]);
  const [sentEmails, setSentEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [sortBy, setSortBy] = useState<"date-desc" | "date-asc" | "subject-az">("date-desc");
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [emailToDelete, setEmailToDelete] = useState<Email | null>(null);

  /**
   * Generates a timed toast notification.
   */
  const showToast = useCallback((type: "success" | "error", message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  /**
   * Fetches scheduled and sent emails from backend.
   */
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const [scheduledRes, sentRes] = await Promise.all([
        apiService.getScheduledEmails(),
        apiService.getSentEmails(),
      ]);

      if (scheduledRes.success) setScheduledEmails(scheduledRes.emails);
      if (sentRes.success) setSentEmails(sentRes.emails);
    } catch (err: any) {
      console.error(err);
      showToast("error", err.message || "Failed to load emails from server.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  // Initial load and periodic polling every 5 seconds
  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Filter lists based on search query and sort criteria
  const filteredEmails = useMemo(() => {
    let list: Email[] = [];
    if (activeTab === "scheduled") {
      list = scheduledEmails.filter((e) => !e.isArchived);
    } else if (activeTab === "sent") {
      list = sentEmails.filter((e) => !e.isArchived);
    } else if (activeTab === "archived") {
      list = [...scheduledEmails, ...sentEmails].filter((e) => e.isArchived);
    }
    let result = [...list];

    // Filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((email) =>
        email.recipientEmail.toLowerCase().includes(query) ||
        (email.subject && email.subject.toLowerCase().includes(query)) ||
        (email.body && email.body.toLowerCase().includes(query))
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === "date-desc") {
        const timeA = a.sentAt ? new Date(a.sentAt).getTime() : new Date(a.scheduledAt).getTime();
        const timeB = b.sentAt ? new Date(b.sentAt).getTime() : new Date(b.scheduledAt).getTime();
        return timeB - timeA;
      } else if (sortBy === "date-asc") {
        const timeA = a.sentAt ? new Date(a.sentAt).getTime() : new Date(a.scheduledAt).getTime();
        const timeB = b.sentAt ? new Date(b.sentAt).getTime() : new Date(b.scheduledAt).getTime();
        return timeA - timeB;
      } else if (sortBy === "subject-az") {
        const subA = a.subject || "";
        const subB = b.subject || "";
        return subA.localeCompare(subB);
      }
      return 0;
    });

    return result;
  }, [activeTab, scheduledEmails, sentEmails, searchQuery, sortBy]);

  // Update selected email if it changes or list updates
  useEffect(() => {
    if (filteredEmails.length > 0) {
      // Keep selection if it still exists in the filtered list
      const stillExists = filteredEmails.find((e) => e.id === selectedEmail?.id);
      if (stillExists) {
        setSelectedEmail(stillExists);
      } else {
        setSelectedEmail(filteredEmails[0]);
      }
    } else {
      setSelectedEmail(null);
    }
  }, [filteredEmails, selectedEmail?.id]);

  const handleLogout = async () => {
    try {
      await apiService.logout();
      showToast("success", "Logged out successfully!");
      onLogout();
    } catch (err: any) {
      showToast("error", err.message || "Failed to log out.");
    }
  };

  const handleToggleStar = async () => {
    if (!selectedEmail) return;
    try {
      const updatedStarred = !selectedEmail.isStarred;
      await apiService.updateEmail(selectedEmail.id, { isStarred: updatedStarred });
      showToast("success", updatedStarred ? "Message starred." : "Message unstarred.");
      fetchData(true);
    } catch (err: any) {
      showToast("error", err.message || "Failed to update star status.");
    }
  };

  const handleToggleArchive = async () => {
    if (!selectedEmail) return;
    try {
      const updatedArchived = !selectedEmail.isArchived;
      await apiService.updateEmail(selectedEmail.id, { isArchived: updatedArchived });
      showToast("success", updatedArchived ? "Message archived." : "Message restored from archive.");
      setSelectedEmail(null);
      fetchData(true);
    } catch (err: any) {
      showToast("error", err.message || "Failed to archive message.");
    }
  };

  const handleDeleteClick = (email: Email) => {
    setEmailToDelete(email);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!emailToDelete) return;
    try {
      await apiService.deleteEmail(emailToDelete.id);
      showToast("success", "Email successfully deleted.");
      setSelectedEmail(null);
      setShowDeleteConfirm(false);
      setEmailToDelete(null);
      fetchData(true);
    } catch (err: any) {
      showToast("error", err.message || "Failed to delete email.");
      setShowDeleteConfirm(false);
      setEmailToDelete(null);
    }
  };

  const formatFigmaTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayName = days[d.getDay()];
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, "0");
    const seconds = d.getSeconds().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${dayName} ${hours}:${minutes}:${seconds} ${ampm}`;
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div>
          <div className="sidebar-logo">
            <Send size={20} style={{ color: "var(--color-primary)" }} />
            <span>Outbox</span>
          </div>

          <div
            className="user-profile-widget"
            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
            style={{ cursor: "pointer", position: "relative", marginBottom: "20px" }}
          >
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="user-avatar" />
            ) : (
              <div className="user-avatar">
                <User size={16} />
              </div>
            )}
            <div className="user-details">
              <span className="user-name">{user.name}</span>
              <span className="user-email">{user.email}</span>
            </div>
            <ChevronDown size={14} style={{ color: "var(--text-secondary)" }} />

            {showProfileDropdown && (
              <div
                className="send-later-popover"
                style={{
                  top: "48px",
                  left: "0",
                  width: "100%",
                  padding: "8px",
                  boxShadow: "var(--shadow-md)",
                  border: "1px solid var(--border-medium)"
                }}
              >
                <button
                  className="btn btn-secondary"
                  style={{ width: "100%", justifyContent: "flex-start", border: "none", gap: "8px", padding: "8px" }}
                  onClick={handleLogout}
                >
                  <LogOut size={14} style={{ color: "var(--color-failed-text)" }} />
                  <span>Disconnect</span>
                </button>
              </div>
            )}
          </div>

          <button
            className="btn btn-outline-green"
            style={{ width: "100%", padding: "12px", marginBottom: "20px" }}
            onClick={() => setShowCompose(true)}
          >
            <Plus size={16} />
            Compose
          </button>

          <span className="body-sm" style={{ fontWeight: 600, textTransform: "uppercase", paddingLeft: "12px", fontSize: "0.7rem", letterSpacing: "0.05em", color: "var(--text-muted)" }}>
            Core
          </span>

          <ul className="sidebar-menu">
            <li
              className={`sidebar-item ${activeTab === "scheduled" ? "active" : ""}`}
              onClick={() => setActiveTab("scheduled")}
            >
              <Clock size={16} />
              <span>Scheduled</span>
              <span style={{ marginLeft: "auto", fontSize: "0.8rem", fontWeight: 600 }}>
                {scheduledEmails.filter((e) => !e.isArchived).length}
              </span>
            </li>
            <li
              className={`sidebar-item ${activeTab === "sent" ? "active" : ""}`}
              onClick={() => setActiveTab("sent")}
            >
              <Send size={16} />
              <span>Sent</span>
              <span style={{ marginLeft: "auto", fontSize: "0.8rem", fontWeight: 600 }}>
                {sentEmails.filter((e) => !e.isArchived).length}
              </span>
            </li>
            <li
              className={`sidebar-item ${activeTab === "archived" ? "active" : ""}`}
              onClick={() => setActiveTab("archived")}
            >
              <Archive size={16} />
              <span>Archive</span>
              <span style={{ marginLeft: "auto", fontSize: "0.8rem", fontWeight: 600 }}>
                {[...scheduledEmails, ...sentEmails].filter((e) => e.isArchived).length}
              </span>
            </li>
          </ul>
        </div>

        <div className="sidebar-footer">
          <button
            className="btn btn-secondary"
            style={{ width: "100%", gap: "8px", color: "var(--text-secondary)", borderColor: "transparent" }}
            onClick={handleLogout}
          >
            <LogOut size={14} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="main-content">
        {/* Search header */}
        <header className="search-header">
          <div className="search-bar-container">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search"
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="search-actions" style={{ position: "relative" }}>
            <button
              className="btn-text-icon"
              title="Sort list"
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              style={{ color: showSortDropdown ? "var(--color-primary)" : "var(--text-secondary)" }}
            >
              <Filter size={16} />
            </button>

            {showSortDropdown && (
              <div
                className="send-later-popover"
                style={{
                  top: "36px",
                  right: "32px",
                  width: "160px",
                  boxShadow: "var(--shadow-md)",
                  border: "1px solid var(--border-medium)",
                  zIndex: 10
                }}
              >
                <div
                  className={`suggested-time-item ${sortBy === "date-desc" ? "active" : ""}`}
                  style={{ fontSize: "0.8rem", padding: "8px 12px", cursor: "pointer", fontWeight: sortBy === "date-desc" ? 600 : 400 }}
                  onClick={() => { setSortBy("date-desc"); setShowSortDropdown(false); }}
                >
                  Newest First
                </div>
                <div
                  className={`suggested-time-item ${sortBy === "date-asc" ? "active" : ""}`}
                  style={{ fontSize: "0.8rem", padding: "8px 12px", cursor: "pointer", fontWeight: sortBy === "date-asc" ? 600 : 400 }}
                  onClick={() => { setSortBy("date-asc"); setShowSortDropdown(false); }}
                >
                  Oldest First
                </div>
                <div
                  className={`suggested-time-item ${sortBy === "subject-az" ? "active" : ""}`}
                  style={{ fontSize: "0.8rem", padding: "8px 12px", cursor: "pointer", fontWeight: sortBy === "subject-az" ? 600 : 400 }}
                  onClick={() => { setSortBy("subject-az"); setShowSortDropdown(false); }}
                >
                  Subject (A-Z)
                </div>
              </div>
            )}

            <button
              className="btn-text-icon"
              title="Refresh list"
              onClick={() => fetchData(true)}
              disabled={refreshing}
            >
              <RefreshCw size={16} className={refreshing ? "spin-icon" : ""} />
            </button>
          </div>
        </header>

        {/* Master-Detail Split Pane */}
        <div className="content-split-container">
          {/* Left: Email List Panel */}
          <div className="list-pane">
            {loading ? (
              <div style={{ padding: "40px 0" }}>
                <LoadingSpinner label="Fetching campaign state..." size="lg" />
              </div>
            ) : filteredEmails.length === 0 ? (
              <EmptyState
                title={activeTab === "scheduled" ? "No scheduled emails" : "No sent history"}
                description={activeTab === "scheduled"
                  ? "Compose a campaign and choose a future send date."
                  : "Completed worker sends and logs will be recorded here."}
                iconName={activeTab === "scheduled" ? "Clock" : "Send"}
              />
            ) : (
              filteredEmails.map((email) => {
                const isSelected = selectedEmail?.id === email.id;
                return (
                  <div
                    key={email.id}
                    className={`email-list-row ${isSelected ? "selected" : ""}`}
                    onClick={() => setSelectedEmail(email)}
                  >
                    <div className="email-row-top">
                      <span className="email-row-recipient" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        To: {email.recipientEmail}
                        {email.isStarred && <Star size={12} fill="#eab308" color="#eab308" style={{ display: "inline" }} />}
                      </span>
                      {activeTab === "scheduled" ? (
                        <span className="email-row-badge-time scheduled">
                          <Clock size={11} /> {formatFigmaTime(email.scheduledAt)}
                        </span>
                      ) : (
                        <span className="email-row-badge-time sent">
                          Sent
                        </span>
                      )}
                    </div>
                    <div className="email-row-subject-line">
                      <span className="email-row-subject">{email.subject}</span>
                      <span className={`email-row-status-text ${email.status.toLowerCase()}`}>
                        - {email.status}
                      </span>
                    </div>
                    <div className="email-row-preview">
                      - {stripHtml(email.body)}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right: Email Detail View Panel */}
          {selectedEmail && (
            <div className="detail-pane">
              {/* Detail Header Action Bar */}
              <div className="detail-header">
                <div className="detail-subject-line" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <button
                    type="button"
                    className="btn-text-icon"
                    onClick={() => setSelectedEmail(null)}
                    title="Back to list"
                    style={{ padding: "4px" }}
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <span className="title-md">{selectedEmail.subject}</span>
                </div>
                <div className="detail-actions-right">
                  <button
                    className="btn-text-icon"
                    title={selectedEmail.isStarred ? "Unstar message" : "Star message"}
                    onClick={handleToggleStar}
                    style={{ color: selectedEmail.isStarred ? "#eab308" : "var(--text-secondary)" }}
                  >
                    <Star size={16} fill={selectedEmail.isStarred ? "#eab308" : "none"} />
                  </button>
                  <button
                    className="btn-text-icon"
                    title={selectedEmail.isArchived ? "Restore from Archive" : "Archive message"}
                    onClick={handleToggleArchive}
                    style={{ color: selectedEmail.isArchived ? "var(--color-primary)" : "var(--text-secondary)" }}
                  >
                    <Archive size={16} fill={selectedEmail.isArchived ? "var(--color-primary-light)" : "none"} />
                  </button>
                  <button
                    className="btn-text-icon"
                    title="Delete message"
                    style={{ color: "var(--color-failed-text)" }}
                    onClick={() => handleDeleteClick(selectedEmail)}
                  >
                    <Trash2 size={16} />
                  </button>
                  <button className="btn-text-icon" title="More options">
                    <MoreVertical size={16} />
                  </button>
                </div>
              </div>

              {/* Sender/Recipient Info Row */}
              <div className="detail-sender-row">
                <div className="detail-sender-avatar" style={{ backgroundColor: "var(--color-primary)", color: "#ffffff", fontWeight: 600 }}>
                  {selectedEmail.recipientEmail.slice(0, 1).toUpperCase()}
                </div>
                <div className="detail-sender-info">
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span className="detail-sender-name" style={{ fontWeight: 700 }}>
                      {selectedEmail.recipientEmail.split("@")[0]}
                    </span>
                    <span className="detail-sender-email" style={{ color: "var(--text-muted)" }}>
                      &lt;{selectedEmail.recipientEmail}&gt;
                    </span>
                  </div>
                  <span className="detail-sender-email" style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>to me ▾</span>
                </div>
                <div className="detail-time">
                  {formatFigmaTime(selectedEmail.scheduledAt)}
                </div>
              </div>

              {/* Email Content Body */}
              <div className="detail-body-container">
                {selectedEmail.body.includes("Extremely Exclusive") ? (
                  <div>
                    <p style={{ marginBottom: "16px" }}>Hey Oliver,</p>
                    <p style={{ marginBottom: "16px" }}>You've just RECEIVED something</p>

                    <div style={{
                      backgroundColor: "#fffdf0",
                      borderLeft: "4px solid #eab308",
                      padding: "16px",
                      margin: "16px 0",
                      borderRadius: "0 4px 4px 0"
                    }}>
                      <p style={{ fontWeight: 600, color: "#854d0e", marginBottom: "8px" }}>
                        ⚡ Extremely Exclusive—Only 4 Spots Worldwide Per Year | $25,000 investment ⚡
                      </p>
                      <p style={{ color: "#854d0e" }}>
                        ⚡ To explore securing your private transformation, simply reply right now with "FLY OUT FIX" .
                      </p>
                    </div>

                    <p style={{ marginBottom: "16px" }}>Your coach for world-class performance,</p>
                    <p style={{ marginBottom: "16px" }}>Grant</p>
                    <p style={{ color: "var(--text-muted)" }}>P.S. Always remember that you can develop world class technique! 🚀</p>
                  </div>
                ) : (
                  <div dangerouslySetInnerHTML={{ __html: selectedEmail.body }} />
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Campaign Composer Window */}
      {showCompose && (
        <ComposeModal
          onClose={() => setShowCompose(false)}
          onSuccess={(msg) => showToast("success", msg)}
          onError={(msg) => showToast("error", msg)}
          onRefresh={() => fetchData(true)}
        />
      )}

      {/* Custom Delete Confirmation Dialog Modal */}
      {showDeleteConfirm && emailToDelete && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: "400px", padding: "24px" }}>
            <h3 className="title-md" style={{ marginBottom: "12px" }}>Delete Email</h3>
            <p className="body-sm" style={{ color: "var(--text-secondary)", marginBottom: "24px", lineHeight: "1.5" }}>
              Are you sure you want to delete this email to <strong>{emailToDelete.recipientEmail}</strong>? This action cannot be undone and will cancel any scheduled send.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setShowDeleteConfirm(false); setEmailToDelete(null); }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                style={{
                  backgroundColor: "var(--color-failed-text)",
                  color: "#ffffff",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "var(--radius-md)",
                  cursor: "pointer",
                  fontWeight: 600
                }}
                onClick={handleConfirmDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast notifications */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type === "success" ? "toast-success" : "toast-error"}`}>
            {t.type === "success" ? (
              <CheckCircle size={18} style={{ color: "var(--color-sent-text)" }} />
            ) : (
              <AlertCircle size={18} style={{ color: "var(--color-failed-text)" }} />
            )}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DashboardPage;
