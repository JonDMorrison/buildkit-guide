import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rocket, X, ChevronDown, ChevronUp, AlertTriangle, RefreshCw, Check } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { SetupChecklistItem } from './SetupChecklistItem';
import { useSmartChecklist, type ChecklistContext } from './useSmartChecklist';
import { type SetupStepDefinition } from '@/lib/setupSteps';
import { AcknowledgeStepDialog } from './AcknowledgeStepDialog';
import { TradesManagementModal } from './steps/TradesManagementModal';
import { TimeTrackingSettingsModal } from './steps/TimeTrackingSettingsModal';
import { InviteUserModal } from '@/components/users/InviteUserModal';
import { useCurrentProject } from '@/hooks/useCurrentProject';

interface SmartChecklistProps {
  context?: ChecklistContext;
  forceShow?: boolean;
}

/** Steps that require an acknowledgement dialog instead of instant action */
const ACK_STEPS: Record<string, { label: string; description: string }> = {
  step_ppe_reviewed: {
    label: 'Review PPE Requirements',
    description: 'Have you reviewed and configured the PPE checklists for each trade working on your projects?',
  },
  step_hazard_library: {
    label: 'Configure Hazard Library',
    description: 'Have you set up common hazards in your safety workflow so they can be quickly selected in safety forms?',
  },
};

export function SmartChecklist({ context, forceShow = false }: SmartChecklistProps) {
  const navigate = useNavigate();
  const { currentProjectId } = useCurrentProject();
  const {
    items,
    completedCount,
    totalCount,
    isLoading,
    isDismissed,
    isComplete,
    markStepComplete,
    dismissWizard,
    isUpdating,
    progress,
    detectorErrors,
    retryDetectors,
  } = useSmartChecklist(context);

  const [isExpanded, setIsExpanded] = useState(true);
  const [showTradesModal, setShowTradesModal] = useState(false);
  const [showTimeSettingsModal, setShowTimeSettingsModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [ackStep, setAckStep] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const celebrationShown = useRef(false);

  // Show celebration when setup becomes complete
  useEffect(() => {
    if (isComplete && !isLoading && !celebrationShown.current) {
      celebrationShown.current = true;
      setShowCelebration(true);
      const timer = setTimeout(() => {
        setShowCelebration(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isComplete, isLoading]);

  // Show brief celebration banner, dismissible on click
  if (showCelebration) {
    return (
      <Card
        className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent cursor-pointer"
        onClick={() => setShowCelebration(false)}
      >
        <CardContent className="py-4 flex items-center gap-3 animate-fade-in">
          <Check className="w-4 h-4 text-primary shrink-0" />
          <p className="text-sm text-muted-foreground">Setup complete ✓</p>
        </CardContent>
      </Card>
    );
  }

  // Don't show if dismissed, complete, loading, or no items
  if (isLoading || (!forceShow && (isDismissed || isComplete)) || items.length === 0) {
    return null;
  }

  const percentComplete = Math.round((completedCount / totalCount) * 100);

  // Map step keys to actions
  const getAction = (key: SetupStepDefinition['key']): (() => void) | undefined => {
    const actionMap: Partial<Record<SetupStepDefinition['key'], () => void>> = {
      step_first_invite: () => setShowInviteModal(true),
      step_users_assigned: () => navigate('/users'),
      step_time_tracking_enabled: () => setShowTimeSettingsModal(true),
      step_labor_rates: () => navigate('/settings/labor-rates'),
      step_ppe_reviewed: () => setAckStep('step_ppe_reviewed'),
      step_hazard_library: () => setAckStep('step_hazard_library'),
      step_invoice_permissions: () => navigate('/invoicing'),
      step_trades_configured: () => setShowTradesModal(true),
    };
    return actionMap[key];
  };

  const handleAckConfirm = () => {
    if (ackStep) {
      markStepComplete(ackStep as keyof typeof progress);
      setAckStep(null);
    }
  };

  const activeAck = ackStep ? ACK_STEPS[ackStep] : null;

  return (
    <>
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Rocket className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-base">Next Steps</h3>
                <p className="text-sm text-muted-foreground">
                  {items.length} {items.length === 1 ? 'thing' : 'things'} to set up
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{percentComplete}% done</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-muted-foreground"
              >
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={dismissWizard}
                className="text-muted-foreground hover:text-foreground"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="mt-3">
            <Progress value={percentComplete} className="h-1.5" />
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="pt-2 pb-4">
            {detectorErrors.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded px-3 py-2 mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                <span>Some checks couldn't load</span>
                <Button variant="ghost" size="sm" className="h-6 px-2 ml-auto text-xs" onClick={retryDetectors}>
                  <RefreshCw className="w-3 h-3 mr-1" /> Retry
                </Button>
              </div>
            )}
            <div className="space-y-1">
              {items.map((item) => (
                <SetupChecklistItem
                  key={item.key}
                  label={item.label}
                  description={item.description}
                  isComplete={false}
                  timeEstimate={item.timeEstimate}
                  helpText={item.helpText}
                  actionLabel={item.actionLabel}
                  onAction={getAction(item.key)}
                />
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Acknowledgement dialog for steps without auto-detection */}
      {activeAck && (
        <AcknowledgeStepDialog
          open={!!ackStep}
          onOpenChange={(open) => { if (!open) setAckStep(null); }}
          stepLabel={activeAck.label}
          description={activeAck.description}
          onConfirm={handleAckConfirm}
        />
      )}

      {/* Modals */}
      <TradesManagementModal
        open={showTradesModal}
        onOpenChange={setShowTradesModal}
        projectId={currentProjectId || undefined}
        onTradeCountChange={(count) => {
          if (count >= 3) markStepComplete('step_trades_configured');
        }}
      />

      <TimeTrackingSettingsModal
        open={showTimeSettingsModal}
        onOpenChange={setShowTimeSettingsModal}
        onSave={(settings) => {
          setShowTimeSettingsModal(false);
          if (settings.timezoneSet) markStepComplete('step_timezone_set');
          if (settings.timeTrackingEnabled) markStepComplete('step_time_tracking_enabled');
          if (settings.configured) markStepComplete('step_time_tracking_configured');
        }}
      />

      <InviteUserModal
        open={showInviteModal}
        onOpenChange={setShowInviteModal}
        onSuccess={() => {
          setShowInviteModal(false);
          markStepComplete('step_first_invite');
        }}
      />
    </>
  );
}
