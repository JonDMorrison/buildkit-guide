import { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ListItemProps {
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  showChevron?: boolean;
  onClick?: () => void;
  className?: string;
}

export const ListItem = ({
  leading,
  title,
  subtitle,
  trailing,
  showChevron = true,
  onClick,
  className,
}: ListItemProps) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 p-4 rounded-lg border border-border bg-card min-h-[64px]",
        onClick && "cursor-pointer hover:border-primary/50 transition-colors",
        className
      )}
    >
      {leading && <div className="flex-shrink-0">{leading}</div>}
      
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-foreground truncate">{title}</h3>
        {subtitle && (
          <p className="text-sm text-muted-foreground truncate mt-0.5">{subtitle}</p>
        )}
      </div>
      
      {trailing && <div className="flex-shrink-0">{trailing}</div>}
      
      {showChevron && onClick && (
        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
      )}
    </div>
  );
};
