import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useNavigate } from "react-router-dom";
import { DashboardCard } from "@/components/dashboard/shared/DashboardCard";
import { DashboardGrid } from "@/components/dashboard/shared/DashboardGrid";
import { Receipt, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { subDays, format, differenceInDays } from "date-fns";

export function ReceiptsPipelineCard() {
  const { activeOrganizationId } = useOrganization();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["acct-receipts-pipeline", activeOrganizationId],
    queryFn: async () => {
      if (!activeOrganizationId) return null;
      // Get all receipts across org projects
      const { data: receipts, error } = await supabase
        .from("receipts")
        .select("id, review_status, category, cost_type, created_at, reviewed_at, project_id")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      const today = new Date();
      const todayStr = format(today, "yyyy-MM-dd");
      const staleThreshold = subDays(today, 7);

      const pending = (receipts || []).filter(r => r.review_status === "pending");
      const needsCategory = (receipts || []).filter(r => !r.cost_type && r.review_status !== "pending");
      const approvedToday = (receipts || []).filter(r =>
        r.review_status === "reviewed" && r.reviewed_at && format(new Date(r.reviewed_at), "yyyy-MM-dd") === todayStr
      );
      const stale = pending.filter(r =>
        r.created_at && new Date(r.created_at) < staleThreshold
      );

      return {
        pending: pending.length,
        needsCategory: needsCategory.length,
        approvedToday: approvedToday.length,
        stale: stale.length,
        avgAgeDays: pending.length > 0
          ? Math.round(pending.reduce((sum, r) => sum + differenceInDays(today, new Date(r.created_at)), 0) / pending.length)
          : 0,
      };
    },
    enabled: !!activeOrganizationId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  return (
    <DashboardCard
      title="Receipts Pipeline"
      icon={Receipt}
      loading={isLoading}
      variant="table"
      traceSource="receipts → review_status, cost_type, reviewed_at"
      actions={
        <Button variant="ghost" size="sm" onClick={() => navigate("/receipts")} className="text-xs">
          All Receipts <ChevronRight className="h-3 w-3 ml-1" />
        </Button>
      }
    >
      {data && (
        <DashboardGrid columns={2} gap="sm">
          <PipelineMetric
            label="Pending Review"
            value={data.pending}
            alert={data.pending > 5}
            sublabel={data.avgAgeDays > 0 ? `Avg age: ${data.avgAgeDays}d` : undefined}
          />
          <PipelineMetric
            label="Needs Category"
            value={data.needsCategory}
            alert={data.needsCategory > 0}
            sublabel="Missing cost_type"
          />
          <PipelineMetric
            label="Approved Today"
            value={data.approvedToday}
            positive
          />
          <PipelineMetric
            label="Stale (7d+)"
            value={data.stale}
            alert={data.stale > 0}
            sublabel="Pending > 7 days"
          />
        </DashboardGrid>
      )}
    </DashboardCard>
  );
}

function PipelineMetric({
  label,
  value,
  alert,
  positive,
  sublabel,
}: {
  label: string;
  value: number;
  alert?: boolean;
  positive?: boolean;
  sublabel?: string;
}) {
  return (
    <div className="rounded-lg bg-muted/40 p-3 text-center">
      <span className={`text-2xl font-bold tabular-nums ${
        alert ? "text-destructive"
        : positive && value > 0 ? "text-primary"
        : "text-foreground"
      }`}>
        {value}
      </span>
      <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">{label}</p>
      {sublabel && <p className="text-[9px] text-muted-foreground/70 mt-0.5">{sublabel}</p>}
    </div>
  );
}
