import { cn } from "@/lib/utils";
import { IssueRow, type SystemIssue } from "./IssueRow";

interface SeveritySectionProps {
  label: string;
  issues: SystemIssue[];
  className?: string;
}

export function SeveritySection({ label, issues, className }: SeveritySectionProps) {
  if (issues.length === 0) return null;

  return (
    <div className={cn("space-y-0.5", className)}>
      <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {issues.map(issue => (
        <IssueRow key={issue.id} issue={issue} />
      ))}
    </div>
  );
}
