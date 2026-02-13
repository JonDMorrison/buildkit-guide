import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SectionHeader } from "@/components/SectionHeader";
import { useEstimateAccuracy } from "@/hooks/useEstimateAccuracy";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { useProjectRole } from "@/hooks/useProjectRole";
import { VarianceCard } from "@/components/insights/VarianceCard";
import { NoAccess } from "@/components/NoAccess";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, Clock, Package, Wrench, TrendingUp, AlertTriangle, Download } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/formatters";

const ProjectEstimateAccuracy = () => {
  const [searchParams] = useSearchParams();
  const { currentProjectId } = useCurrentProject();
  const paramProjectId = searchParams.get("projectId");
  const [selectedProject, setSelectedProject] = useState(paramProjectId || currentProjectId || "");
  const [projects, setProjects] = useState<{ id: string; name: string; job_number: string | null }[]>([]);
  const { isGlobalAdmin, hasAnyProjectRole, loading: roleLoading } = useProjectRole();
  const { variance, loading, error } = useEstimateAccuracy(selectedProject || null);

  useEffect(() => {
    const fetchProjects = async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, name, job_number")
        .eq("is_deleted", false)
        .order("name");
      setProjects(data || []);
    };
    fetchProjects();
  }, []);

  useEffect(() => {
    if (paramProjectId) setSelectedProject(paramProjectId);
    else if (currentProjectId && !selectedProject) setSelectedProject(currentProjectId);
  }, [paramProjectId, currentProjectId]);

  const hasAccess = isGlobalAdmin || (selectedProject ? hasAnyProjectRole(selectedProject, ["project_manager", "foreman"]) : true);

  // Variance breakdown rows
  const breakdownRows = useMemo(() => {
    if (!variance) return [];
    return [
      { category: "Labor Hours", planned: variance.planned_labor_hours, actual: variance.actual_labor_hours, delta: variance.labor_hours_delta, unit: "h" as const },
      { category: "Labor Cost", planned: variance.planned_labor_cost, actual: variance.actual_labor_cost, delta: variance.labor_cost_delta, unit: "$" as const },
      { category: "Material", planned: variance.planned_material_cost, actual: variance.actual_material_cost, delta: variance.material_cost_delta, unit: "$" as const },
      { category: "Machine", planned: variance.planned_machine_cost, actual: variance.actual_machine_cost, delta: variance.machine_cost_delta, unit: "$" as const },
      { category: "Other", planned: variance.planned_other_cost, actual: variance.actual_other_cost, delta: variance.other_cost_delta, unit: "$" as const },
      { category: "Total", planned: variance.planned_total_cost, actual: variance.actual_total_cost, delta: variance.total_cost_delta, unit: "$" as const },
    ];
  }, [variance]);

  const handleExportCSV = () => {
    if (!breakdownRows.length) return;
    const lines = ["Category,Planned,Actual,Delta ($),Delta (%)"];
    for (const r of breakdownRows) {
      const pct = r.planned !== 0 ? ((r.delta / r.planned) * 100).toFixed(1) : "0";
      const val = r.unit === "$" ? r.planned.toFixed(2) : r.planned.toFixed(1);
      const actVal = r.unit === "$" ? r.actual.toFixed(2) : r.actual.toFixed(1);
      lines.push(`${r.category},${val},${actVal},${r.delta.toFixed(2)},${pct}`);
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const name = projects.find(p => p.id === selectedProject)?.name || "project";
    a.download = `estimate-accuracy-${name.replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fmtVal = (value: number, unit: "$" | "h") =>
    unit === "$" ? formatCurrency(value) : `${formatNumber(value)} hrs`;

  if (roleLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      </Layout>
    );
  }

  if (!hasAccess) {
    return <Layout><NoAccess /></Layout>;
  }

  return (
    <Layout>
      <div className="container max-w-6xl mx-auto px-4 py-6">
        <SectionHeader title="Estimate Accuracy" />

        {/* Project selector */}
        <div className="flex flex-wrap gap-4 mb-6 items-end">
          <div className="space-y-1.5 min-w-[200px]">
            <Label>Project</Label>
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.job_number ? `${p.job_number} – ` : ""}{p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {variance && (
            <div className="ml-auto">
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          )}
        </div>

        {!selectedProject && (
          <p className="text-muted-foreground text-center py-12">Select a project to view estimate accuracy.</p>
        )}

        {selectedProject && loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
            <Skeleton className="h-64" />
          </div>
        )}

        {selectedProject && error && (
          <Card>
            <CardContent className="py-8 text-center">
              <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {selectedProject && !loading && variance && (
          <>
            {/* Diagnostic warnings */}
            {variance.labor_hours_missing_cost_rate > 0 && (
              <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Missing Cost Rates</AlertTitle>
                <AlertDescription>
                  {formatNumber(variance.labor_hours_missing_cost_rate)} labor hours have $0 cost rate. Labor cost is understated.
                </AlertDescription>
              </Alert>
            )}
            {variance.labor_hours_missing_membership > 0 && (
              <Alert className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Unmatched Workers</AlertTitle>
                <AlertDescription>
                  {formatNumber(variance.labor_hours_missing_membership)} labor hours from workers not in the project member list. These hours have $0 cost.
                </AlertDescription>
              </Alert>
            )}
            {variance.actual_unclassified_cost > 0 && (
              <Alert className="mb-6">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Unclassified Receipts</AlertTitle>
                <AlertDescription>
                  {formatCurrency(variance.actual_unclassified_cost)} in receipts without a cost category (material/machine/other). These are included in total but not categorized.
                </AlertDescription>
              </Alert>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <VarianceCard
                label="Total Cost"
                planned={variance.planned_total_cost}
                actual={variance.actual_total_cost}
                unit="$"
                icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
              />
              <VarianceCard
                label="Labor Hours"
                planned={variance.planned_labor_hours}
                actual={variance.actual_labor_hours}
                unit="h"
                icon={<Clock className="h-4 w-4 text-muted-foreground" />}
              />
              <VarianceCard
                label="Materials"
                planned={variance.planned_material_cost}
                actual={variance.actual_material_cost}
                unit="$"
                icon={<Package className="h-4 w-4 text-muted-foreground" />}
              />
              <VarianceCard
                label="Machine"
                planned={variance.planned_machine_cost}
                actual={variance.actual_machine_cost}
                unit="$"
                icon={<Wrench className="h-4 w-4 text-muted-foreground" />}
              />
              <VarianceCard
                label="Profit"
                planned={variance.planned_profit}
                actual={variance.actual_profit}
                unit="$"
                icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
                unavailableMessage={variance.contract_value === 0 ? "No contract value set" : undefined}
              />
              <VarianceCard
                label="Margin"
                planned={variance.planned_margin_percent}
                actual={variance.actual_margin_percent}
                unit="%"
                icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
                unavailableMessage={variance.contract_value === 0 ? "No contract value set" : undefined}
              />
            </div>

            {/* Variance Breakdown Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Variance Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Planned</TableHead>
                      <TableHead className="text-right">Actual</TableHead>
                      <TableHead className="text-right">Delta</TableHead>
                      <TableHead className="text-right">Delta %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {breakdownRows.map((r) => {
                      const pct =
                        r.planned !== 0 ? (r.delta / r.planned) * 100 : 0;
                      const isOver = r.delta < 0;
                      const isTotal = r.category === "Total";
                      return (
                        <TableRow
                          key={r.category}
                          className={isTotal ? "font-bold border-t-2" : ""}
                        >
                          <TableCell>{r.category}</TableCell>
                          <TableCell className="text-right">
                            {fmtVal(r.planned, r.unit)}
                          </TableCell>
                          <TableCell className="text-right">
                            {fmtVal(r.actual, r.unit)}
                          </TableCell>
                          <TableCell
                            className={`text-right ${isOver ? "text-destructive" : r.delta > 0 ? "text-green-600" : ""}`}
                          >
                            {isOver ? "-" : r.delta > 0 ? "+" : ""}
                            {fmtVal(Math.abs(r.delta), r.unit)}
                          </TableCell>
                          <TableCell
                            className={`text-right ${isOver ? "text-destructive" : r.delta > 0 ? "text-green-600" : ""}`}
                          >
                            {pct.toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
};

export default ProjectEstimateAccuracy;
