import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  BookOpen, Sparkles, TrendingUp, TrendingDown, Minus,
  Clock, Users, ChevronRight, Layers, ArrowLeft, Wand2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import type { PlaybookSummary } from '@/hooks/usePlaybooks';
import { GeneratePlaybookDialog } from './GeneratePlaybookDialog';

export interface AppliedPlaybookInfo {
  id: string;
  name: string;
  isDefault: boolean;
  jobType: string;
}

interface PlaybookSuggestionStepProps {
  jobType?: string;
  onApply: (playbookId: string, info: AppliedPlaybookInfo) => void;
  onSkip: () => void;
  onBack: () => void;
}

interface PlaybookWithPerf extends PlaybookSummary {
  variance_percent: number;
  projects_using: number;
  total_hours_low: number;
  total_hours_high: number;
  is_recommended: boolean;
  is_default_match: boolean;
  is_type_match: boolean;
}

export function PlaybookSuggestionStep({
  jobType, onApply, onSkip, onBack,
}: PlaybookSuggestionStepProps) {
  const { activeOrganizationId } = useOrganization();
  const [playbooks, setPlaybooks] = useState<PlaybookWithPerf[]>([]);
  const [loading, setLoading] = useState(true);
  const [browsing, setBrowsing] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [newlyCreatedId, setNewlyCreatedId] = useState<string | null>(null);

  const fetchPlaybooks = useCallback(async () => {
    if (!activeOrganizationId) return;
    setLoading(true);
    try {
      const { data: pbList } = await supabase.rpc(
        'rpc_list_playbooks_by_org' as any,
        { p_organization_id: activeOrganizationId }
      );

      const list = (Array.isArray(pbList) ? pbList : []) as PlaybookSummary[];
      const active = list.filter(p => !p.is_archived);

      const withPerf: PlaybookWithPerf[] = await Promise.all(
        active.map(async (pb) => {
          let variance = 0;
          let projectsUsing = 0;
          let totalLow = 0;
          let totalHigh = 0;

          try {
            const { data: perf } = await supabase.rpc(
              'rpc_get_playbook_performance' as any,
              { p_playbook_id: pb.id }
            );
            if (perf) {
              variance = perf.variance_percent ?? 0;
              projectsUsing = perf.projects_using ?? 0;
            }
          } catch { /* skip perf errors */ }

          try {
            const { data: phases } = await supabase
              .from('playbook_phases')
              .select('id')
              .eq('playbook_id', pb.id);
            const phaseIds = (phases ?? []).map(p => p.id);
            if (phaseIds.length > 0) {
              const { data: tasks } = await supabase
                .from('playbook_tasks')
                .select('expected_hours_low, expected_hours_high')
                .in('playbook_phase_id', phaseIds);
              (tasks ?? []).forEach(t => {
                totalLow += Number(t.expected_hours_low) || 0;
                totalHigh += Number(t.expected_hours_high) || 0;
              });
            }
          } catch { /* skip */ }

          const typeMatch = !!(jobType && pb.job_type &&
            pb.job_type.toLowerCase().includes(jobType.toLowerCase()));

          // Default is org-wide; only treat as recommended if job_type also matches
          const defaultAndMatches = pb.is_default && typeMatch;

          return {
            ...pb,
            variance_percent: variance,
            projects_using: projectsUsing,
            total_hours_low: totalLow,
            total_hours_high: totalHigh,
            is_recommended: typeMatch,
            is_default_match: defaultAndMatches,
            is_type_match: typeMatch,
          };
        })
      );

      // Deterministic sort:
      // 1. newlyCreated first
      // 2. matching-default (is_default + job_type match)
      // 3. other job_type matches, ordered by lowest variance
      // 4. non-matching playbooks by name
      withPerf.sort((a, b) => {
        // 1. Newly created always wins
        if (newlyCreatedId) {
          if (a.id === newlyCreatedId) return -1;
          if (b.id === newlyCreatedId) return 1;
        }

        // 2. Matching default (is_default + job_type match)
        const aDefault = a.is_default_match ? 1 : 0;
        const bDefault = b.is_default_match ? 1 : 0;
        if (aDefault !== bDefault) return bDefault - aDefault;

        // 3. Job-type matches above non-matches
        if (a.is_type_match !== b.is_type_match) return a.is_type_match ? -1 : 1;

        // 4. Within same tier: lowest absolute variance first (tightest estimates win)
        const aVar = Math.abs(a.variance_percent);
        const bVar = Math.abs(b.variance_percent);
        if (aVar !== bVar) return aVar - bVar;

        // 5. Deterministic tie-breaker: name ascending
        return a.name.localeCompare(b.name);
      });

      setPlaybooks(withPerf);
    } catch {
      setPlaybooks([]);
    } finally {
      setLoading(false);
    }
  }, [activeOrganizationId, jobType, newlyCreatedId]);

  useEffect(() => {
    fetchPlaybooks();
  }, [fetchPlaybooks]);

  const handleGenerated = (playbookId: string) => {
    setNewlyCreatedId(playbookId);
    setGenerateOpen(false);
    // fetchPlaybooks will re-run due to newlyCreatedId change
  };

  // Auto-preselect priority: newlyCreated > matching-default > first type-match
  const recommended = playbooks.find(p => p.id === newlyCreatedId)
    || playbooks.find(p => p.is_default_match)
    || playbooks.find(p => p.is_type_match);
  const others = playbooks.filter(p => p !== recommended);

  if (loading) {
    return (
      <div className="space-y-4 py-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 animate-pulse text-primary" />
          Finding the best playbook match...
        </div>
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-10 rounded-lg" />
      </div>
    );
  }

  // No playbooks at all
  if (playbooks.length === 0) {
    return (
      <>
      <div className="space-y-4 py-2">
        <div className="text-center py-6">
          <BookOpen className="h-8 w-8 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm font-medium text-foreground">Start fast with a workflow</p>
          <p className="text-xs text-muted-foreground/60 mt-1 max-w-[280px] mx-auto">
            {jobType
              ? `Choose an existing playbook or build a starter workflow from past ${jobType} projects.`
              : 'Create playbooks in the Playbook Console to auto-populate project tasks.'}
          </p>
        </div>
        {jobType && (
          <div className="space-y-1.5">
            <Button
              onClick={() => setGenerateOpen(true)}
              className="w-full gap-1.5"
            >
              <Wand2 className="h-4 w-4" />
              Build from past jobs
            </Button>
            <p className="text-[10px] text-muted-foreground/60 text-center">
              Uses your recent projects to suggest phases, tasks, and hour ranges.
            </p>
          </div>
        )}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Button variant="ghost" onClick={onSkip} className="flex-1 text-muted-foreground">
            Skip for now
          </Button>
        </div>
      </div>
      <GeneratePlaybookDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        onCreated={handleGenerated}
        initialJobType={jobType}
      />
      </>
    );
  }

  // Browse all view
  if (browsing) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setBrowsing(false)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to recommendation
          </button>
          <span className="text-xs text-muted-foreground">{playbooks.length} playbooks</span>
        </div>

        <ScrollArea className="max-h-[320px]">
          <div className="space-y-2 pr-2">
            {playbooks.map(pb => (
              <PlaybookOptionCard
                key={pb.id}
                playbook={pb}
                onApply={(info) => onApply(info.id, info)}
              />
            ))}
          </div>
        </ScrollArea>

        <div className="flex gap-3 pt-1">
          <Button variant="outline" onClick={onBack} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Button variant="ghost" onClick={onSkip} className="flex-1 text-muted-foreground">
            Start from blank
          </Button>
        </div>
      </div>
    );
  }

  // Recommendation view
  return (
    <div className="space-y-4 py-1">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-foreground">
          {recommended ? 'Recommended Playbook' : 'Available Playbooks'}
        </span>
      </div>

      {/* Recommended card */}
      {recommended && (
        <Card className="border-primary/30 bg-primary/[0.03] overflow-hidden">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{recommended.name}</p>
                  <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                    v{recommended.version}
                  </Badge>
                </div>
                {recommended.job_type && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">{recommended.job_type}</p>
                )}
              </div>
              <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] shrink-0">
                {recommended.id === newlyCreatedId ? 'Just created' : recommended.is_default_match ? 'Default · Best match' : 'Best match'}
              </Badge>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <StatPill
                icon={<Clock className="h-3.5 w-3.5" />}
                label="Expected"
                value={`${recommended.total_hours_low}–${recommended.total_hours_high}h`}
              />
              <StatPill
                icon={recommended.variance_percent > 10 ? <TrendingUp className="h-3.5 w-3.5" /> :
                  recommended.variance_percent < -10 ? <TrendingDown className="h-3.5 w-3.5" /> :
                  <Minus className="h-3.5 w-3.5" />}
                label="Avg variance"
                value={`${recommended.variance_percent > 0 ? '+' : ''}${recommended.variance_percent}%`}
                color={
                  Math.abs(recommended.variance_percent) <= 10 ? 'text-status-complete' :
                  Math.abs(recommended.variance_percent) <= 25 ? 'text-status-warning' :
                  'text-status-issue'
                }
              />
              <StatPill
                icon={<Users className="h-3.5 w-3.5" />}
                label="Used in"
                value={`${recommended.projects_using} projects`}
              />
            </div>

            <div className="text-[10px] text-muted-foreground/60">
              {recommended.phase_count} phases · {recommended.task_count} tasks
            </div>

            <Button onClick={() => onApply(recommended.id, { id: recommended.id, name: recommended.name, isDefault: recommended.is_default, jobType: recommended.job_type })} className="w-full gap-1.5">
              <BookOpen className="h-4 w-4" />
              Apply Recommended
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onBack} size="sm" className="gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Button>
        {playbooks.length > 1 && (
          <Button
            variant="outline"
            onClick={() => setBrowsing(true)}
            size="sm"
            className="gap-1.5"
          >
            <Layers className="h-3.5 w-3.5" />
            Browse All ({playbooks.length})
          </Button>
        )}
        {jobType && (
          <Button
            variant="outline"
            onClick={() => setGenerateOpen(true)}
            size="sm"
            className="gap-1.5"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Build from past jobs
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={onSkip}
          size="sm"
          className="text-muted-foreground ml-auto"
        >
          Start from blank
        </Button>
      </div>

      <GeneratePlaybookDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        onCreated={handleGenerated}
        initialJobType={jobType}
      />
    </div>
  );
}

/* ── Stat Pill ── */
function StatPill({
  icon, label, value, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg bg-muted/40 px-2.5 py-2 text-center">
      <div className={cn('flex items-center justify-center gap-1 text-muted-foreground', color)}>
        {icon}
      </div>
      <p className={cn('text-xs font-semibold mt-1 tabular-nums', color)}>{value}</p>
      <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">{label}</p>
    </div>
  );
}

/* ── Option Card (browse) ── */
function PlaybookOptionCard({
  playbook, onApply,
}: {
  playbook: PlaybookWithPerf;
  onApply: (info: AppliedPlaybookInfo) => void;
}) {
  return (
    <Card className={cn(
      'border-border/50 hover:border-border transition-colors cursor-pointer group',
      playbook.is_type_match && 'border-primary/20',
    )}>
      <CardContent className="p-3 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-foreground truncate">{playbook.name}</p>
            <Badge variant="outline" className="text-[9px] font-mono shrink-0">v{playbook.version}</Badge>
            {playbook.is_default_match && (
              <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] shrink-0">
                Default
              </Badge>
            )}
            {playbook.is_type_match && !playbook.is_default_match && (
              <Badge variant="outline" className="text-[9px] shrink-0">
                Matches job type
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
            <span>{playbook.phase_count} phases · {playbook.task_count} tasks</span>
            <span className="tabular-nums">{playbook.total_hours_low}–{playbook.total_hours_high}h</span>
            {playbook.projects_using > 0 && <span>{playbook.projects_using} projects</span>}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => { e.stopPropagation(); onApply({ id: playbook.id, name: playbook.name, isDefault: playbook.is_default, jobType: playbook.job_type }); }}
        >
          Apply
        </Button>
      </CardContent>
    </Card>
  );
}
