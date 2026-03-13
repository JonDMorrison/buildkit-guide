import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';

interface Trade {
  id: string;
  name: string;
  trade_type: string | null;
}

interface CreatePlaybookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: { name: string; job_type: string; description: string; audience: string; trade_id: string | null; phases?: any[] }) => void;
  isCreating: boolean;
  /** Existing job_types in the org for suggestion chips */
  existingJobTypes?: string[];
}

const AUDIENCE_OPTIONS = [
  { value: 'office', label: 'Office', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'foreman', label: 'Foreman', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'field', label: 'Field', color: 'bg-green-100 text-green-700 border-green-200' },
];

export function CreatePlaybookDialog({
  open, onOpenChange, onCreate, isCreating, existingJobTypes = [],
}: CreatePlaybookDialogProps) {
  const { activeOrganizationId } = useOrganization();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [audience, setAudience] = useState('office');
  const [tradeId, setTradeId] = useState<string | null>(null);
  const [jobType, setJobType] = useState('');
  const [description, setDescription] = useState('');
  const [generateWithAI, setGenerateWithAI] = useState(true);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

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

  const reset = () => {
    setName(''); setAudience('office'); setTradeId(null);
    setJobType(''); setDescription(''); setGenerateWithAI(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (!generateWithAI) {
      onCreate({ name: name.trim(), job_type: jobType.trim(), description: description.trim(), audience, trade_id: tradeId });
      reset();
      return;
    }

    // Generate with AI: call edge function then pass phases to onCreate
    setIsGenerating(true);
    try {
      const tradeName = trades.find(t => t.id === tradeId)?.name ?? null;
      const { data, error: fnError } = await supabase.functions.invoke('generate-playbook', {
        body: {
          job_type: jobType.trim() || name.trim(),
          audience,
          trade_name: tradeName,
        },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      const phases = (data.phases ?? []).map((phase: any, idx: number) => ({
        name: phase.name,
        description: phase.description ?? '',
        sequence_order: phase.sequence_order ?? idx + 1,
        tasks: (phase.tasks ?? []).map((t: any, ti: number) => ({
          title: t.title,
          description: t.description ?? '',
          role_type: t.role_type ?? 'laborer',
          expected_hours_low: t.expected_hours_low ?? 0,
          expected_hours_high: t.expected_hours_high ?? 0,
          required_flag: t.required ?? true,
          allow_skip: !(t.required ?? true),
          density_weight: 1,
          sequence_order: ti + 1,
        })),
      }));

      onCreate({
        name: data.name || name.trim(),
        job_type: data.job_type || jobType.trim(),
        description: data.description || description.trim(),
        audience,
        trade_id: tradeId,
        phases,
      });
      reset();
    } catch (e: any) {
      // Fallback: create empty shell if AI fails
      toast({ title: 'AI generation failed', description: e.message + ' — creating empty playbook.', variant: 'default' });
      onCreate({ name: name.trim(), job_type: jobType.trim(), description: description.trim(), audience, trade_id: tradeId });
      reset();
    } finally {
      setIsGenerating(false);
    }
  };

  const busy = isCreating || isGenerating;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) { if (!o) reset(); onOpenChange(o); } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Playbook</DialogTitle>
          <DialogDescription>Build a reusable project workflow template.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="pb-name">Name *</Label>
            <Input id="pb-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Retail TI Standard" autoFocus />
          </div>

          {/* Audience */}
          <div className="space-y-1.5">
            <Label>Audience *</Label>
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

          {/* Trade */}
          <div className="space-y-1.5">
            <Label>Which trade is this for?</Label>
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
          <div className="space-y-1.5">
            <Label htmlFor="pb-type">Job Type *</Label>
            <Input
              id="pb-type"
              value={jobType}
              onChange={e => setJobType(e.target.value)}
              placeholder="e.g. Tenant Improvement"
            />
            {existingJobTypes.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {existingJobTypes.slice(0, 6).map(jt => (
                  <button key={jt} type="button" onClick={() => setJobType(jt)}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground hover:bg-muted/80 border border-border/50">
                    {jt}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="pb-desc">Description</Label>
            <Textarea id="pb-desc" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Operational playbook for..." className="min-h-[60px] resize-none" />
          </div>

          {/* Generate with AI toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/50">
            <div className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-medium">Generate phases & tasks with AI</p>
                <p className="text-[11px] text-muted-foreground">Uses your project history to suggest structure</p>
              </div>
            </div>
            <Switch checked={generateWithAI} onCheckedChange={setGenerateWithAI} />
          </div>

          {isGenerating && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing your project history...
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { reset(); onOpenChange(false); }} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={!name.trim() || !jobType.trim() || busy} className="gap-1.5">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : generateWithAI ? <Sparkles className="h-4 w-4" /> : null}
              {isGenerating ? 'Generating...' : isCreating ? 'Creating...' : generateWithAI ? 'Generate & Create' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
