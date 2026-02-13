import { useMemo } from "react";
import type { OrgScopeRow } from "@/hooks/useOrgScopeAccuracy";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BookOpen, Info } from "lucide-react";
import { formatNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface Props {
  rows: OrgScopeRow[];
  loading: boolean;
}

export const OrgScopeLearningPanel = ({ rows, loading }: Props) => {
  // Show top offenders (positive avg_delta_pct = actual > planned = under-estimated)
  const offenders = useMemo(
    () => rows.filter((r) => r.avg_delta_pct > 5).slice(0, 8),
    [rows]
  );

  if (loading) return <Skeleton className="h-48" />;
  if (!offenders.length) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          Scope Estimation Learning
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                Scope items that are consistently under-estimated across projects (last 12 weeks). Use these insights to improve future estimates.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Scope Item</TableHead>
              <TableHead className="text-right">Projects</TableHead>
              <TableHead className="text-right">Avg Over %</TableHead>
              <TableHead className="text-right">Total Planned</TableHead>
              <TableHead className="text-right">Total Actual</TableHead>
              <TableHead>Worst Project</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {offenders.map((r) => (
              <TableRow key={r.normalized_name}>
                <TableCell className="font-medium capitalize">{r.normalized_name}</TableCell>
                <TableCell className="text-right">
                  <Badge variant="secondary" className="text-xs">{r.project_count}</Badge>
                </TableCell>
                <TableCell className={cn(
                  "text-right tabular-nums font-medium",
                  r.avg_delta_pct > 0 ? "text-destructive" : "text-status-complete"
                )}>
                  +{r.avg_delta_pct.toFixed(0)}%
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(r.total_planned_hours)}h</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(r.total_actual_hours)}h</TableCell>
                <TableCell className="text-sm text-muted-foreground truncate max-w-[150px]">
                  {r.worst_project_name}
                  <span className="text-destructive ml-1">(+{r.worst_delta_pct.toFixed(0)}%)</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
