import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SectionHeader } from "@/components/SectionHeader";
import { usePortfolioInsights, PortfolioRow } from "@/hooks/usePortfolioInsights";
import { useProjectRole } from "@/hooks/useProjectRole";
import { PortfolioExportCSV } from "@/components/insights/PortfolioExportCSV";
import { NoAccess } from "@/components/NoAccess";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DollarSign, TrendingUp, AlertTriangle, BarChart3, Clock, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatNumber } from "@/lib/formatters";

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "awarded", label: "Awarded" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "potential", label: "Potential" },
  { value: "didnt_get", label: "Didn't Get" },
];

const Insights = () => {
  const navigate = useNavigate();
  const { isGlobalAdmin, loading: roleLoading } = useProjectRole();
  const [statusFilter, setStatusFilter] = useState("all");
  const { rows, loading, error } = usePortfolioInsights(
    statusFilter === "all" ? null : statusFilter
  );

  // Aggregate KPIs
  const kpis = useMemo(() => {
    if (!rows.length) return null;
    const totalContract = rows.reduce((s, r) => s + r.contract_value, 0);
    const totalActual = rows.reduce((s, r) => s + r.actual_total_cost, 0);
    const totalPlanned = rows.reduce((s, r) => s + r.planned_total_cost, 0);
    const overBudget = rows.filter((r) => r.total_cost_delta < 0).length;
    const weightedMargin =
      totalContract > 0
        ? ((totalContract - totalActual) / totalContract) * 100
        : 0;
    return { totalContract, totalActual, totalPlanned, overBudget, weightedMargin };
  }, [rows]);

  // Most inaccurate cost category (aggregate across portfolio using variance data)
  const worstCategory = useMemo(() => {
    if (!rows.length) return null;
    // We only have total_cost_delta in portfolio; for category breakdown we note this limitation
    return null; // Category breakdown requires per-project variance calls — shown as placeholder
  }, [rows]);

  // Sort by worst variance (most negative delta = biggest overrun)
  const sorted = useMemo(
    () => [...rows].sort((a, b) => a.total_cost_delta - b.total_cost_delta),
    [rows]
  );

  if (roleLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container max-w-6xl mx-auto px-4 py-6">
        <SectionHeader title="Portfolio Insights" />

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6 items-end">
          <div className="space-y-1.5 min-w-[180px]">
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="space-y-1.5 opacity-50 cursor-not-allowed">
                  <Label>Date Range</Label>
                  <div className="h-11 px-3 flex items-center border rounded-md text-sm text-muted-foreground">
                    Coming soon
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                Coming soon with weekly snapshots
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/data-health")}
            >
              <Activity className="h-4 w-4 mr-1.5" />
              Data Health
            </Button>
            {rows.length > 0 && <PortfolioExportCSV rows={rows} />}
          </div>
        </div>

        {loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
            <Skeleton className="h-64" />
          </div>
        )}

        {error && (
          <Card>
            <CardContent className="py-8 text-center">
              <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {!loading && !error && rows.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <BarChart3 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                No project data available. Create projects and set budgets to see insights.
              </p>
            </CardContent>
          </Card>
        )}

        {!loading && !error && kpis && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Contract Value</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(kpis.totalContract)}</div>
                  <p className="text-xs text-muted-foreground">{rows.length} projects</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Actual Cost</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(kpis.totalActual)}</div>
                  <p className="text-xs text-muted-foreground">
                    Planned: {formatCurrency(kpis.totalPlanned)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Avg Margin</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {kpis.totalContract > 0
                      ? `${kpis.weightedMargin.toFixed(1)}%`
                      : "N/A"}
                  </div>
                  <p className="text-xs text-muted-foreground">Weighted by contract value</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Over Budget</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpis.overBudget}</div>
                  <p className="text-xs text-muted-foreground">
                    of {rows.length} projects
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Variance Leaderboard */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-base">Variance Leaderboard</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job #</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Planned</TableHead>
                      <TableHead className="text-right">Actual</TableHead>
                      <TableHead className="text-right">Delta ($)</TableHead>
                      <TableHead className="text-right">Delta (%)</TableHead>
                      <TableHead className="text-right">Margin %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.map((r) => {
                      const deltaPct =
                        r.planned_total_cost !== 0
                          ? (r.total_cost_delta / r.planned_total_cost) * 100
                          : 0;
                      const isOver = r.total_cost_delta < 0;
                      return (
                        <TableRow
                          key={r.project_id}
                          className="cursor-pointer"
                          onClick={() =>
                            navigate(`/insights/project?projectId=${r.project_id}`)
                          }
                        >
                          <TableCell className="font-mono text-sm">
                            {r.job_number || "—"}
                          </TableCell>
                          <TableCell className="font-medium">{r.project_name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize text-xs">
                              {r.status?.replace(/_/g, " ") || "—"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(r.planned_total_cost)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(r.actual_total_cost)}
                          </TableCell>
                          <TableCell
                            className={`text-right font-medium ${isOver ? "text-destructive" : "text-green-600"}`}
                          >
                            {isOver ? "-" : "+"}
                            {formatCurrency(Math.abs(r.total_cost_delta))}
                          </TableCell>
                          <TableCell
                            className={`text-right ${isOver ? "text-destructive" : "text-green-600"}`}
                          >
                            {deltaPct.toFixed(1)}%
                          </TableCell>
                          <TableCell
                            className={`text-right font-medium ${r.actual_margin_percent < 0 ? "text-destructive" : "text-green-600"}`}
                          >
                            {r.contract_value > 0
                              ? `${r.actual_margin_percent.toFixed(1)}%`
                              : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Trend chart placeholder */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Variance Trends</CardTitle>
              </CardHeader>
              <CardContent className="py-8 text-center">
                <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Weekly variance trends will be available once snapshot collection is enabled.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
};

export default Insights;
