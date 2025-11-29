import { ReactNode } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  count?: number;
  action?: {
    label: string;
    icon?: ReactNode;
    onClick: () => void;
  };
}

export const SectionHeader = ({ title, subtitle, count, action }: SectionHeaderProps) => {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold text-foreground">{title}</h2>
        {count !== undefined && (
          <Badge variant="secondary" className="text-sm">
            {count}
          </Badge>
        )}
      </div>
      {subtitle && !action && (
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      )}
      {action && (
        <Button onClick={action.onClick} size="icon" className="h-12 w-12">
          {action.icon}
        </Button>
      )}
    </div>
  );
};
