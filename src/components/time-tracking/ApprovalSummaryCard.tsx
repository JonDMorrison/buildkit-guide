import {
  Check,
  Edit,
  Clock,
  MapPinOff,
  RefreshCw,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ApprovalSummaryCardProps {
  className?: string;
  manualEntries?: number;
  autoClosedShifts?: number;
  locationExceptions?: number;
  offlineSyncs?: number;
  totalHours?: number;
  flaggedCount?: number;
}

export function ApprovalSummaryCard({
  className,
  manualEntries = 0,
  autoClosedShifts = 0,
  locationExceptions = 0,
  offlineSyncs = 0,
  totalHours,
  flaggedCount = 0,
}: ApprovalSummaryCardProps) {
  const items = [
    { count: manualEntries, label: 'manual entries', icon: Edit, show: manualEntries > 0 },
    { count: autoClosedShifts, label: 'auto-closed shifts', icon: Clock, show: autoClosedShifts > 0 },
    { count: locationExceptions, label: 'location exceptions', icon: MapPinOff, show: locationExceptions > 0 },
    { count: offlineSyncs, label: 'offline syncs', icon: RefreshCw, show: offlineSyncs > 0 },
  ].filter((item) => item.show);

  const hasAnyIssues = items.length > 0 || flaggedCount > 0;

  if (!hasAnyIssues && totalHours === undefined) {
    return null;
  }

  return (
    <Card className={cn('border-muted', className)}>
      <CardContent className="p-3">
        <div className="flex items-start gap-2 text-sm">
          <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            {totalHours !== undefined && (
              <p className="font-medium">
                {totalHours.toFixed(1)} total hours
              </p>
            )}
            {hasAnyIssues ? (
              <div className="flex flex-wrap gap-2 text-muted-foreground">
                {items.map((item, index) => (
                  <span key={index} className="flex items-center gap-1">
                    <item.icon className="h-3 w-3" />
                    {item.count} {item.label}
                    {index < items.length - 1 && <span className="text-border">•</span>}
                  </span>
                ))}
                {flaggedCount > 0 && (
                  <span className="flex items-center gap-1 text-destructive">
                    <AlertTriangle className="h-3 w-3" />
                    {flaggedCount} flagged
                  </span>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground flex items-center gap-1">
                <Check className="h-3 w-3 text-primary" />
                All entries normal
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
