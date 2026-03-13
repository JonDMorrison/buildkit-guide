import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Archive, Layers, Sparkles, ChevronDown, ChevronRight } from 'lucide-react';
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

function audienceBadgeColor(audience: string) {
  if (audience === 'foreman') return 'bg-orange-100 text-orange-700 border-orange-200';
  if (audience === 'field') return 'bg-green-100 text-green-700 border-green-200';
  return 'bg-blue-100 text-blue-700 border-blue-200'; // office
}

const AUDIENCE_LABELS: Record<string, string> = {
  office: 'Office',
  foreman: 'Foreman',
  field: 'Field',
};

const AUDIENCE_ORDER = ['office', 'foreman', 'field'];

export function PlaybookList({
  playbooks, isLoading, selectedId, onSelect, onCreateNew, onGenerateAI, performance,
}: PlaybookListProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const toggleSection = (audience: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(audience)) next.delete(audience);
      else next.add(audience);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-2 p-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  // Group by audience
  const grouped: Record<string, PlaybookSummary[]> = {};
  for (const pb of playbooks) {
    const aud = pb.audience || 'office';
    if (!grouped[aud]) grouped[aud] = [];
    grouped[aud].push(pb);
  }

  // Sort within each group: non-archived first, then by updated_at desc
  for (const aud of Object.keys(grouped)) {
    grouped[aud].sort((a, b) => {
      if (a.is_archived !== b.is_archived) return a.is_archived ? 1 : -1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }

  const sectionsWithData = AUDIENCE_ORDER.filter(aud => grouped[aud]?.length > 0);

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
        <div className="p-2">
          {playbooks.length === 0 ? (
            <div className="p-8 text-center">
              <Layers className="h-8 w-8 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No playbooks yet</p>
              <p className="text-xs text-muted-foreground mt-1">Create your first operational playbook</p>
            </div>
          ) : (
            <div className="space-y-1">
              {sectionsWithData.map(aud => {
                const sectionPlaybooks = grouped[aud];
                const isCollapsed = collapsedSections.has(aud);

                return (
                  <div key={aud} className="mb-1">
                    {/* Section header */}
                    <button
                      onClick={() => toggleSection(aud)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                    >
                      {isCollapsed
                        ? <ChevronRight className="h-3 w-3" />
                        : <ChevronDown className="h-3 w-3" />}
                      {AUDIENCE_LABELS[aud] || aud}
                      <span className="ml-auto font-normal normal-case tracking-normal">{sectionPlaybooks.length}</span>
                    </button>

                    {/* Section items */}
                    {!isCollapsed && (
                      <div className="space-y-0.5">
                        {sectionPlaybooks.map(pb => {
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
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="text-sm font-medium text-foreground truncate">{pb.name}</p>
                                    {pb.is_default && (
                                      <Badge variant="secondary" className="text-[9px] h-4 px-1">Default</Badge>
                                    )}
                                    {pb.is_archived && (
                                      <Archive className="h-3 w-3 text-muted-foreground" />
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                    {/* Audience badge */}
                                    <span className={cn(
                                      'text-[9px] px-1.5 py-0.5 rounded border font-medium',
                                      audienceBadgeColor(pb.audience || 'office')
                                    )}>
                                      {AUDIENCE_LABELS[pb.audience] || pb.audience}
                                    </span>
                                    {/* Trade badge */}
                                    {pb.trade_name && (
                                      <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                                        {pb.trade_name}
                                      </Badge>
                                    )}
                                    {pb.job_type && (
                                      <p className="text-[11px] text-muted-foreground">{pb.job_type}</p>
                                    )}
                                  </div>
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
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
