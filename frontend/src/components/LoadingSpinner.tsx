import React from "react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  label?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = "md",
  label = "Loading...",
}) => {
  const spinnerClass = size === "lg" ? "spinner spinner-lg" : "spinner";
  return (
    <div className="center-container">
      <div className={spinnerClass} />
      {label && <p className="body-md">{label}</p>}
    </div>
  );
};

export default LoadingSpinner;
