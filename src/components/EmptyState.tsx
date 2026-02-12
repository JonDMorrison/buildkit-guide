import { ReactNode } from "react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState = ({ 
  icon, 
  title, 
  description, 
  action, 
  className 
}: EmptyStateProps) => {
  return (
    <div role="status" aria-label={title} className={cn("flex flex-col items-center justify-center py-12 px-4 text-center", className)}>
      <div className="w-14 h-14 rounded-xl bg-surface-raised flex items-center justify-center mb-3 text-muted-foreground">
        {icon}
      </div>
      
      <h3 className="text-lg font-semibold text-foreground mb-1.5">{title}</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">{description}</p>
      
      {action && (
        <Button onClick={action.onClick} size="lg" className="min-h-[52px]">
          {action.label}
        </Button>
      )}
    </div>
  );
};
