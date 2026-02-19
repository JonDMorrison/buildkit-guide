import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useEstimates } from "@/hooks/useEstimates";
import { AlertTriangle, TrendingDown, TrendingUp, Globe, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PlaybookBaselineComparison, type PlaybookBaseline } from "./PlaybookBaselineComparison";
import type { EstimateVarianceSummary } from "@/types/estimates";

interface Props {
  projectId: string;
  onClose: () => void;
}

const DeltaCell = ({ value, currency }: { value: number; currency: string }) => {
  const fmt = (v: number) =>
    `${new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(v)} ${currency}`;
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
  const navigate = useNavigate();
  const { fetchVariance } = useEstimates(projectId);
  const [data, setData] = useState<EstimateVarianceSummary | null>(null);
  const [baseline, setBaseline] = useState<PlaybookBaseline | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [varianceResult, baselineResult] = await Promise.all([
        fetchVariance(projectId),
        (supabase as any).rpc('get_playbook_baseline', { p_project_id: projectId }),
      ]);
      setData(varianceResult);
      if (baselineResult?.data) {
        setBaseline(baselineResult.data as PlaybookBaseline);
      }
      setLoading(false);
    };
    load();
  }, [projectId]);

  const cur = data?.currency || "CAD";
  const fmt = (v: number) =>
    `${new Intl.NumberFormat("en-CA", { style: "currency", currency: cur }).format(v)} ${cur}`;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle>Estimate vs Actual — Variance Report</DialogTitle>
            {data?.currency && (
              <Badge variant="outline" className="text-xs">
                <Globe className="h-3 w-3 mr-1" />
                {data.currency}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : !data?.has_estimate ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No estimate found for this project.</p>
            <p className="text-sm mt-1">Create an estimate (approved or draft) to see the variance report.</p>
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

            {/* Playbook Baseline Comparison */}
            {baseline?.has_playbook && (
              <PlaybookBaselineComparison
                baseline={baseline}
                estimateLaborHours={data.planned.labor_hours}
                currency={cur}
              />
            )}

            {/* Breakdown table */}
            <Card>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Planned ({cur})</TableHead>
                      <TableHead className="text-right">Actual ({cur})</TableHead>
                      <TableHead className="text-right">Delta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Labor Hours</TableCell>
                      <TableCell className="text-right">{data.planned.labor_hours}h</TableCell>
                      <TableCell className="text-right">{data.actual.labor_hours}h</TableCell>
                      <TableCell className="text-right">
                        <DeltaCell value={data.deltas.labor_hours} currency={cur} />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Labor Cost</TableCell>
                      <TableCell className="text-right">{fmt(data.planned.labor_bill_amount)}</TableCell>
                      <TableCell className="text-right">{fmt(data.actual.labor_cost)}</TableCell>
                      <TableCell className="text-right"><DeltaCell value={data.deltas.labor_cost} currency={cur} /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Materials</TableCell>
                      <TableCell className="text-right">{fmt(data.planned.material_cost)}</TableCell>
                      <TableCell className="text-right">{fmt(data.actual.material_cost)}</TableCell>
                      <TableCell className="text-right"><DeltaCell value={data.deltas.material} currency={cur} /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Machine</TableCell>
                      <TableCell className="text-right">{fmt(data.planned.machine_cost)}</TableCell>
                      <TableCell className="text-right">{fmt(data.actual.machine_cost)}</TableCell>
                      <TableCell className="text-right"><DeltaCell value={data.deltas.machine} currency={cur} /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Other</TableCell>
                      <TableCell className="text-right">{fmt(data.planned.other_cost)}</TableCell>
                      <TableCell className="text-right">{fmt(data.actual.other_cost)}</TableCell>
                      <TableCell className="text-right"><DeltaCell value={data.deltas.other} currency={cur} /></TableCell>
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
                      <TableCell className="text-right"><DeltaCell value={data.deltas.total_cost} currency={cur} /></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </Card>

            {/* Diagnostics / Flags */}
            {(data.diagnostics.missing_cost_rates_hours > 0 ||
              data.diagnostics.currency_mismatch_detected ||
              data.diagnostics.unassigned_time_hours > 0 ||
              data.diagnostics.unclassified_receipts_amount > 0) && (
              <div className="space-y-2">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" /> Data Quality Warnings
                </p>
                {data.diagnostics.missing_cost_rates_hours > 0 && (
                  <Alert variant="default">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Unrated Labor Hours</AlertTitle>
                    <AlertDescription className="flex items-center justify-between gap-2">
                      <span>
                        <strong>{data.diagnostics.missing_cost_rates_hours}h</strong> ({data.diagnostics.missing_cost_rates_count} entries) have no cost rate — labor cost is understated.
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => { onClose(); navigate('/settings/labor-rates'); }}
                      >
                        <Settings className="h-3 w-3 mr-1.5" />
                        Set Labor Rates
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}
                {data.diagnostics.currency_mismatch_detected && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Currency Mismatch</AlertTitle>
                    <AlertDescription>
                      <strong>{data.diagnostics.currency_mismatch_hours}h</strong> ({data.diagnostics.currency_mismatch_count} entries) excluded — member rate currency doesn't match org base currency.
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
