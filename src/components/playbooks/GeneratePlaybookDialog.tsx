import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useOrganization } from '@/hooks/useOrganization';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sparkles, Loader2, Search, CheckCircle2, AlertTriangle,
  Clock, Layers, ChevronDown, ChevronRight, Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface GeneratedPhase {
  name: string;
  description: string;
  sequence_order: number;
  tasks: GeneratedTask[];
}

interface GeneratedTask {
  title: string;
  description: string;
  role_type: string | null;
  expected_hours_low: number;
  expected_hours_high: number;
  required: boolean;
  frequency_percent: number;
}

interface PlaybookSuggestion {
  name: string;
  job_type: string;
  description: string;
  confidence_score: number;
  data_quality_note: string;
  phases: GeneratedPhase[];
  total_hours_band: { low: number; high: number };
  variance_band_percent: { low: number; high: number };
  projects_analyzed: number;
  generated_at: string;
  organization_id: string;
}

interface GeneratePlaybookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (playbookId: string) => void;
  /** Pre-fill the job type input when opened from project creation */
  initialJobType?: string;
}

export function GeneratePlaybookDialog({ open, onOpenChange, onCreated, initialJobType }: GeneratePlaybookDialogProps) {
  const { activeOrganizationId } = useOrganization();
  const { toast } = useToast();
  const [jobType, setJobType] = useState(initialJobType || '');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [suggestion, setSuggestion] = useState<PlaybookSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set());

  // Sync initialJobType when dialog opens
  useEffect(() => {
    if (open && initialJobType) {
      setJobType(initialJobType);
      setSuggestion(null);
      setError(null);
    }
  }, [open, initialJobType]);

  const handleGenerate = async () => {
    if (!jobType.trim()) return;
    setLoading(true);
    setError(null);
    setSuggestion(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-playbook', {
        body: { job_type: jobType.trim() },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      setSuggestion(data as PlaybookSuggestion);
      // Auto-expand all phases
      setExpandedPhases(new Set((data as PlaybookSuggestion).phases.map((_: any, i: number) => i)));
    } catch (e: any) {
      setError(e.message || 'No similar past projects found for this job type yet. Try another job type or start from an existing playbook.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!suggestion || !activeOrganizationId) return;
    setCreating(true);

    try {
      const p_phases = suggestion.phases.map((phase, phaseIdx) => ({
        name: phase.name,
        description: phase.description ?? '',
        sequence_order: phase.sequence_order ?? phaseIdx + 1,
        tasks: phase.tasks.map((t, idx) => ({
          title: t.title,
          description: t.description ?? '',
          role_type: t.role_type ?? 'laborer',
          expected_hours_low: t.expected_hours_low ?? 0,
          expected_hours_high: t.expected_hours_high ?? 0,
          required_flag: t.required,
          allow_skip: !t.required,
          density_weight: 1,
          sequence_order: idx + 1,
        })),
      }));

      const { data, error: rpcErr } = await supabase.rpc('rpc_create_playbook', {
        p_organization_id: activeOrganizationId,
        p_name: suggestion.name,
        p_job_type: suggestion.job_type,
        p_description: suggestion.description,
        p_phases: p_phases as any,
      });

      if (rpcErr) throw rpcErr;

      const newId = (data as any)?.playbook?.id;

      toast({
        title: 'Workflow created',
        description: `"${suggestion.name}" is ready. You can edit it before applying.`,
      });

      onOpenChange(false);
      if (newId) onCreated(newId);
      setSuggestion(null);
      setJobType('');
    } catch (e: any) {
      toast({
        title: 'Failed to create playbook',
        description: e.message,
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const togglePhase = (idx: number) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const confidenceColor = (score: number) =>
    score >= 70 ? 'text-status-complete' : score >= 40 ? 'text-status-warning' : 'text-status-issue';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Create a starter workflow
          </DialogTitle>
          <DialogDescription>
            We'll analyze recent {jobType ? <span className="font-medium text-foreground">{jobType}</span> : null} projects to propose phases, tasks, and hour ranges. You can edit everything before applying.
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Input */}
        {!suggestion && !loading && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Job Type</label>
              <div className="flex gap-2">
                <Input
                  value={jobType}
                  onChange={(e) => setJobType(e.target.value)}
                  placeholder="e.g. Tenant Improvement, Residential, Commercial"
                  className="flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                />
                <Button onClick={handleGenerate} disabled={!jobType.trim()} className="gap-1.5">
                  <Search className="h-4 w-4" />
                  Find patterns
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Powered by analysis of your project history.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-foreground">Analyzing past jobs…</p>
            <p className="text-xs text-muted-foreground/60">This may take 10–20 seconds</p>
          </div>
        )}

        {/* Step 2: Review */}
        {suggestion && !loading && (
          <div className="flex-1 min-h-0 flex flex-col gap-4">
            {/* Summary header */}
            <div className="grid grid-cols-4 gap-3">
              <SummaryCard
                label="Confidence"
                value={`${suggestion.confidence_score}%`}
                icon={<Shield className="h-3.5 w-3.5" />}
                className={confidenceColor(suggestion.confidence_score)}
              />
              <SummaryCard
                label="Projects"
                value={String(suggestion.projects_analyzed)}
                icon={<Layers className="h-3.5 w-3.5" />}
              />
              <SummaryCard
                label="Hours Band"
                value={`${suggestion.total_hours_band.low}–${suggestion.total_hours_band.high}`}
                icon={<Clock className="h-3.5 w-3.5" />}
              />
              <SummaryCard
                label="Variance"
                value={`±${Math.round((suggestion.variance_band_percent.high - suggestion.variance_band_percent.low) / 2)}%`}
                icon={<AlertTriangle className="h-3.5 w-3.5" />}
              />
            </div>

            {suggestion.data_quality_note && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                {suggestion.data_quality_note}
              </p>
            )}

            <Separator />

            {/* Phase/Task detail */}
            <ScrollArea className="flex-1 min-h-0 -mx-1 px-1">
              <div className="space-y-2 pb-2">
                {suggestion.phases.map((phase, idx) => (
                  <Card key={idx} className="border-border/50">
                    <button
                      className="w-full text-left px-4 py-3 flex items-center gap-2"
                      onClick={() => togglePhase(idx)}
                    >
                      {expandedPhases.has(idx)
                        ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                      <span className="text-sm font-medium flex-1">{phase.name}</span>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {phase.tasks.length} tasks
                      </Badge>
                    </button>

                    {expandedPhases.has(idx) && (
                      <CardContent className="pt-0 pb-3 px-4">
                        {phase.description && (
                          <p className="text-xs text-muted-foreground mb-2">{phase.description}</p>
                        )}
                        <div className="space-y-1.5">
                          {phase.tasks.map((task, tIdx) => (
                            <div
                              key={tIdx}
                              className="flex items-center gap-2 text-xs py-1.5 px-2 rounded bg-muted/30"
                            >
                              <CheckCircle2 className={cn(
                                "h-3.5 w-3.5 shrink-0",
                                task.required ? "text-primary" : "text-muted-foreground/40"
                              )} />
                              <span className="flex-1 text-foreground truncate">{task.title}</span>
                              {task.role_type && (
                                <Badge variant="secondary" className="text-[9px] h-4 px-1.5 shrink-0">
                                  {task.role_type}
                                </Badge>
                              )}
                              <span className="text-muted-foreground tabular-nums shrink-0">
                                {task.expected_hours_low}–{task.expected_hours_high}h
                              </span>
                              <span className="text-muted-foreground/50 tabular-nums shrink-0 w-8 text-right">
                                {task.frequency_percent}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            </ScrollArea>

            {/* Actions */}
            <div className="flex gap-3 pt-2 border-t border-border/50">
              <Button
                variant="outline"
                onClick={() => { setSuggestion(null); setError(null); }}
                className="gap-1.5"
                disabled={creating}
              >
                ← Re-analyze
              </Button>
              <Button
                onClick={handleApprove}
                className="flex-1 gap-1.5"
                disabled={creating}
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Create workflow
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard({
  label, value, icon, className,
}: {
  label: string; value: string; icon: React.ReactNode; className?: string;
}) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2.5 text-center">
      <div className={cn("flex items-center justify-center gap-1 text-muted-foreground", className)}>
        {icon}
      </div>
      <p className={cn("text-sm font-semibold mt-1 tabular-nums", className)}>{value}</p>
      <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">{label}</p>
    </div>
  );
}
