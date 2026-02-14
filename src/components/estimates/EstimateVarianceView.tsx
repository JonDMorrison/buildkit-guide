import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useEstimates } from "@/hooks/useEstimates";
import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import type { EstimateVarianceSummary } from "@/types/estimates";

interface Props {
  projectId: string;
  onClose: () => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(v);

const DeltaCell = ({ value }: { value: number }) => {
  const isNeg = value < 0;
  const isPos = value > 0;
  return (
    <span className={isPos ? "text-destructive font-medium" : isNeg ? "text-green-500 font-medium" : ""}>
      {isPos && "+"}{fmt(value)}
      {isPos && <TrendingUp className="inline h-3 w-3 ml-1" />}
      {isNeg && <TrendingDown className="inline h-3 w-3 ml-1" />}
    </span>
  );
};

export const EstimateVarianceView = ({ projectId, onClose }: Props) => {
  const { fetchVariance } = useEstimates(projectId);
  const [data, setData] = useState<EstimateVarianceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const result = await fetchVariance(projectId);
      setData(result);
      setLoading(false);
    };
    load();
  }, [projectId]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Estimate vs Actual — Variance Report</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : !data?.has_estimate ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No approved estimate found for this project.</p>
            <p className="text-sm mt-1">Create and approve an estimate to see the variance report.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Margin KPIs */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Contract Value</p>
                  <p className="text-lg font-bold">{fmt(data.margin.contract_value)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Actual Profit</p>
                  <p className={`text-lg font-bold ${data.margin.actual_profit < 0 ? 'text-destructive' : 'text-green-500'}`}>
                    {fmt(data.margin.actual_profit)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Actual Margin</p>
                  <p className={`text-lg font-bold ${data.margin.actual_margin_percent < 0 ? 'text-destructive' : ''}`}>
                    {data.margin.actual_margin_percent}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Planned: {data.planned.margin_percent}%
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Breakdown table */}
            <Card>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Planned</TableHead>
                      <TableHead className="text-right">Actual</TableHead>
                      <TableHead className="text-right">Delta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Labor Hours</TableCell>
                      <TableCell className="text-right">{data.planned.labor_hours}h</TableCell>
                      <TableCell className="text-right">{data.actual.labor_hours}h</TableCell>
                      <TableCell className="text-right">
                        <DeltaCell value={data.deltas.labor_hours} />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Labor Cost</TableCell>
                      <TableCell className="text-right">{fmt(data.planned.labor_bill_amount)}</TableCell>
                      <TableCell className="text-right">{fmt(data.actual.labor_cost)}</TableCell>
                      <TableCell className="text-right"><DeltaCell value={data.deltas.labor_cost} /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Materials</TableCell>
                      <TableCell className="text-right">{fmt(data.planned.material_cost)}</TableCell>
                      <TableCell className="text-right">{fmt(data.actual.material_cost)}</TableCell>
                      <TableCell className="text-right"><DeltaCell value={data.deltas.material} /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Machine</TableCell>
                      <TableCell className="text-right">{fmt(data.planned.machine_cost)}</TableCell>
                      <TableCell className="text-right">{fmt(data.actual.machine_cost)}</TableCell>
                      <TableCell className="text-right"><DeltaCell value={data.deltas.machine} /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Other</TableCell>
                      <TableCell className="text-right">{fmt(data.planned.other_cost)}</TableCell>
                      <TableCell className="text-right">{fmt(data.actual.other_cost)}</TableCell>
                      <TableCell className="text-right"><DeltaCell value={data.deltas.other} /></TableCell>
                    </TableRow>
                    {data.actual.unclassified_cost > 0 && (
                      <TableRow className="bg-yellow-500/5">
                        <TableCell className="font-medium">
                          Unclassified <Badge variant="outline" className="ml-2 text-xs">⚠</Badge>
                        </TableCell>
                        <TableCell className="text-right">—</TableCell>
                        <TableCell className="text-right">{fmt(data.actual.unclassified_cost)}</TableCell>
                        <TableCell className="text-right">—</TableCell>
                      </TableRow>
                    )}
                    <TableRow className="font-bold border-t-2">
                      <TableCell>Total Cost</TableCell>
                      <TableCell className="text-right">{fmt(data.planned.total_cost)}</TableCell>
                      <TableCell className="text-right">{fmt(data.actual.total_cost)}</TableCell>
                      <TableCell className="text-right"><DeltaCell value={data.deltas.total_cost} /></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </Card>

            {/* Diagnostics */}
            {(data.diagnostics.missing_cost_rates_hours > 0 ||
              data.diagnostics.unassigned_time_hours > 0 ||
              data.diagnostics.unclassified_receipts_amount > 0) && (
              <div className="space-y-2">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" /> Data Quality Warnings
                </p>
                {data.diagnostics.missing_cost_rates_hours > 0 && (
                  <Alert variant="default">
                    <AlertDescription>
                      <strong>{data.diagnostics.missing_cost_rates_hours}h</strong> of time entries have no cost rate assigned.
                    </AlertDescription>
                  </Alert>
                )}
                {data.diagnostics.unassigned_time_hours > 0 && (
                  <Alert variant="default">
                    <AlertDescription>
                      <strong>{data.diagnostics.unassigned_time_hours}h</strong> of time entries have no task assigned.
                    </AlertDescription>
                  </Alert>
                )}
                {data.diagnostics.unclassified_receipts_amount > 0 && (
                  <Alert variant="default">
                    <AlertDescription>
                      <strong>{fmt(data.diagnostics.unclassified_receipts_amount)}</strong> in receipts are unclassified.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="outline" onClick={onClose}>Close</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
