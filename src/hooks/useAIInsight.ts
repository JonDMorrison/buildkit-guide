import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

export interface AIInsightContent {
  what_changed: string;
  what_it_means: string;
  what_to_do: string;
}

interface AIInsightState {
  content: AIInsightContent | null;
  loading: boolean;
  generating: boolean;
  error: string | null;
  snapshotDate: string | null;
  cached: boolean;
}

export const useAIInsight = (projectId: string | null, enabled = true) => {
  const { activeOrganizationId } = useOrganization();
  const [state, setState] = useState<AIInsightState>({
    content: null,
    loading: true,
    generating: false,
    error: null,
    snapshotDate: null,
    cached: false,
  });

  // Fetch latest cached insight from the table
  const fetchCached = useCallback(async () => {
    if (!activeOrganizationId || !enabled) {
      setState(s => ({ ...s, loading: false }));
      return;
    }

    setState(s => ({ ...s, loading: true, error: null }));

    let query = supabase
      .from("ai_insights" as any)
      .select("content, snapshot_date, created_at")
      .eq("organization_id", activeOrganizationId)
      .eq("insight_type", "weekly_summary")
      .order("snapshot_date", { ascending: false })
      .limit(1);

    if (projectId) {
      query = query.eq("project_id", projectId);
    } else {
      query = query.is("project_id", null);
    }

    const { data, error } = await query;

    if (error) {
      setState(s => ({ ...s, loading: false, error: error.message }));
      return;
    }

    const row = (data as any)?.[0];
    if (row) {
      setState({
        content: row.content as AIInsightContent,
        loading: false,
        generating: false,
        error: null,
        snapshotDate: row.snapshot_date,
        cached: true,
      });
    } else {
      setState(s => ({ ...s, loading: false, content: null }));
    }
  }, [activeOrganizationId, projectId, enabled]);

  useEffect(() => { fetchCached(); }, [fetchCached]);

  // Generate (or regenerate) insight via edge function
  const generate = useCallback(async () => {
    if (!activeOrganizationId) return;

    setState(s => ({ ...s, generating: true, error: null }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const res = await supabase.functions.invoke("generate-insights", {
        body: {
          organization_id: activeOrganizationId,
          project_id: projectId || null,
          insight_type: "weekly_summary",
        },
      });

      if (res.error) throw new Error(res.error.message || "Failed to generate insight");

      const data = res.data;
      if (data?.content) {
        setState({
          content: data.content,
          loading: false,
          generating: false,
          error: null,
          snapshotDate: data.snapshot_date || null,
          cached: data.cached || false,
        });
      } else if (data?.message) {
        setState(s => ({ ...s, generating: false, error: data.message }));
      }
    } catch (e: any) {
      setState(s => ({ ...s, generating: false, error: e.message }));
    }
  }, [activeOrganizationId, projectId]);

  return { ...state, generate, refetch: fetchCached };
};
