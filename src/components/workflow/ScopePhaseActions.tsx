import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  previewScopeTaskGeneration,
  generateTasksFromScope,
  PreviewItem,
  GenerationResult,
} from '@/lib/scopeTaskGeneration';
import { supabase } from '@/integrations/supabase/client';
import { useEstimates } from '@/hooks/useEstimates';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, Wand2, AlertTriangle, CheckCircle2, Loader2, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ScopePhaseActionsProps {
  projectId: string;
}

export function ScopePhaseActions({ projectId }: ScopePhaseActionsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { estimates, generateTasksFromEstimate } = useEstimates(projectId);

  const [previewing, setPreviewing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<PreviewItem[] | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [estimateResult, setEstimateResult] = useState<any>(null);
  const [hasScopeItems, setHasScopeItems] = useState<boolean | null>(null);

  const approvedEstimate = estimates.find(e => e.status === 'approved');
  const toCreate = preview?.filter(p => p.action === 'create').length ?? 0;
  const toSkip = preview?.filter(p => p.action === 'skip').length ?? 0;

  const handleGenerateFromEstimate = async () => {
    if (!approvedEstimate) return;
    setGenerating(true);
    setResult(null);
    const res = await generateTasksFromEstimate(approvedEstimate.id);
    if (res) {
      setEstimateResult(res);
      queryClient.invalidateQueries({ queryKey: ['project-workflow', projectId] });
    }
    setGenerating(false);
  };

  const handlePreview = async () => {
    setPreviewing(true);
    setResult(null);
    setEstimateResult(null);
    try {
      const { count } = await supabase
        .from('project_scope_items')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .eq('is_archived', false);

      if (!count || count === 0) {
        setHasScopeItems(false);
        setPreview(null);
        return;
      }
      setHasScopeItems(true);
      const items = await previewScopeTaskGeneration(projectId, 'create_missing');
      setPreview(items);
    } catch (err: any) {
      toast({ title: 'Preview failed', description: err.message, variant: 'destructive' });
    } finally {
      setPreviewing(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await generateTasksFromScope(projectId, 'create_missing');
      setResult(res);
      setPreview(null);
      queryClient.invalidateQueries({ queryKey: ['project-workflow', projectId] });
      toast({ title: 'Tasks generated', description: `${res.created} created, ${res.skipped} skipped.` });
    } catch (err: any) {
      toast({ title: 'Generation failed', description: err.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-3">
      <Separator />
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Scope → Tasks
      </p>

      {/* Estimate-first path */}
      {approvedEstimate && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-primary/5 text-sm">
          <FileText className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-foreground">Estimate {approvedEstimate.estimate_number} available</p>
            <p className="text-muted-foreground text-xs">
              Generate tasks from estimate labor line items (preferred path).
            </p>
          </div>
          <Button size="sm" onClick={handleGenerateFromEstimate} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Wand2 className="h-4 w-4 mr-1.5" />}
            Generate
          </Button>
        </div>
      )}

      {estimateResult && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-emerald-500/10 text-sm">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Tasks generated from estimate</p>
            <p className="text-muted-foreground">
              {estimateResult.created_scope_items} scope items created · {estimateResult.skipped_existing} skipped
            </p>
          </div>
        </div>
      )}

      {/* No scope items warning */}
      {hasScopeItems === false && !approvedEstimate && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-amber-500/10 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">No scope items exist.</p>
            <p className="text-muted-foreground">
              Create scope from estimate first.{' '}
              <Link to={`/estimates?projectId=${projectId}`} className="text-primary underline">
                Go to Estimates
              </Link>
            </p>
          </div>
        </div>
      )}

      {/* Success result */}
      {result && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-emerald-500/10 text-sm">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Tasks generated successfully</p>
            <p className="text-muted-foreground">
              {result.created} created · {result.skipped} skipped
            </p>
          </div>
        </div>
      )}

      {/* Preview results */}
      {preview && (
        <div className="space-y-1.5 text-sm">
          {toCreate > 0 ? (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-primary/10 text-primary">{toCreate} to create</Badge>
              <Badge variant="secondary" className="bg-muted text-muted-foreground">{toSkip} already exist</Badge>
            </div>
          ) : (
            <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              <span className="text-muted-foreground">All tasks already generated.</span>
            </div>
          )}
          {toCreate > 0 && (
            <ul className="ml-1 space-y-1 max-h-[120px] overflow-y-auto">
              {preview.filter(p => p.action === 'create').map(p => (
                <li key={p.scope_item_id} className="text-xs text-muted-foreground">
                  • {p.scope_item_name}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Fallback scope-to-task path */}
      {!approvedEstimate && (
        <div className="flex gap-2">
          {!preview && !result && (
            <Button size="sm" variant="outline" onClick={handlePreview} disabled={previewing}>
              {previewing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Eye className="h-4 w-4 mr-1.5" />}
              Preview Task Generation
            </Button>
          )}
          {preview && toCreate > 0 && (
            <Button size="sm" onClick={handleGenerate} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Wand2 className="h-4 w-4 mr-1.5" />}
              Generate {toCreate} Tasks
            </Button>
          )}
          {(preview || result) && (
            <Button size="sm" variant="ghost" onClick={() => { setPreview(null); setResult(null); setHasScopeItems(null); }}>
              Reset
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
