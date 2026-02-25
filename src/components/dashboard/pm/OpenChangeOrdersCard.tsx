import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardCard } from "@/components/dashboard/shared/DashboardCard";
import { FileText } from "lucide-react";

interface Props {
  projectId: string | null;
}

export function OpenChangeOrdersCard({ projectId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["pm-open-cos", projectId],
    queryFn: async () => {
      if (!projectId) return { open: 0, total: 0, pendingAmount: 0 };
      const { data: cos, error } = await supabase
        .from("change_orders")
        .select("id, status, amount")
        .eq("project_id", projectId);
      if (error) throw error;
      const open = (cos || []).filter(c => c.status === "pending" || c.status === "draft");
      const pendingAmount = open.reduce((sum, c) => sum + (c.amount || 0), 0);
      return { open: open.length, total: (cos || []).length, pendingAmount };
    },
    enabled: !!projectId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  return (
    <DashboardCard
      title="Change Orders"
      icon={FileText}
      loading={isLoading}
      variant="metric"
      helpText="Change orders in pending or draft status that need your action."
    >
      <div className={`text-4xl font-bold tabular-nums ${(data?.open ?? 0) > 0 ? "text-accent-foreground" : "text-foreground"}`}>
        {data?.open ?? 0}
      </div>
      <p className="text-xs text-muted-foreground">
        open · {data?.total ?? 0} total
        {(data?.pendingAmount ?? 0) > 0 && (
          <span className="ml-1 font-medium text-foreground">
            · ${data!.pendingAmount.toLocaleString("en-CA", { maximumFractionDigits: 0 })}
          </span>
        )}
      </p>
    </DashboardCard>
  );
}
