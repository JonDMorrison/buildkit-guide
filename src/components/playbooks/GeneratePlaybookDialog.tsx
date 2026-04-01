import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  X, ArrowUp, ArrowDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Trade {
  id: string;
  name: string;
  trade_type: string | null;
}

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

const AUDIENCE_OPTIONS = [
  { value: 'office', label: 'Office', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'foreman', label: 'Foreman', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'field', label: 'Field', color: 'bg-green-100 text-green-700 border-green-200' },
];

export function GeneratePlaybookDialog({ open, onOpenChange, onCreated, initialJobType }: GeneratePlaybookDialogProps) {
  const { activeOrganizationId } = useOrganization();
  const { toast } = useToast();
  const [jobType, setJobType] = useState(initialJobType || '');
  const [audience, setAudience] = useState('office');
  const [tradeId, setTradeId] = useState<string | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [suggestion, setSuggestion] = useState<PlaybookSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set());
  const [editingPhase, setEditingPhase] = useState<number | null>(null);
  const [editingTask, setEditingTask] = useState<{ phase: number; task: number } | null>(null);

  // Mutation helpers for editing suggestion in-place
  const updatePhases = (updater: (phases: GeneratedPhase[]) => GeneratedPhase[]) => {
    setSuggestion(prev => prev ? { ...prev, phases: updater([...prev.phases]) } : prev);
  };

  const updatePhaseName = (idx: number, name: string) => {
    updatePhases(phases => { phases[idx] = { ...phases[idx], name }; return phases; });
  };

  const updateTaskTitle = (phaseIdx: number, taskIdx: number, title: string) => {
    updatePhases(phases => {
      const tasks = [...phases[phaseIdx].tasks];
      tasks[taskIdx] = { ...tasks[taskIdx], title };
      phases[phaseIdx] = { ...phases[phaseIdx], tasks };
      return phases;
    });
  };

  const deletePhase = (idx: number) => {
    updatePhases(phases => phases.filter((_, i) => i !== idx));
    setExpandedPhases(prev => {
      const next = new Set<number>();
      for (const v of prev) {
        if (v < idx) next.add(v);
        else if (v > idx) next.add(v - 1);
      }
      return next;
    });
  };

  const deleteTask = (phaseIdx: number, taskIdx: number) => {
    updatePhases(phases => {
      const tasks = phases[phaseIdx].tasks.filter((_, i) => i !== taskIdx);
      phases[phaseIdx] = { ...phases[phaseIdx], tasks };
      return phases;
    });
  };

  const movePhase = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    updatePhases(phases => {
      if (target < 0 || target >= phases.length) return phases;
      [phases[idx], phases[target]] = [phases[target], phases[idx]];
      return phases;
    });
    setExpandedPhases(prev => {
      const next = new Set<number>();
      for (const v of prev) {
        if (v === idx) next.add(target);
        else if (v === target) next.add(idx);
        else next.add(v);
      }
      return next;
    });
  };

  // Load trades when dialog opens
  useEffect(() => {
    if (!open || !activeOrganizationId) return;
    supabase
      .from('trades')
      .select('id, name, trade_type')
      .eq('organization_id', activeOrganizationId)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setTrades(data ?? []));
  }, [open, activeOrganizationId]);

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
      const tradeName = trades.find(t => t.id === tradeId)?.name ?? null;
      const { data, error: fnError } = await supabase.functions.invoke('generate-playbook', {
        body: {
          job_type: jobType.trim(),
          audience,
          trade_name: tradeName,
        },
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
        p_audience: audience,
        p_trade_id: tradeId || null,
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
            {/* Audience selector */}
            <div className="space-y-1.5">
              <Label>Audience</Label>
              <div className="flex gap-2">
                {AUDIENCE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAudience(opt.value)}
                    className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                      audience === opt.value
                        ? opt.color + ' border-current'
                        : 'border-border text-muted-foreground hover:border-border/80'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Trade selector */}
            <div className="space-y-1.5">
              <Label>Trade (optional)</Label>
              <Select value={tradeId ?? 'none'} onValueChange={v => setTradeId(v === 'none' ? null : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="All trades / General" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">All trades / General</SelectItem>
                  {trades.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Job Type */}
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

            {/* Phase/Task detail — scrollable + editable */}
            <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1">
              <div className="space-y-2 pb-2">
                {suggestion.phases.map((phase, idx) => (
                  <Card key={idx} className="border-border/50">
                    <div className="flex items-center px-4 py-3 gap-1">
                      <button
                        className="flex items-center gap-2 flex-1 min-w-0 text-left"
                        onClick={() => togglePhase(idx)}
                      >
                        {expandedPhases.has(idx)
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                        {editingPhase === idx ? (
                          <Input
                            autoFocus
                            value={phase.name}
                            onClick={e => e.stopPropagation()}
                            onChange={e => updatePhaseName(idx, e.target.value)}
                            onBlur={() => setEditingPhase(null)}
                            onKeyDown={e => { if (e.key === 'Enter') setEditingPhase(null); }}
                            className="h-7 text-sm font-medium py-0"
                          />
                        ) : (
                          <span
                            className="text-sm font-medium flex-1 truncate cursor-text"
                            onDoubleClick={(e) => { e.stopPropagation(); setEditingPhase(idx); }}
                          >
                            {phase.name}
                          </span>
                        )}
                      </button>
                      <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                        {phase.tasks.length} tasks
                      </Badge>
                      <button
                        onClick={(e) => { e.stopPropagation(); movePhase(idx, -1); }}
                        disabled={idx === 0}
                        className="p-1 rounded hover:bg-muted disabled:opacity-30 shrink-0"
                        title="Move up"
                      >
                        <ArrowUp className="h-3 w-3 text-muted-foreground" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); movePhase(idx, 1); }}
                        disabled={idx === suggestion.phases.length - 1}
                        className="p-1 rounded hover:bg-muted disabled:opacity-30 shrink-0"
                        title="Move down"
                      >
                        <ArrowDown className="h-3 w-3 text-muted-foreground" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deletePhase(idx); }}
                        className="p-1 rounded hover:bg-destructive/10 shrink-0"
                        title="Remove phase"
                      >
                        <X className="h-3.5 w-3.5 text-destructive/70" />
                      </button>
                    </div>

                    {expandedPhases.has(idx) && (
                      <CardContent className="pt-0 pb-3 px-4">
                        {phase.description && (
                          <p className="text-xs text-muted-foreground mb-2">{phase.description}</p>
                        )}
                        <div className="space-y-1.5">
                          {phase.tasks.map((task, tIdx) => (
                            <div
                              key={tIdx}
                              className="flex items-center gap-2 text-xs py-1.5 px-2 rounded bg-muted/30 group"
                            >
                              <CheckCircle2 className={cn(
                                "h-3.5 w-3.5 shrink-0",
                                task.required ? "text-primary" : "text-muted-foreground/40"
                              )} />
                              {editingTask?.phase === idx && editingTask?.task === tIdx ? (
                                <Input
                                  autoFocus
                                  value={task.title}
                                  onChange={e => updateTaskTitle(idx, tIdx, e.target.value)}
                                  onBlur={() => setEditingTask(null)}
                                  onKeyDown={e => { if (e.key === 'Enter') setEditingTask(null); }}
                                  className="h-6 text-xs py-0 flex-1"
                                />
                              ) : (
                                <span
                                  className="flex-1 text-foreground truncate cursor-text"
                                  onDoubleClick={() => setEditingTask({ phase: idx, task: tIdx })}
                                >
                                  {task.title}
                                </span>
                              )}
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
                              <button
                                onClick={() => deleteTask(idx, tIdx)}
                                className="p-0.5 rounded hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                title="Remove task"
                              >
                                <X className="h-3 w-3 text-destructive/70" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            </div>

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
