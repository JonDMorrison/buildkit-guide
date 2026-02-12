import { ReactNode, useId } from "react";
import { Label } from "./ui/label";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  label: string;
  required?: boolean;
  helper?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}

export const FormField = ({
  label,
  required,
  helper,
  error,
  children,
  className,
}: FormFieldProps) => {
  const errorId = useId();

  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-base font-semibold">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      
      <div
        className={cn(
          "min-h-[52px]",
          error && "animate-shake border-l-2 border-l-destructive pl-2"
        )}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? errorId : undefined}
      >
        {children}
      </div>
      
      {helper && !error && (
        <p className="text-sm text-muted-foreground">{helper}</p>
      )}
      
      {error && (
        <p id={errorId} role="alert" className="text-sm text-destructive font-medium">{error}</p>
      )}
    </div>
  );
};
