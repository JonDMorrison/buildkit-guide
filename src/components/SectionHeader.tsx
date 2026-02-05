import { ReactNode } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

interface ActionConfig {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  count?: number;
  action?: ActionConfig;
  secondaryAction?: ActionConfig;
}

export const SectionHeader = ({ title, subtitle, count, action, secondaryAction }: SectionHeaderProps) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
      <div className="flex items-center gap-3">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">{title}</h2>
        {count !== undefined && (
          <Badge variant="secondary" className="text-sm">
            {count}
          </Badge>
        )}
      </div>
      {subtitle && !action && (
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      )}
      {(action || secondaryAction) && (
        <TooltipProvider>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {secondaryAction && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={secondaryAction.onClick} size="icon" variant="outline" className="h-12 w-12">
                    {secondaryAction.icon}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{secondaryAction.label}</p>
                </TooltipContent>
              </Tooltip>
            )}
            {action && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={action.onClick} size="icon" className="h-12 w-12">
                    {action.icon}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{action.label}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </TooltipProvider>
      )}
    </div>
  );
};
