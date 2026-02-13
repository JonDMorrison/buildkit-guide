import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { SectionHeader } from "@/components/SectionHeader";
import { NoAccess } from "@/components/NoAccess";
import { useAuthRole } from "@/hooks/useAuthRole";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle2, Users, FileText, Receipt, DollarSign, Layers } from "lucide-react";

interface HealthCheck {
  label: string;
  icon: React.ReactNode;
  count: number;
  severity: "error" | "warning" | "ok";
  details: any[];
}

const DataHealth = () => {
  const { isAdmin, loading: roleLoading } = useAuthRole();
  const { activeOrganizationId } = useOrganization();
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeOrganizationId || !isAdmin) return;

    const run = async () => {
      setLoading(true);
      const results: HealthCheck[] = [];

      // 1. Workers missing cost_rate (cost_rate = 0)
      const { data: zeroCostMembers } = await supabase
        .from("project_members")
        .select("user_id, project_id, cost_rate, role")
        .eq("cost_rate", 0)
        .limit(100);

      // Resolve names for zero-cost members
      const userIds = [...new Set((zeroCostMembers || []).map(m => m.user_id))];
      let userNames: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        for (const p of profiles || []) {
          userNames[p.id] = p.full_name || "Unknown";
        }
      }

      results.push({
        label: "Workers with $0 cost rate",
        icon: <Users className="h-4 w-4" />,
        count: zeroCostMembers?.length || 0,
        severity: (zeroCostMembers?.length || 0) > 0 ? "warning" : "ok",
        details: (zeroCostMembers || []).map(m => ({
          user: userNames[m.user_id] || m.user_id,
          role: m.role,
          project_id: m.project_id,
        })),
      });

      // 2. Projects missing budgets
      const { data: allProjects } = await supabase
        .from("projects")
        .select("id, name, job_number")
        .eq("organization_id", activeOrganizationId)
        .eq("is_deleted", false);

      const { data: allBudgets } = await supabase
        .from("project_budgets")
        .select("project_id")
        .eq("organization_id", activeOrganizationId);

      const budgetProjectIds = new Set((allBudgets || []).map(b => b.project_id));
      const noBudget = (allProjects || []).filter(p => !budgetProjectIds.has(p.id));

      results.push({
        label: "Projects missing budgets",
        icon: <FileText className="h-4 w-4" />,
        count: noBudget.length,
        severity: noBudget.length > 0 ? "warning" : "ok",
        details: noBudget.map(p => ({ name: p.name, job_number: p.job_number })),
      });

      // 3. Receipts missing cost_type
      const { count: missingCostType } = await supabase
        .from("receipts")
        .select("id", { count: "exact", head: true })
        .is("cost_type", null);

      results.push({
        label: "Receipts missing cost_type",
        icon: <Receipt className="h-4 w-4" />,
        count: missingCostType || 0,
        severity: (missingCostType || 0) > 0 ? "warning" : "ok",
        details: [],
      });

      // 4. Projects with contract_value=0 but invoices exist
      const { data: zeroBudgets } = await supabase
        .from("project_budgets")
        .select("project_id")
        .eq("organization_id", activeOrganizationId)
        .eq("contract_value", 0);

      const zeroContractIds = (zeroBudgets || []).map(b => b.project_id);
      let invoiceConflicts: any[] = [];
      if (zeroContractIds.length > 0) {
        const { data: conflicting } = await supabase
          .from("invoices")
          .select("project_id, invoice_number")
          .in("project_id", zeroContractIds)
          .neq("status", "void")
          .limit(50);
        invoiceConflicts = conflicting || [];
      }
      const uniqueConflictProjects = [...new Set(invoiceConflicts.map(i => i.project_id))];

      results.push({
        label: "Projects with $0 contract but invoices",
        icon: <DollarSign className="h-4 w-4" />,
        count: uniqueConflictProjects.length,
        severity: uniqueConflictProjects.length > 0 ? "error" : "ok",
        details: invoiceConflicts.slice(0, 10),
      });

      // 5. Tasks with is_generated=true but scope_item_id null
      const { count: orphanGenerated } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("is_generated", true)
        .is("scope_item_id", null)
        .eq("is_deleted", false);

      results.push({
        label: "Generated tasks missing scope_item_id",
        icon: <Layers className="h-4 w-4" />,
        count: orphanGenerated || 0,
        severity: (orphanGenerated || 0) > 0 ? "error" : "ok",
        details: [],
      });

      setChecks(results);
      setLoading(false);
    };

    run();
  }, [activeOrganizationId, isAdmin]);

  if (roleLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return <Layout><NoAccess /></Layout>;
  }

  const totalIssues = checks.reduce((s, c) => s + (c.severity !== "ok" ? c.count : 0), 0);

  return (
    <Layout>
      <div className="container max-w-4xl mx-auto px-4 py-6">
        <SectionHeader title="Data Health" />

        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : (
          <>
            {/* Summary */}
            <Card className="mb-6">
              <CardContent className="py-4 flex items-center gap-3">
                {totalIssues === 0 ? (
                  <>
                    <CheckCircle2 className="h-6 w-6 text-status-complete" />
                    <span className="text-lg font-medium">All checks passed — no data issues found.</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-6 w-6 text-status-issue" />
                    <span className="text-lg font-medium">{totalIssues} issue{totalIssues !== 1 ? "s" : ""} found across {checks.filter(c => c.severity !== "ok").length} checks.</span>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Individual checks */}
            <div className="space-y-4">
              {checks.map((check, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {check.icon}
                        <CardTitle className="text-sm font-medium">{check.label}</CardTitle>
                      </div>
                      <Badge
                        variant={check.severity === "ok" ? "secondary" : check.severity === "error" ? "destructive" : "outline"}
                      >
                        {check.severity === "ok" ? "OK" : `${check.count} found`}
                      </Badge>
                    </div>
                  </CardHeader>
                  {check.details.length > 0 && check.severity !== "ok" && (
                    <CardContent className="pt-0">
                      <Table>
                        <TableBody>
                          {check.details.slice(0, 10).map((d, j) => (
                            <TableRow key={j}>
                              {Object.entries(d).map(([k, v]) => (
                                <TableCell key={k} className="text-sm py-1">
                                  <span className="text-muted-foreground mr-1">{k}:</span>
                                  {String(v)}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {check.details.length > 10 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Showing 10 of {check.details.length} items
                        </p>
                      )}
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default DataHealth;
