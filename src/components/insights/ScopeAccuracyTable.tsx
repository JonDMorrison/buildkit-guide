import { useMemo, useState } from "react";
import type { ScopeAccuracyRow } from "@/hooks/useScopeAccuracy";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, ChevronDown, ChevronUp, Info, Target } from "lucide-react";
import { formatNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface Props {
  rows: ScopeAccuracyRow[];
  loading: boolean;
  error?: string | null;
}

type SortKey = "scope_item_name" | "planned_hours" | "actual_hours" | "delta_pct";

export const ScopeAccuracyTable = ({ rows, loading, error }: Props) => {
  const [sortKey, setSortKey] = useState<SortKey>("delta_pct");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [rows, sortKey, sortAsc]);

  // Top 3 under-estimated (highest positive delta_pct = actual >> planned)
  const topUnderestimated = useMemo(
    () => rows.filter((r) => r.delta_pct > 0).sort((a, b) => b.delta_pct - a.delta_pct).slice(0, 3),
    [rows]
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortAsc
      ? <ChevronUp className="h-3 w-3 inline ml-0.5" />
      : <ChevronDown className="h-3 w-3 inline ml-0.5" />;
  };

  if (loading) return <Skeleton className="h-48" />;
  if (error) return (
    <Card><CardContent className="py-6 text-center text-destructive text-sm">{error}</CardContent></Card>
  );
  if (!rows.length) return null;

  return (
    <div className="space-y-4">
      {/* Top under-estimated callout */}
      {topUnderestimated.length > 0 && (
        <Alert className="border-status-warning/30 bg-status-warning/5">
          <Target className="h-4 w-4" />
          <AlertDescription>
            <span className="font-medium">Top under-estimated scope items: </span>
            {topUnderestimated.map((r, i) => (
              <span key={r.scope_item_id}>
                {i > 0 && ", "}
                <span className="font-medium">{r.scope_item_name}</span>
                {" "}
                <span className="text-destructive">+{r.delta_pct.toFixed(0)}%</span>
              </span>
            ))}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            Scope Accuracy
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Shows actual vs planned hours per scope item using task-linked time entries. Positive delta means actual exceeded planned.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("scope_item_name")}>
                  Scope Item <SortIcon col="scope_item_name" />
                </TableHead>
                <TableHead className="text-right">Tasks</TableHead>
                <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("planned_hours")}>
                  Planned <SortIcon col="planned_hours" />
                </TableHead>
                <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("actual_hours")}>
                  Actual <SortIcon col="actual_hours" />
                </TableHead>
                <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("delta_pct")}>
                  Delta % <SortIcon col="delta_pct" />
                </TableHead>
                <TableHead className="text-right">Trades</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((r) => {
                const isOver = r.delta_pct > 0;
                const isUnder = r.delta_pct < 0;
                return (
                  <TableRow key={r.scope_item_id}>
                    <TableCell className="font-medium">{r.scope_item_name}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary" className="text-xs">{r.task_count}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(r.planned_hours)}h</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(r.actual_hours)}h</TableCell>
                    <TableCell className={cn(
                      "text-right tabular-nums font-medium",
                      isOver && "text-destructive",
                      isUnder && "text-status-complete"
                    )}>
                      {r.delta_pct > 0 ? "+" : ""}{r.delta_pct.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right">
                      {r.trade_breakdown.length > 0 ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="text-[10px]">
                                {r.trade_breakdown.length} trade{r.trade_breakdown.length !== 1 ? "s" : ""}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <div className="space-y-1 text-xs">
                                {r.trade_breakdown.map((t, i) => (
                                  <div key={i} className="flex justify-between gap-3">
                                    <span>{t.trade_name}</span>
                                    <span className="tabular-nums">{formatNumber(t.hours)}h</span>
                                  </div>
                                ))}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
