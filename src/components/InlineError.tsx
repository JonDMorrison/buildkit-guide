import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

interface InlineErrorProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const InlineError = ({
  message = "Something went wrong",
  onRetry,
  className,
}: InlineErrorProps) => {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 animate-fade-in",
        className
      )}
      role="alert"
    >
      <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
      <p className="text-sm text-foreground flex-1">{message}</p>
      {onRetry && (
        <Button variant="ghost" size="xs" onClick={onRetry} className="gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" />
          Retry
        </Button>
      )}
    </div>
  );
};
