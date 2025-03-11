import React from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface LoadingProps {
  variant?: "spinner" | "dots" | "pulse";
  size?: "sm" | "md" | "lg";
  message?: string;
  className?: string;
}

const Loading: React.FC<LoadingProps> = ({
  variant = "spinner",
  size = "md",
  message = "Processing your export...",
  className,
}) => {
  const sizeClasses = {
    sm: {
      container: "p-4",
      spinner: "h-8 w-8",
      dots: "gap-1.5",
      dot: "h-2 w-2",
      text: "text-sm",
    },
    md: {
      container: "p-6",
      spinner: "h-12 w-12",
      dots: "gap-2",
      dot: "h-3 w-3",
      text: "text-base",
    },
    lg: {
      container: "p-8",
      spinner: "h-16 w-16",
      dots: "gap-3",
      dot: "h-4 w-4",
      text: "text-lg",
    },
  };

  const renderSpinner = () => (
    <Loader2
      className={cn("text-primary animate-spin", sizeClasses[size].spinner)}
    />
  );

  const renderDots = () => (
    <div className={cn("flex", sizeClasses[size].dots)}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn(
            "bg-primary rounded-full",
            sizeClasses[size].dot,
            "animate-bounce",
          )}
          style={{
            animationDelay: `${i * 0.15}s`,
            animationDuration: "0.8s",
          }}
        />
      ))}
    </div>
  );

  const renderPulse = () => (
    <div
      className={cn(
        "border-primary/30 border-t-primary rounded-full border-4",
        "animate-spin",
        sizeClasses[size].spinner,
      )}
    />
  );

  const renderLoader = () => {
    switch (variant) {
      case "dots":
        return renderDots();
      case "pulse":
        return renderPulse();
      case "spinner":
      default:
        return renderSpinner();
    }
  };

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center",
        "bg-background/80 backdrop-blur-sm",
        className,
      )}
    >
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-4",
          "bg-background/90 rounded-lg shadow-lg",
          "border-border border",
          sizeClasses[size].container,
        )}
      >
        {renderLoader()}

        {message && (
          <div className="text-center">
            <p
              className={cn(
                "text-foreground font-medium",
                sizeClasses[size].text,
              )}
            >
              {message}
            </p>
            <p
              className={cn(
                "text-muted-foreground mt-1",
                size === "lg" ? "text-sm" : "text-xs",
              )}
            >
              This may take a moment
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Loading;
