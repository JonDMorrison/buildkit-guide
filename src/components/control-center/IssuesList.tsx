import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { SeveritySection } from "./SeveritySection";
import { CheckCircle2 } from "lucide-react";
import type { SystemIssue } from "./IssueRow";

export function useSystemIssues() {
  const { currentProjectId } = useCurrentProject();

  return useQuery({
    queryKey: ['system-integrity-issues', currentProjectId],
    queryFn: async () => {
      if (!currentProjectId) return [];
      const { data, error } = await supabase.rpc(
        'rpc_get_system_integrity_issues' as any,
        { p_project_id: currentProjectId }
      );
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as SystemIssue[];
    },
    enabled: !!currentProjectId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

export function IssuesList() {
  const { currentProjectId } = useCurrentProject();
  const { data: issues, isLoading } = useSystemIssues();

  const critical = issues?.filter(i => i.severity === 'critical') ?? [];
  const warnings = issues?.filter(i => i.severity === 'warning') ?? [];
  const info = issues?.filter(i => i.severity === 'info') ?? [];

  if (!currentProjectId) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Select a project to see system issues
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-3 space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-md" />
        ))}
      </div>
    );
  }

  if (!issues || issues.length === 0) {
    return (
      <div className="p-6 text-center">
        <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-status-complete" />
        <p className="text-sm text-muted-foreground">No issues detected</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[360px]">
      <div className="divide-y divide-border/50">
        <SeveritySection label="Critical" issues={critical} />
        <SeveritySection label="Warnings" issues={warnings} />
        <SeveritySection label="Informational" issues={info} />
      </div>
    </ScrollArea>
  );
}
