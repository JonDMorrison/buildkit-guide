import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMemo } from "react";

export interface ProactiveAlert {
  id: string;
  type: string;
  severity: "critical" | "high" | "normal";
  title: string;
  message: string;
  action_label: string | null;
  action_url: string | null;
  detected_at: string;
}

export interface AlertsResponse {
  generated_at: string;
  alert_count: number;
  alerts: ProactiveAlert[];
}

export function useProactiveAlerts(projectId: string | null) {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["proactive-alerts", projectId],
    queryFn: async (): Promise<AlertsResponse> => {
      const { data, error } = await supabase.functions.invoke(
        "detect-alerts",
        { body: { project_id: projectId } }
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as AlertsResponse;
    },
    enabled: !!projectId && !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    retry: 1,
  });

  const alerts = query.data?.alerts ?? [];
  const alertCount = alerts.length;
  const criticalCount = useMemo(
    () => alerts.filter((a) => a.severity === "critical").length,
    [alerts]
  );

  return {
    ...query,
    alerts,
    alertCount,
    criticalCount,
    generatedAt: query.data?.generated_at ?? null,
  };
}
