import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface BriefingSection {
  title: string;
  priority: "critical" | "high" | "normal";
  items: string[];
}

export interface MorningBriefing {
  generated_at: string;
  headline: string;
  sections: BriefingSection[];
  watch_out_for: string;
  crew_summary: string;
  safety_note: string;
}

export function useMorningBriefing(projectId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["morning-briefing", projectId],
    queryFn: async (): Promise<MorningBriefing> => {
      const { data, error } = await supabase.functions.invoke(
        "morning-briefing",
        { body: { project_id: projectId } }
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as MorningBriefing;
    },
    enabled: !!projectId && !!user,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });
}
