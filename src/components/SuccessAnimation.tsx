import { useEffect } from "react";
import { cn } from "@/lib/utils";

interface SuccessAnimationProps {
  message?: string;
  onComplete?: () => void;
  duration?: number;
  className?: string;
}

export const SuccessAnimation = ({
  message = "Success!",
  onComplete,
  duration = 2000,
  className,
}: SuccessAnimationProps) => {
  useEffect(() => {
    if (onComplete) {
      const timer = setTimeout(onComplete, duration);
      return () => clearTimeout(timer);
    }
  }, [onComplete, duration]);

  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 py-8", className)}>
      <div className="animate-success-pop w-16 h-16 rounded-full bg-status-complete flex items-center justify-center">
        <svg
          className="w-8 h-8 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>
      <p className="animate-fade-in text-lg font-semibold text-foreground">{message}</p>
    </div>
  );
};
