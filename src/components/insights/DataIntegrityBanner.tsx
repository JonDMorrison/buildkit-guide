import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Receipt, ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatNumber } from "@/lib/formatters";

export function DataIntegrityBanner() {
  const { activeOrganizationId } = useOrganization();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["data-integrity-banner", activeOrganizationId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("rpc_executive_risk_summary", {
        p_org_id: activeOrganizationId!,
      });
      if (error) throw error;
      return data as any;
    },
    enabled: !!activeOrganizationId,
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading || !data) return null;

  const integrity = data?.data_integrity;
  const issueCount = integrity?.issue_count || 0;
  const issues = integrity?.issues || [];

  // Count receipts-related issues (unclassified receipts)
  const receiptIssues = issues.filter(
    (i: any) => i.issue_key === "unclassified_receipts" || i.issue_key === "missing_receipt_category"
  );

  return (
    <div className="space-y-3 mb-6">
      {/* Data Integrity Banner */}
      <Card className={issueCount > 0 ? "border-destructive/30 bg-destructive/5" : "border-primary/30 bg-primary/5"}>
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {issueCount > 0 ? (
                <ShieldAlert className="h-4 w-4 text-destructive" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-primary" />
              )}
              <span className="text-sm font-medium">
                {issueCount > 0
                  ? `${issueCount} data integrity ${issueCount === 1 ? "issue" : "issues"} found`
                  : "Data integrity — all checks passed"}
              </span>
              {issueCount > 0 && (
                <div className="flex gap-1.5 ml-2">
                  {issues
                    .filter((i: any, idx: number, arr: any[]) =>
                      arr.findIndex((x: any) => x.issue_key === i.issue_key) === idx
                    )
                    .slice(0, 3)
                    .map((i: any) => (
                      <Badge
                        key={i.issue_key}
                        variant="outline"
                        className={`text-xs ${
                          i.severity === "high"
                            ? "text-destructive border-destructive/30"
                            : "text-accent-foreground border-accent/30"
                        }`}
                      >
                        {i.issue_key?.replace(/_/g, " ")}
                      </Badge>
                    ))}
                </div>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/data-health")}>
              View Details
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Receipts Pipeline */}
      {receiptIssues.length > 0 && (
        <Card className="border-accent/30">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-accent-foreground" />
                <span className="text-sm font-medium">Receipts Pipeline</span>
                <Badge variant="outline" className="text-xs text-accent-foreground border-accent/30">
                  {receiptIssues.length} {receiptIssues.length === 1 ? "project" : "projects"} need attention
                </Badge>
              </div>
              <div className="flex gap-1.5">
                {receiptIssues.slice(0, 3).map((r: any) => (
                  <Badge
                    key={r.project_id}
                    variant="secondary"
                    className="text-xs cursor-pointer"
                    onClick={() => navigate(`/insights/project?projectId=${r.project_id}`)}
                  >
                    {r.project_name}
                  </Badge>
                ))}
                {receiptIssues.length > 3 && (
                  <span className="text-xs text-muted-foreground">+{receiptIssues.length - 3} more</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
