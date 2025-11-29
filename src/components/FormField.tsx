import { ReactNode } from "react";
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
  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-base font-semibold">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      
      <div className="min-h-[52px]">
        {children}
      </div>
      
      {helper && !error && (
        <p className="text-sm text-muted-foreground">{helper}</p>
      )}
      
      {error && (
        <p className="text-sm text-destructive font-medium">{error}</p>
      )}
    </div>
  );
};
