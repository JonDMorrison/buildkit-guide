import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rocket, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { SetupChecklistItem } from './SetupChecklistItem';
import { useSmartChecklist, ChecklistContext } from './useSmartChecklist';
import { CreateJobSiteModal } from './steps/CreateJobSiteModal';
import { TradesManagementModal } from './steps/TradesManagementModal';
import { TimeTrackingSettingsModal } from './steps/TimeTrackingSettingsModal';
import { InviteUserModal } from '@/components/users/InviteUserModal';
import { useCurrentProject } from '@/hooks/useCurrentProject';
import { SetupProgress } from '@/hooks/useSetupProgress';

interface SmartChecklistProps {
  context?: ChecklistContext;
  forceShow?: boolean;
}

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
  } = useSmartChecklist(context);

  const [isExpanded, setIsExpanded] = useState(true);
  const [showTradesModal, setShowTradesModal] = useState(false);
  const [showTimeSettingsModal, setShowTimeSettingsModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Don't show if dismissed, complete, loading, or no items
  if (isLoading || (!forceShow && (isDismissed || isComplete)) || items.length === 0) {
    return null;
  }

  const percentComplete = Math.round((completedCount / totalCount) * 100);

  // Map step keys to actions
  const getAction = (key: keyof SetupProgress): (() => void) | undefined => {
    const actionMap: Partial<Record<keyof SetupProgress, () => void>> = {
      step_first_invite: () => setShowInviteModal(true),
      step_users_assigned: () => navigate('/users'),
      step_time_tracking_enabled: () => setShowTimeSettingsModal(true),
      step_labor_rates: () => navigate('/settings/labor-rates'),
      step_ppe_reviewed: () => markStepComplete('step_ppe_reviewed'),
      step_hazard_library: () => markStepComplete('step_hazard_library'),
      step_invoice_permissions: () => navigate('/invoicing'),
      step_trades_configured: () => setShowTradesModal(true),
    };
    return actionMap[key];
  };

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
