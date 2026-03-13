import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useUserRole } from '@/hooks/useUserRole';
import { NoAccess } from '@/components/NoAccess';
import { Loader2 } from 'lucide-react';
import { PlaybookList } from '@/components/playbooks/PlaybookList';
import { PlaybookEditor } from '@/components/playbooks/PlaybookEditor';
import { CreatePlaybookDialog } from '@/components/playbooks/CreatePlaybookDialog';
import { GeneratePlaybookDialog } from '@/components/playbooks/GeneratePlaybookDialog';
import {
  usePlaybookList, usePlaybookDetail, usePlaybookPerformance, usePlaybookMutations,
  usePlaybookPerformanceBatch,
} from '@/hooks/usePlaybooks';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Admin-only page — exposes org-wide playbook templates.
 * Route-level <AdminRoute> wrapper provides redirect + console warning;
 * this page-level gate is defence-in-depth to prevent data fetching before
 * the role check resolves.
 */
export default function Playbooks() {
  const { isAdmin, loading: roleLoading } = useUserRole();

  if (roleLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return (
      <Layout>
        <NoAccess message="Admin access required." />
      </Layout>
    );
  }

  return <PlaybooksContent />;
}

function PlaybooksContent() {
  const queryClient = useQueryClient();
  const { data: playbooks, isLoading: listLoading } = usePlaybookList();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);

  const { data: detail, isLoading: detailLoading } = usePlaybookDetail(selectedId);
  const { data: performance } = usePlaybookPerformance(selectedId);
  const { createPlaybook, updatePlaybook, duplicatePlaybook, archivePlaybook } = usePlaybookMutations();

  // Batch performance for all playbooks (used in list sidebar)
  const playbookIds = (playbooks ?? []).map(p => p.id);
  const { data: allPerformance } = usePlaybookPerformanceBatch(playbookIds);

  // Auto-select first playbook if none selected
  useEffect(() => {
    if (!selectedId && playbooks && playbooks.length > 0) {
      setSelectedId(playbooks[0].id);
    }
  }, [playbooks, selectedId]);

  // Build perf map for the list from batch performance
  const perfMap: Record<string, { variance_percent: number; projects_using: number }> = {};
  if (allPerformance) {
    for (const [id, perf] of Object.entries(allPerformance)) {
      if (perf) {
        perfMap[id] = {
          variance_percent: perf.variance_percent,
          projects_using: perf.projects_using,
        };
      }
    }
  }

  // Existing job types for suggestion chips
  const existingJobTypes = [...new Set((playbooks ?? []).map(p => p.job_type).filter(Boolean))];

  return (
    <Layout>
      <div className="flex h-[calc(100vh-64px)]">
        {/* Left panel — list */}
        <div className="w-[320px] shrink-0 border-r border-border/50 bg-card/50 flex flex-col">
          <PlaybookList
            playbooks={playbooks ?? []}
            isLoading={listLoading}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onCreateNew={() => setCreateOpen(true)}
            onGenerateAI={() => setGenerateOpen(true)}
            performance={perfMap}
          />
        </div>

        {/* Right panel — editor */}
        <div className="flex-1 min-w-0">
          <PlaybookEditor
            detail={detail}
            performance={performance}
            isLoading={detailLoading && !!selectedId}
            onSave={data =>
              updatePlaybook.mutate({
                playbook_id: data.playbook_id,
                name: data.name,
                job_type: data.job_type,
                description: data.description,
                phases: data.phases,
              })
            }
            onDuplicate={id => duplicatePlaybook.mutate({ playbook_id: id })}
            onArchive={id => {
              archivePlaybook.mutate(id);
              setSelectedId(null);
            }}
            isSaving={updatePlaybook.isPending}
          />
        </div>
      </div>

      <CreatePlaybookDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={data => {
          createPlaybook.mutate(
            {
              name: data.name,
              job_type: data.job_type,
              description: data.description,
              audience: data.audience,
              trade_id: data.trade_id,
              phases: data.phases as any,
            },
            {
              onSuccess: (result) => {
                setCreateOpen(false);
                const newId = (result as any)?.playbook?.id;
                if (newId) setSelectedId(newId);
              },
            }
          );
        }}
        isCreating={createPlaybook.isPending}
        existingJobTypes={existingJobTypes}
      />

      <GeneratePlaybookDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        onCreated={(id) => {
          queryClient.invalidateQueries({ queryKey: ['playbooks'] });
          setSelectedId(id);
        }}
      />
    </Layout>
  );
}
