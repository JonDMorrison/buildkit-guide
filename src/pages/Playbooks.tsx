import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { PlaybookList } from '@/components/playbooks/PlaybookList';
import { PlaybookEditor } from '@/components/playbooks/PlaybookEditor';
import { CreatePlaybookDialog } from '@/components/playbooks/CreatePlaybookDialog';
import {
  usePlaybookList, usePlaybookDetail, usePlaybookPerformance, usePlaybookMutations,
} from '@/hooks/usePlaybooks';

export default function Playbooks() {
  const { data: playbooks, isLoading: listLoading } = usePlaybookList();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: detail, isLoading: detailLoading } = usePlaybookDetail(selectedId);
  const { data: performance } = usePlaybookPerformance(selectedId);
  const { createPlaybook, updatePlaybook, duplicatePlaybook, archivePlaybook } = usePlaybookMutations();

  // Auto-select first playbook if none selected
  useEffect(() => {
    if (!selectedId && playbooks && playbooks.length > 0) {
      setSelectedId(playbooks[0].id);
    }
  }, [playbooks, selectedId]);

  // Build perf map for the list
  const perfMap: Record<string, { variance_percent: number; projects_using: number }> = {};
  if (performance && selectedId) {
    perfMap[selectedId] = {
      variance_percent: performance.variance_percent,
      projects_using: performance.projects_using,
    };
  }

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
          createPlaybook.mutate(data, {
            onSuccess: (result: any) => {
              setCreateOpen(false);
              const newId = result?.playbook?.id;
              if (newId) setSelectedId(newId);
            },
          });
        }}
        isCreating={createPlaybook.isPending}
      />
    </Layout>
  );
}
