import React from "react";
import * as Icons from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  iconName?: keyof typeof Icons;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  iconName = "Mail",
}) => {
  // Dynamically resolve icon from Lucide Icons package
  const IconComponent = Icons[iconName] as React.ComponentType<{ className?: string; size?: number }>;

  return (
    <div className="center-container card">
      {IconComponent && (
        <div className="empty-illustration">
          <IconComponent size={48} />
        </div>
      )}
      <h3 className="title-md" style={{ marginTop: "8px" }}>{title}</h3>
      <p className="body-sm" style={{ maxWidth: "320px", marginTop: "4px" }}>
        {description}
      </p>
    </div>
  );
};

export default EmptyState;
