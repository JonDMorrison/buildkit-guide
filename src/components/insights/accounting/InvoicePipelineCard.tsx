import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useNavigate } from "react-router-dom";
import { DashboardCard } from "@/components/dashboard/shared/DashboardCard";
import { DashboardGrid } from "@/components/dashboard/shared/DashboardGrid";
import { FileText, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";

export function InvoicePipelineCard() {
  const { activeOrganizationId } = useOrganization();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["acct-invoice-pipeline", activeOrganizationId],
    queryFn: async () => {
      if (!activeOrganizationId) return null;
      const { data: invoices, error } = await supabase
        .from("invoices")
        .select("id,status,total,amount_paid")
        .eq("organization_id", activeOrganizationId);
      if (error) throw error;

      const all = invoices || [];
      const draft = all.filter(i => i.status === "draft");
      const sent = all.filter(i => i.status === "sent");
      const paid = all.filter(i => i.status === "paid");
      const overdue = all.filter(i => i.status === "overdue");

      const sumTotal = (arr: typeof all) => arr.reduce((s, i) => s + (i.total || 0), 0);
      const outstanding = sent.reduce((s, i) => s + ((i.total || 0) - (i.amount_paid || 0)), 0)
        + overdue.reduce((s, i) => s + ((i.total || 0) - (i.amount_paid || 0)), 0);

      return {
        draft: { count: draft.length, total: sumTotal(draft) },
        sent: { count: sent.length, total: sumTotal(sent) },
        paid: { count: paid.length, total: sumTotal(paid) },
        overdue: { count: overdue.length, total: sumTotal(overdue) },
        outstanding,
      };
    },
    enabled: !!activeOrganizationId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  return (
    <DashboardCard
      title="Invoice Pipeline"
      icon={FileText}
      loading={isLoading}
      variant="table"
      traceSource="invoices → status grouping"
      actions={
        <Button variant="ghost" size="sm" onClick={() => navigate("/invoices")} className="text-xs">
          All Invoices <ChevronRight className="h-3 w-3 ml-1" />
        </Button>
      }
    >
      {data && (
        <div className="space-y-3">
          <DashboardGrid columns={4} gap="sm" className="grid-cols-2 sm:grid-cols-4">
            <StatusMetric label="Draft" count={data.draft.count} total={data.draft.total} />
            <StatusMetric label="Sent" count={data.sent.count} total={data.sent.total} />
            <StatusMetric label="Paid" count={data.paid.count} total={data.paid.total} positive />
            <StatusMetric label="Overdue" count={data.overdue.count} total={data.overdue.total} alert />
          </DashboardGrid>

          {data.outstanding > 0 && (
            <div className="rounded-lg bg-muted/40 p-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Outstanding A/R</span>
              <span className="text-lg font-bold tabular-nums text-foreground">
                {formatCurrency(data.outstanding)}
              </span>
            </div>
          )}
        </div>
      )}
    </DashboardCard>
  );
}

function StatusMetric({
  label,
  count,
  total,
  alert,
  positive,
}: {
  label: string;
  count: number;
  total: number;
  alert?: boolean;
  positive?: boolean;
}) {
  return (
    <div className="rounded-lg bg-muted/40 p-3 text-center">
      <span className={`text-2xl font-bold tabular-nums ${
        alert && count > 0 ? "text-destructive"
        : positive && count > 0 ? "text-primary"
        : "text-foreground"
      }`}>
        {count}
      </span>
      <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">{label}</p>
      {total > 0 && (
        <p className="text-[9px] text-muted-foreground/70 mt-0.5 font-mono">{formatCurrency(total)}</p>
      )}
    </div>
  );
}
