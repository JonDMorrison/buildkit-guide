import { Layout } from '@/components/Layout';
import { useCurrentProject } from '@/hooks/useCurrentProject';
import { useProjectWorkflow, WorkflowPhase } from '@/hooks/useProjectWorkflow';
import { useAuthRole } from '@/hooks/useAuthRole';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  Send,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  Bug,
  Zap,
} from 'lucide-react';
import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { ScopePhaseActions } from '@/components/workflow/ScopePhaseActions';
import { FinancialIntegrityGate, type IntegrityCheckpoint } from '@/components/FinancialIntegrityGate';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Circle }> = {
  not_started: { label: 'Not Started', color: 'bg-muted text-muted-foreground', icon: Circle },
  in_progress: { label: 'In Progress', color: 'bg-primary/15 text-primary', icon: Clock },
  blocked: { label: 'Sent Back', color: 'bg-destructive/15 text-destructive', icon: AlertTriangle },
  requested: { label: 'Awaiting Approval', color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', icon: Send },
  approved: { label: 'Approved', color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', icon: CheckCircle2 },
};

function PhaseCard({
  phase,
  isCurrent,
  projectId,
  userRole,
  onRequestAdvance,
  onApprove,
  isRequesting,
  isApproving,
}: {
  phase: WorkflowPhase;
  isCurrent: boolean;
  projectId: string;
  userRole: string | null;
  onRequestAdvance: (key: string, notes?: string) => void;
  onApprove: (key: string, approve: boolean, message?: string) => void;
  isRequesting: boolean;
  isApproving: boolean;
}) {
  const [notes, setNotes] = useState('');
  const [denyMessage, setDenyMessage] = useState('');
  const [gateOpen, setGateOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'request' | 'approve'; key: string; notes?: string } | null>(null);
  const statusCfg = STATUS_CONFIG[phase.status] ?? STATUS_CONFIG.not_started;
  const StatusIcon = statusCfg.icon;

  const canRequest = userRole && phase.allowed_requester_roles.includes(userRole) && phase.status === 'in_progress';
  const canApprove = userRole && phase.allowed_approver_roles.includes(userRole) && phase.status === 'requested';
  const allReqsPassed = phase.requirements.length === 0 || phase.requirements.every(r => r.passed);
  const needsIntegrityGate = phase.key === 'foreman_approve' || phase.key === 'pm_closeout';

  const handleGatedRequest = (key: string, actionNotes?: string) => {
    if (needsIntegrityGate) {
      setPendingAction({ type: 'request', key, notes: actionNotes });
      setGateOpen(true);
    } else {
      onRequestAdvance(key, actionNotes);
    }
  };

  const handleGatedApprove = (key: string) => {
    if (needsIntegrityGate) {
      setPendingAction({ type: 'approve', key, notes: denyMessage || undefined });
      setGateOpen(true);
    } else {
      onApprove(key, true, denyMessage || undefined);
      setDenyMessage('');
    }
  };

  return (
    <div className="flex gap-4">
      {/* Timeline connector */}
      <div className="flex flex-col items-center pt-1">
        <div className={cn(
          'h-8 w-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors',
          phase.status === 'approved' ? 'border-emerald-500 bg-emerald-500/20' :
          isCurrent ? 'border-primary bg-primary/20' :
          'border-muted-foreground/30 bg-muted/50'
        )}>
          <StatusIcon className={cn(
            'h-4 w-4',
            phase.status === 'approved' ? 'text-emerald-500' :
            isCurrent ? 'text-primary' : 'text-muted-foreground/50'
          )} />
        </div>
        <div className="flex-1 w-px bg-border min-h-[16px]" />
      </div>

      <Card className={cn(
        'flex-1 mb-3 transition-all',
        isCurrent && 'ring-2 ring-primary/30',
        phase.status === 'approved' && 'opacity-75',
      )}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base font-semibold">{phase.label}</CardTitle>
            <Badge className={cn('text-xs font-medium', statusCfg.color)} variant="secondary">
              {statusCfg.label}
            </Badge>
          </div>
          {phase.description && (
            <p className="text-sm text-muted-foreground">{phase.description}</p>
          )}
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Requirements checklist */}
          {phase.requirements.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Requirements</p>
              {phase.requirements.map(req => (
                <div key={req.id} className="flex items-start gap-2 text-sm">
                  {req.status === 'met' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-0.5" />
                  )}
                  <span className={cn(req.status === 'met' ? 'text-foreground' : 'text-muted-foreground')}>
                    {req.label}
                    {req.status !== 'met' && req.details && (
                      <span className="text-xs ml-1 text-destructive">— {req.details}</span>
                    )}
                    {!req.required && (
                      <span className="text-xs ml-1 text-muted-foreground">(optional)</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Action buttons */}
          {canRequest && phase.is_approval_required && (
            <div className="pt-2 space-y-2">
              <Textarea
                placeholder="Optional notes for approver..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="min-h-[60px] text-sm"
              />
              <Button
                size="sm"
                disabled={!allReqsPassed || isRequesting}
                onClick={() => { handleGatedRequest(phase.key, notes || undefined); setNotes(''); }}
              >
                <Send className="h-4 w-4 mr-1.5" />
                {allReqsPassed ? 'Request Approval' : 'Requirements Not Met'}
              </Button>
            </div>
          )}

          {canRequest && !phase.is_approval_required && (
            <div className="pt-2">
              <Button
                size="sm"
                disabled={!allReqsPassed || isRequesting}
                onClick={() => handleGatedRequest(phase.key)}
              >
                <Zap className="h-4 w-4 mr-1.5" />
                {allReqsPassed ? 'Mark Complete' : 'Requirements Not Met'}
              </Button>
            </div>
          )}

          {canApprove && (
            <div className="pt-2 space-y-2">
              {phase.notes && (
                <p className="text-sm bg-muted/50 rounded-md p-2 italic">{phase.notes}</p>
              )}
              <Textarea
                placeholder="Optional message..."
                value={denyMessage}
                onChange={e => setDenyMessage(e.target.value)}
                className="min-h-[60px] text-sm"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={isApproving}
                  onClick={() => handleGatedApprove(phase.key)}
                >
                  <ThumbsUp className="h-4 w-4 mr-1.5" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isApproving}
                  onClick={() => { onApprove(phase.key, false, denyMessage || undefined); setDenyMessage(''); }}
                >
                  <ThumbsDown className="h-4 w-4 mr-1.5" />
                  Send Back
                </Button>
              </div>
            </div>
          )}

          {/* Scope phase CTA */}
          {phase.key === 'scope_of_work' && isCurrent && (
            <ScopePhaseActions projectId={projectId} />
          )}

          {/* Financial Integrity Gate for gated phases */}
          {gateOpen && pendingAction && (
            <FinancialIntegrityGate
              projectId={projectId}
              checkpoint="pm_approval"
              open={gateOpen}
              onProceed={() => {
                setGateOpen(false);
                if (pendingAction.type === 'request') {
                  onRequestAdvance(pendingAction.key, pendingAction.notes);
                } else {
                  onApprove(pendingAction.key, true, pendingAction.notes);
                  setDenyMessage('');
                }
                setPendingAction(null);
              }}
              onCancel={() => {
                setGateOpen(false);
                setPendingAction(null);
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Workflow() {
  const { currentProjectId } = useCurrentProject();
  const { workflow, isLoading, setFlowMode, requestAdvance, approvePhase } = useProjectWorkflow(currentProjectId ?? undefined);
  const { currentProjectRole, isAdmin } = useAuthRole(currentProjectId ?? undefined);
  const [debugOpen, setDebugOpen] = useState(false);

  const effectiveRole = isAdmin ? 'admin' : (currentProjectRole ?? null);
  const canToggle = effectiveRole === 'admin' || effectiveRole === 'project_manager';
  const showDebug = effectiveRole === 'admin' || effectiveRole === 'project_manager';

  return (
    <Layout>
      <div className="container mx-auto py-6 max-w-3xl space-y-6">
        {/* Header with toggle */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Project Workflow</h1>
            <p className="text-sm text-muted-foreground mt-1">
              AI-Optimized project lifecycle with phase gating and approvals
            </p>
          </div>
          {canToggle && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">AI-Optimized Flow</span>
              <Switch
                checked={workflow?.flow_mode === 'ai_optimized'}
                onCheckedChange={(checked) => setFlowMode.mutate(checked ? 'ai_optimized' : 'standard')}
                disabled={setFlowMode.isPending}
              />
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-lg" />
            ))}
          </div>
        ) : !workflow || workflow.flow_mode === 'standard' ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              <h2 className="text-lg font-semibold text-foreground">Standard Mode</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                Enable AI-Optimized Flow to activate guided workflow phases with requirements, approvals, and notifications.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Phase timeline */}
            <div>
              {workflow.phases.map(phase => (
                <PhaseCard
                  key={phase.key}
                  phase={phase}
                  isCurrent={phase.key === workflow.current_phase}
                  projectId={currentProjectId!}
                  userRole={effectiveRole}
                  onRequestAdvance={(key, notes) => requestAdvance.mutate({ phaseKey: key, notes })}
                  onApprove={(key, approve, message) => approvePhase.mutate({ phaseKey: key, approve, message })}
                  isRequesting={requestAdvance.isPending}
                  isApproving={approvePhase.isPending}
                />
              ))}
            </div>

            {/* Debug panel */}
            {showDebug && (
              <Collapsible open={debugOpen} onOpenChange={setDebugOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-muted-foreground gap-2">
                    <Bug className="h-4 w-4" />
                    Workflow Debug
                    <ChevronDown className={cn('h-4 w-4 transition-transform', debugOpen && 'rotate-180')} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <Card className="mt-2">
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-xs font-medium text-muted-foreground">Raw Workflow JSON</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigator.clipboard.writeText(JSON.stringify(workflow, null, 2))}
                        >
                          Copy
                        </Button>
                      </div>
                      <pre className="text-xs bg-muted/50 rounded-md p-3 overflow-auto max-h-[400px] whitespace-pre-wrap break-all">
                        {JSON.stringify(workflow, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                </CollapsibleContent>
              </Collapsible>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
