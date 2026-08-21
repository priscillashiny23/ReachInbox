import React from "react";
import type { EmailStatus } from "../types";

interface EmailStatusBadgeProps {
  status: EmailStatus;
}

export const EmailStatusBadge: React.FC<EmailStatusBadgeProps> = ({ status }) => {
  let badgeClass = "badge";
  let label: string = status;

  switch (status) {
    case "SCHEDULED":
      badgeClass += " badge-scheduled";
      label = "Scheduled";
      break;
    case "PROCESSING":
      badgeClass += " badge-processing";
      label = "Processing";
      break;
    case "SENT":
      badgeClass += " badge-sent";
      label = "Sent";
      break;
    case "FAILED":
      badgeClass += " badge-failed";
      label = "Failed";
      break;
  }

  return <span className={badgeClass}>{label}</span>;
};

export default EmailStatusBadge;
