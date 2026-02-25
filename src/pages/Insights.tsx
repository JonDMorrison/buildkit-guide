import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { usePortfolioInsights, PortfolioRow } from "@/hooks/usePortfolioInsights";
import { useOrganization } from "@/hooks/useOrganization";
import { useProjectRole } from "@/hooks/useProjectRole";
import { useOrgSnapshots } from "@/hooks/useOrgSnapshots";
import { useOrgScopeAccuracy } from "@/hooks/useOrgScopeAccuracy";
import { PortfolioExportCSV } from "@/components/insights/PortfolioExportCSV";
import { RecommendationsPanel } from "@/components/insights/RecommendationsPanel";
import { OrgScopeLearningPanel } from "@/components/insights/OrgScopeLearningPanel";
import { WeeklyInsightCard } from "@/components/insights/WeeklyInsightCard";
import { getPortfolioRecommendations } from "@/lib/recommendations/rules";
import { OperationalPatternsPanel } from "@/components/insights/OperationalPatternsPanel";
import { NoAccess } from "@/components/NoAccess";
import { UnratedLaborBanner } from "@/components/UnratedLaborBanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DollarSign, TrendingUp, AlertTriangle, BarChart3, Clock, Activity, ShieldAlert, ChevronLeft, ChevronRight, CalendarIcon, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { getDataQualityFlags } from "@/lib/dataQualityFlags";
import { format, subWeeks } from "date-fns";
import { cn } from "@/lib/utils";

// Shared dashboard system
import { DashboardHeader } from "@/components/dashboard/shared/DashboardHeader";
import { DashboardSection } from "@/components/dashboard/shared/DashboardSection";
import { DashboardGrid } from "@/components/dashboard/shared/DashboardGrid";

// Accounting card components
import {
  DataIntegrityBannerCard,
  ReceiptsPipelineCard,
  JobCostAlertsCard,
  InvoicePipelineCard,
  FinancialTrendsSection,
} from "@/components/insights/accounting";

const statusOptions = [
  { value: "active", label: "Active (Default)" },
  { value: "all", label: "All Statuses" },
  { value: "awarded", label: "Awarded" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "potential", label: "Potential" },
  { value: "not_started", label: "Not Started" },
  { value: "didnt_get", label: "Didn't Get" },
];

const ACTIVE_STATUSES = new Set(["not_started", "in_progress", "awarded", "potential"]);

const pageSizeOptions = [25, 50, 100] as const;

const dataQualityFilterOptions = [
  { key: "no_budget", label: "Missing budget" },
  { key: "missing_rates", label: "Missing cost rates" },
  { key: "unclassified", label: "Unclassified receipts" },
] as const;

const Insights = () => {
  const navigate = useNavigate();
  const { isGlobalAdmin, loading: roleLoading } = useProjectRole();
  const { activeOrganizationId } = useOrganization();
  const [statusFilter, setStatusFilter] = useState("active");
  const [qualityFilters, setQualityFilters] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(25);

  // Date range for snapshot charts
  const [dateFrom, setDateFrom] = useState<Date | undefined>(subWeeks(new Date(), 12));
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date());

  const dateFromStr = dateFrom ? format(dateFrom, "yyyy-MM-dd") : undefined;
  const dateToStr = dateTo ? format(dateTo, "yyyy-MM-dd") : undefined;

  const { snapshots, loading: snapshotsLoading } = useOrgSnapshots(dateFromStr, dateToStr);
  const { rows: orgScopeRows, loading: orgScopeLoading } = useOrgScopeAccuracy(12);

  // "active" is a UI-only composite filter — pass null to the hook (fetch all) and filter client-side
  const rpcStatusFilter = statusFilter === "all" || statusFilter === "active" ? null : statusFilter;
  const { rows, loading, error } = usePortfolioInsights(rpcStatusFilter);

  // Client-side status filtering for "active" composite
  const statusFilteredRows = useMemo(() => {
    if (statusFilter === "active") {
      return rows.filter((r) => ACTIVE_STATUSES.has(r.status));
    }
    return rows;
  }, [rows, statusFilter]);

  // Apply data quality filters
  const filteredRows = useMemo(() => {
    if (qualityFilters.size === 0) return statusFilteredRows;
    return statusFilteredRows.filter((r) => {
      const flags = getDataQualityFlags(r);
      const flagKeys = new Set(flags.map((f) => f.key));
      for (const filter of qualityFilters) {
        if (flagKeys.has(filter)) return true;
      }
      return false;
    });
  }, [statusFilteredRows, qualityFilters]);

  // Split rows by budget status
  const withBudget = useMemo(() => filteredRows.filter((r) => r.has_budget), [filteredRows]);
  const withoutBudget = useMemo(() => filteredRows.filter((r) => !r.has_budget), [filteredRows]);

  const toggleQualityFilter = (key: string) => {
    setQualityFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setPage(0);
  };

  // Aggregate KPIs — only from projects WITH budgets
  const kpis = useMemo(() => {
    if (!filteredRows.length) return null;
    const budgeted = withBudget;
    const totalContract = budgeted.reduce((s, r) => s + r.contract_value, 0);
    const totalActual = budgeted.reduce((s, r) => s + r.actual_total_cost, 0);
    const totalPlanned = budgeted.reduce((s, r) => s + r.planned_total_cost, 0);
    const overBudget = budgeted.filter((r) => r.total_cost_delta < 0).length;
    const weightedMargin =
      totalContract > 0
        ? ((totalContract - totalActual) / totalContract) * 100
        : 0;
    return {
      totalContract, totalActual, totalPlanned, overBudget, weightedMargin,
      includedCount: budgeted.length,
      excludedCount: withoutBudget.length,
      totalCount: filteredRows.length,
    };
  }, [filteredRows, withBudget, withoutBudget]);

  // Portfolio recommendations
  const portfolioRecs = useMemo(
    () => getPortfolioRecommendations(filteredRows, 5),
    [filteredRows]
  );

  // Sort by worst variance (most negative delta = biggest overrun)
  const sorted = useMemo(
    () => [...filteredRows].sort((a, b) => {
      if (a.has_budget && !b.has_budget) return -1;
      if (!a.has_budget && b.has_budget) return 1;
      return a.total_cost_delta - b.total_cost_delta;
    }),
    [filteredRows]
  );

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const paginatedRows = sorted.slice(safePage * pageSize, (safePage + 1) * pageSize);

  // Reset page when filters change
  const handleStatusChange = (val: string) => {
    setStatusFilter(val);
    setPage(0);
  };

  const handlePageSizeChange = (val: string) => {
    setPageSize(Number(val));
    setPage(0);
  };

  if (roleLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      </Layout>
    );
  }

  const skeletonRows = Array.from({ length: 5 });

  return (
    <Layout>
      <div className="container max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <DashboardHeader
          title="Portfolio Insights"
          subtitle="Financial health, receipts, invoices, and cost alerts"
          actions={
            <>
              <Button variant="outline" size="sm" onClick={() => navigate("/insights/snapshots")}>
                <Camera className="h-4 w-4 mr-1.5" /> Snapshots
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/data-health")}>
                <Activity className="h-4 w-4 mr-1.5" /> Data Health
              </Button>
              {filteredRows.length > 0 && <PortfolioExportCSV rows={filteredRows} />}
            </>
          }
        />

        {/* ── Section 1: Data Integrity Banner ──────────────────────── */}
        <DashboardSection title="Data Integrity">
          <DashboardGrid columns={1}>
            <DataIntegrityBannerCard />
          </DashboardGrid>
          <UnratedLaborBanner />
        </DashboardSection>

        {/* ── Section 2: Receipts Pipeline ──────────────────────────── */}
        <DashboardSection title="Receipts Pipeline">
          <ReceiptsPipelineCard />
        </DashboardSection>

        {/* ── Section 3: Job Cost Alerts ────────────────────────────── */}
        <DashboardSection title="Job Cost Alerts">
          <JobCostAlertsCard rows={filteredRows} loading={loading} />
        </DashboardSection>

        {/* ── Section 4: Invoice Pipeline ───────────────────────────── */}
        <DashboardSection title="Invoice Pipeline">
          <InvoicePipelineCard />
        </DashboardSection>

        {/* ── Section 5: Financial Trends ───────────────────────────── */}
        <DashboardSection title="Financial Trends">
          {/* Date range filters */}
          <div className="flex flex-wrap gap-3 mb-4 items-end">
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[130px] justify-start text-left font-normal text-xs", !dateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="h-3.5 w-3.5 mr-1" />
                    {dateFrom ? format(dateFrom, "MMM d, yy") : "Start"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[130px] justify-start text-left font-normal text-xs", !dateTo && "text-muted-foreground")}>
                    <CalendarIcon className="h-3.5 w-3.5 mr-1" />
                    {dateTo ? format(dateTo, "MMM d, yy") : "End"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <FinancialTrendsSection snapshots={snapshots} loading={snapshotsLoading} />
        </DashboardSection>

        {/* ── KPI Summary Cards ─────────────────────────────────────── */}
        {error && (
          <Card>
            <CardContent className="py-8 text-center">
              <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {!error && rows.length === 0 && !loading && (
          <Card>
            <CardContent className="py-12 text-center">
              <BarChart3 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                No project data available. Create projects and set budgets to see insights.
              </p>
            </CardContent>
          </Card>
        )}

        {!error && (kpis || (loading && sorted.length > 0)) && (
          <>
            {/* KPI Cards */}
            <DashboardSection title="Portfolio Summary">
              <div className="flex flex-wrap gap-3 mb-4 items-end">
                <div className="space-y-1 min-w-[160px]">
                  <Label className="text-xs">Status</Label>
                  <Select value={statusFilter} onValueChange={handleStatusChange}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="flex items-center gap-1 text-xs">
                    <ShieldAlert className="h-3 w-3" /> Data Quality
                  </Label>
                  <div className="flex gap-3">
                    {dataQualityFilterOptions.map((opt) => (
                      <label key={opt.key} className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <Checkbox
                          checked={qualityFilters.has(opt.key)}
                          onCheckedChange={() => toggleQualityFilter(opt.key)}
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 ${loading ? "opacity-60" : ""}`}>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Total Contract Value</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{kpis ? formatCurrency(kpis.totalContract) : "—"}</div>
                    <p className="text-xs text-muted-foreground">
                      {kpis ? `${kpis.includedCount} of ${kpis.totalCount} projects` : "Loading…"}
                      {kpis && kpis.excludedCount > 0 && (
                        <span className="text-destructive"> · {kpis.excludedCount} missing budget</span>
                      )}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Total Actual Cost</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{kpis ? formatCurrency(kpis.totalActual) : "—"}</div>
                    <p className="text-xs text-muted-foreground">
                      {kpis ? `Planned: ${formatCurrency(kpis.totalPlanned)}` : "Loading…"}
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
                      {kpis
                        ? kpis.totalContract > 0
                          ? `${kpis.weightedMargin.toFixed(1)}%`
                          : "N/A"
                        : "—"}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Weighted by contract value
                      {kpis && kpis.excludedCount > 0 && " · budgeted only"}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Over Budget</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{kpis ? kpis.overBudget : "—"}</div>
                    <p className="text-xs text-muted-foreground">
                      {kpis ? `of ${kpis.includedCount} budgeted projects` : "Loading…"}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </DashboardSection>

            {/* Weekly AI Ops Summary */}
            <div className="mb-6">
              <WeeklyInsightCard title="Weekly Ops Summary" />
            </div>

            {/* Recommendations */}
            <RecommendationsPanel recommendations={portfolioRecs} title="Top Recommendations" />

            {/* Scope Estimation Learning */}
            <div className="mb-6">
              <OrgScopeLearningPanel rows={orgScopeRows} loading={orgScopeLoading} />
            </div>

            {/* Operational Patterns */}
            {activeOrganizationId && (
              <div className="mb-6">
                <OperationalPatternsPanel organizationId={activeOrganizationId} />
              </div>
            )}

            {/* Variance Leaderboard */}
            <Card className="mb-6">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Variance Leaderboard</CardTitle>
                {loading && sorted.length > 0 && (
                  <span className="text-xs text-muted-foreground animate-pulse">Updating…</span>
                )}
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job #</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Budget</TableHead>
                      <TableHead>Data Quality</TableHead>
                      <TableHead className="text-right">Planned</TableHead>
                      <TableHead className="text-right">Actual</TableHead>
                      <TableHead className="text-right">Delta ($)</TableHead>
                      <TableHead className="text-right">Delta (%)</TableHead>
                      <TableHead className="text-right">Margin %</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && sorted.length === 0
                      ? skeletonRows.map((_, i) => (
                          <TableRow key={i}>
                            {Array.from({ length: 11 }).map((_, j) => (
                              <TableCell key={j}>
                                <Skeleton className="h-5 w-full" />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      : paginatedRows.map((r) => {
                          const deltaPct =
                            r.planned_total_cost !== 0
                              ? (r.total_cost_delta / r.planned_total_cost) * 100
                              : 0;
                          const isOver = r.total_cost_delta < 0;
                          const qualityFlags = getDataQualityFlags(r);
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
                              <TableCell>
                                {r.has_budget ? (
                                  <Badge variant="secondary" className="text-xs">Set</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs text-destructive border-destructive/30">
                                    Missing
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {qualityFlags.length === 0 ? (
                                  <Badge variant="secondary" className="text-xs">Clean</Badge>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {qualityFlags.filter(f => f.key !== "no_budget").map((f) => (
                                      <Badge
                                        key={f.key}
                                        variant="outline"
                                        className={`text-xs ${f.severity === "error" ? "text-destructive border-destructive/30" : "text-accent-foreground border-accent/30"}`}
                                      >
                                        {f.label}
                                      </Badge>
                                    ))}
                                    {qualityFlags.every(f => f.key === "no_budget") && (
                                      <span className="text-xs text-muted-foreground">—</span>
                                    )}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {r.has_budget ? formatCurrency(r.planned_total_cost) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(r.actual_total_cost)}
                              </TableCell>
                              <TableCell className="text-right">
                                {r.has_budget ? (
                                  <span className={`font-medium ${isOver ? "text-destructive" : "text-primary"}`}>
                                    {isOver ? "-" : "+"}
                                    {formatCurrency(Math.abs(r.total_cost_delta))}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {r.has_budget ? (
                                  <span className={isOver ? "text-destructive" : "text-primary"}>
                                    {deltaPct.toFixed(1)}%
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {r.has_budget && r.contract_value > 0 ? (
                                  <span className={`font-medium ${r.actual_margin_percent < 0 ? "text-destructive" : "text-primary"}`}>
                                    {r.actual_margin_percent.toFixed(1)}%
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {!r.has_budget && (
                                  <Button
                                    variant="outline"
                                    size="xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/project-overview?projectId=${r.project_id}&tab=budget`);
                                    }}
                                  >
                                    Set budget
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                  </TableBody>
                </Table>

                {/* Pagination controls */}
                {sorted.length > 0 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>
                        {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, sorted.length)} of {sorted.length}
                      </span>
                      <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                        <SelectTrigger className="h-8 w-[80px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {pageSizeOptions.map((s) => (
                            <SelectItem key={s} value={String(s)}>
                              {s}/page
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={safePage === 0}
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground px-2">
                        Page {safePage + 1} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={safePage >= totalPages - 1}
                        onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
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
