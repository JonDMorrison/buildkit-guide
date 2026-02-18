import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, Loader2, ArrowRight, Wrench } from 'lucide-react';
import { IntegrityBadge } from '@/components/IntegrityBadge';
import { useProjectIntegrity } from '@/hooks/useProjectIntegrity';
import { useFinancialOverride } from '@/hooks/useFinancialOverride';
import { useToast } from '@/hooks/use-toast';

export type IntegrityCheckpoint = 'pm_approval' | 'invoice_send' | 'project_close';

interface FinancialIntegrityGateProps {
  projectId: string;
  checkpoint: IntegrityCheckpoint;
  open: boolean;
  onProceed: () => void;
  onCancel: () => void;
}

export function FinancialIntegrityGate({
  projectId,
  checkpoint,
  open,
  onProceed,
  onCancel,
}: FinancialIntegrityGateProps) {
  const { integrity, loading: integrityLoading } = useProjectIntegrity(open ? projectId : null);
  const { logOverride, loading: overrideLoading } = useFinancialOverride();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState('');
  const [resolved, setResolved] = useState(false);

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setShowReason(false);
      setReason('');
      setResolved(false);
    }
  }, [open]);

  // Auto-proceed if clean
  useEffect(() => {
    if (!open || integrityLoading || resolved) return;
    if (integrity?.status === 'clean' || integrity === null) {
      setResolved(true);
      onProceed();
    }
  }, [open, integrity, integrityLoading, resolved, onProceed]);

  const handleOverrideSubmit = useCallback(async () => {
    const ok = await logOverride(projectId, checkpoint, reason);
    if (ok) {
      toast({ title: 'Override logged', description: 'Proceeding with action.' });
      setResolved(true);
      onProceed();
    } else {
      toast({ title: 'Failed to log override', variant: 'destructive' });
    }
  }, [logOverride, projectId, checkpoint, reason, onProceed, toast]);

  // Don't render dialog if clean / loading hasn't resolved yet
  if (!open || resolved || integrityLoading || !integrity || integrity.status === 'clean') {
    return null;
  }

  const reasonValid = reason.trim().length >= 10;
  const isHardBlocked = integrity.enforcementLevel === 'strict_phase_gating' && integrity.status === 'blocked';

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <DialogTitle>Financial Integrity Warning</DialogTitle>
          </div>
          <DialogDescription>
            {isHardBlocked
              ? 'This project has blocked financial issues that must be resolved before proceeding. Overrides are not permitted under strict phase gating.'
              : 'This project has unresolved financial issues. You can fix them or continue with acknowledgment.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status + Score */}
          <div className="flex items-center justify-between">
            <IntegrityBadge
              status={integrity.status}
              score={integrity.score}
              blockers={integrity.blockers}
            />
            <span className="text-2xl font-bold text-foreground">{integrity.score}/100</span>
          </div>

          {/* Blockers list */}
          {integrity.blockers.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Issues</p>
              <ul className="space-y-1">
                {integrity.blockers.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-destructive mt-0.5">•</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action buttons */}
          {!showReason ? (
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className={isHardBlocked ? 'w-full' : 'flex-1'}
                onClick={() => {
                  onCancel();
                  navigate(`/estimates?projectId=${projectId}`);
                }}
              >
                <Wrench className="h-4 w-4 mr-1.5" />
                Fix Issues
              </Button>
              {!isHardBlocked && (
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowReason(true)}
                >
                  <ArrowRight className="h-4 w-4 mr-1.5" />
                  Continue Anyway
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <div>
                <Textarea
                  placeholder="Explain why you're proceeding despite the issues (min 10 characters)..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="min-h-[80px] text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {reason.trim().length}/10 characters minimum
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowReason(false)}>
                  Back
                </Button>
                <Button
                  className="flex-1"
                  disabled={!reasonValid || overrideLoading}
                  onClick={handleOverrideSubmit}
                >
                  {overrideLoading ? (
                    <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Logging...</>
                  ) : (
                    'Confirm & Proceed'
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
