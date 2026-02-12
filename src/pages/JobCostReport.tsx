import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { SectionHeader } from "@/components/SectionHeader";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { useJobCostReport } from "@/hooks/useJobCostReport";
import { JobCostExportCSV } from "@/components/job-cost/JobCostExportCSV";
import { JobCostExportPDF } from "@/components/job-cost/JobCostExportPDF";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, Clock, Package, AlertTriangle } from "lucide-react";
import { format, parse } from "date-fns";
import { useProjectRole } from "@/hooks/useProjectRole";
import { NoAccess } from "@/components/NoAccess";

const JobCostReport = () => {
  const { currentProjectId } = useCurrentProject();
  const { isGlobalAdmin, hasAnyProjectRole } = useProjectRole();
  const [selectedProject, setSelectedProject] = useState<string>(currentProjectId || "");
  const [projects, setProjects] = useState<{ id: string; name: string; job_number: string | null }[]>([]);
  const [startDateStr, setStartDateStr] = useState<string>("");
  const [endDateStr, setEndDateStr] = useState<string>("");

  const startDate = startDateStr ? parse(startDateStr, "yyyy-MM-dd", new Date()) : null;
  const endDate = endDateStr ? parse(endDateStr, "yyyy-MM-dd", new Date()) : null;

  const { report, loading } = useJobCostReport({
    projectId: selectedProject || null,
    startDate,
    endDate,
  });

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
    if (currentProjectId && !selectedProject) {
      setSelectedProject(currentProjectId);
    }
  }, [currentProjectId]);

  // Access control
  const hasAccess = isGlobalAdmin || (selectedProject ? hasAnyProjectRole(selectedProject, ["project_manager", "foreman"]) : true);

  const selectedProjectData = projects.find((p) => p.id === selectedProject);
  const dateRange =
    startDate && endDate
      ? `${format(startDate, "MMM d, yyyy")} – ${format(endDate, "MMM d, yyyy")}`
      : startDate
        ? `From ${format(startDate, "MMM d, yyyy")}`
        : endDate
          ? `Until ${format(endDate, "MMM d, yyyy")}`
          : "All time";

  if (!hasAccess) {
    return <Layout><NoAccess /></Layout>;
  }

  return (
    <Layout>
        <div className="container max-w-6xl mx-auto px-4 py-6">
          <SectionHeader title="Job Cost Report" />

          {/* Filters */}
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
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <DatePicker value={startDateStr} onChange={setStartDateStr} />
            </div>
            <div className="space-y-1.5">
              <Label>End Date</Label>
              <DatePicker value={endDateStr} onChange={setEndDateStr} />
            </div>
          </div>

          {!selectedProject && (
            <p className="text-muted-foreground text-center py-12">Select a project to view the cost report.</p>
          )}

          {selectedProject && loading && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
              </div>
              <Skeleton className="h-64" />
            </div>
          )}

          {selectedProject && !loading && report && (
            <>
              {/* Export buttons */}
              <div className="flex gap-2 mb-4 justify-end">
                <JobCostExportCSV report={report} projectName={selectedProjectData?.name || "project"} />
                <JobCostExportPDF
                  report={report}
                  projectName={selectedProjectData?.name || "project"}
                  jobNumber={selectedProjectData?.job_number || undefined}
                  dateRange={dateRange}
                />
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Total Labor</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">${report.labor.totalCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                    <p className="text-xs text-muted-foreground">{report.labor.totalHours.toFixed(1)} hours</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Total Materials</CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">${report.materials.totalCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                    <p className="text-xs text-muted-foreground">{report.materials.rows.length} receipts</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Grand Total</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">${report.grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                    <p className="text-xs text-muted-foreground">{dateRange}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Labor table */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-base">Labor Costs</CardTitle>
                </CardHeader>
                <CardContent>
                  {report.labor.rows.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-4">No closed time entries found for this period.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Worker</TableHead>
                          <TableHead className="text-right">Hours</TableHead>
                          <TableHead className="text-right">Rate</TableHead>
                          <TableHead className="text-right">Cost</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.labor.rows.map((row) => (
                          <TableRow key={row.userId}>
                            <TableCell className="font-medium">
                              {row.userName}
                              {row.billRate === null && (
                                <Badge variant="destructive" className="ml-2">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  No rate
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">{row.hoursWorked.toFixed(1)}</TableCell>
                            <TableCell className="text-right">
                              {row.billRate ? `$${row.billRate.toFixed(2)}` : "—"}
                            </TableCell>
                            <TableCell className="text-right">${row.totalCost.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold border-t-2">
                          <TableCell>Total</TableCell>
                          <TableCell className="text-right">{report.labor.totalHours.toFixed(1)}</TableCell>
                          <TableCell />
                          <TableCell className="text-right">${report.labor.totalCost.toFixed(2)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Materials table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Material / Expense Costs</CardTitle>
                </CardHeader>
                <CardContent>
                  {report.materials.rows.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-4">No receipts found for this period.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Vendor</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.materials.rows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>{format(new Date(row.date), "MMM d, yyyy")}</TableCell>
                            <TableCell className="capitalize">{row.category}</TableCell>
                            <TableCell>{row.vendor || "—"}</TableCell>
                            <TableCell className="text-right">${row.amount.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold border-t-2">
                          <TableCell colSpan={3}>Total</TableCell>
                          <TableCell className="text-right">${report.materials.totalCost.toFixed(2)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
    </Layout>
  );
};

export default JobCostReport;
