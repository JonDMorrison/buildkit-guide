import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ReportSection {
  title: string;
  content: string;
}

export interface ReportMetric {
  label: string;
  value: string;
}

export interface ProgressReport {
  generated_at: string;
  report_period: string;
  project_name: string;
  recipient_type: "owner" | "gc";
  sections: ReportSection[];
  key_metrics: ReportMetric[];
  action_items: string[];
  next_week_preview: string;
}

export function useProgressReport() {
  const [report, setReport] = useState<ProgressReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateReport = useCallback(
    async (
      projectId: string,
      reportType: "weekly" | "milestone" = "weekly",
      recipientType: "owner" | "gc" = "owner"
    ) => {
      setIsGenerating(true);
      setError(null);
      setReport(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          "generate-report",
          {
            body: {
              project_id: projectId,
              report_type: reportType,
              recipient_type: recipientType,
            },
          }
        );

        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);

        setReport(data as ProgressReport);
      } catch (err: any) {
        setError(err.message || "Failed to generate report");
      } finally {
        setIsGenerating(false);
      }
    },
    []
  );

  const clearReport = useCallback(() => {
    setReport(null);
    setError(null);
  }, []);

  return { report, isGenerating, error, generateReport, clearReport };
}
