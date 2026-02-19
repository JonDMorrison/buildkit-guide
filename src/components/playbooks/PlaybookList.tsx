import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Archive, Layers, Sparkles } from 'lucide-react';
import type { PlaybookSummary } from '@/hooks/usePlaybooks';

interface PlaybookListProps {
  playbooks: PlaybookSummary[];
  isLoading: boolean;
  selectedId?: string | null;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
  onGenerateAI?: () => void;
  performance: Record<string, { variance_percent: number; projects_using: number }>;
}

function varianceColor(v: number) {
  if (Math.abs(v) <= 10) return 'bg-status-complete/15 text-status-complete';
  if (Math.abs(v) <= 25) return 'bg-status-warning/15 text-status-warning';
  return 'bg-status-issue/15 text-status-issue';
}

export function PlaybookList({
  playbooks, isLoading, selectedId, onSelect, onCreateNew, onGenerateAI, performance,
}: PlaybookListProps) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Playbooks</h2>
          <p className="text-[11px] text-muted-foreground">{playbooks.length} templates</p>
        </div>
        <div className="flex gap-1.5">
          {onGenerateAI && (
            <Button size="sm" variant="outline" onClick={onGenerateAI} className="h-8 gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              AI
            </Button>
          )}
          <Button size="sm" onClick={onCreateNew} className="h-8 gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            New
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {playbooks.length === 0 ? (
            <div className="p-8 text-center">
              <Layers className="h-8 w-8 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No playbooks yet</p>
              <p className="text-xs text-muted-foreground mt-1">Create your first operational playbook</p>
            </div>
          ) : playbooks.map(pb => {
            const perf = performance[pb.id];
            const variance = perf?.variance_percent ?? 0;
            const usageCount = perf?.projects_using ?? 0;

            return (
              <button
                key={pb.id}
                onClick={() => onSelect(pb.id)}
                className={cn(
                  'w-full text-left rounded-xl p-3 transition-all',
                  'hover:bg-muted/50 border border-transparent',
                  selectedId === pb.id && 'bg-primary/[0.06] border-primary/20',
                  pb.is_archived && 'opacity-50',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-foreground truncate">{pb.name}</p>
                      {pb.is_default && (
                        <Badge variant="secondary" className="text-[9px] h-4 px-1">Default</Badge>
                      )}
                      {pb.is_archived && (
                        <Archive className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                    {pb.job_type && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">{pb.job_type}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0 font-mono">
                    v{pb.version}
                  </Badge>
                </div>

                <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                  <span>{pb.phase_count} phases · {pb.task_count} tasks</span>
                  {usageCount > 0 && <span>Used in {usageCount} projects</span>}
                  {usageCount > 0 && variance !== 0 && (
                    <Badge className={cn('text-[9px] h-4 px-1', varianceColor(variance))}>
                      {variance > 0 ? '+' : ''}{variance}%
                    </Badge>
                  )}
                </div>

                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  Updated {formatDistanceToNow(new Date(pb.updated_at), { addSuffix: true })}
                </p>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
