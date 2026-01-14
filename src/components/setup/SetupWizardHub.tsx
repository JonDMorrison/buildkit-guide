import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Rocket, X, ChevronDown, ChevronUp, RefreshCw, 
  PartyPopper, Settings, MapPin, Users, Clock, 
  Shield, FileText, Building2 
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useSetupProgress, SetupProgress } from '@/hooks/useSetupProgress';
import { SetupPhaseSection } from './SetupPhaseSection';
import { SetupChecklistItem } from './SetupChecklistItem';
import { CreateJobSiteModal } from './steps/CreateJobSiteModal';
import { TradesManagementModal } from './steps/TradesManagementModal';
import { TimeTrackingSettingsModal } from './steps/TimeTrackingSettingsModal';
import { CreateProjectModal } from '@/components/CreateProjectModal';
import { InviteUserModal } from '@/components/users/InviteUserModal';
import { useCurrentProject } from '@/hooks/useCurrentProject';
import { cn } from '@/lib/utils';
interface SetupWizardHubProps {
  forceShow?: boolean;
}

export function SetupWizardHub({ forceShow = false }: SetupWizardHubProps) {
  const navigate = useNavigate();
  const { currentProjectId } = useCurrentProject();
  const {
    progress,
    isLoading,
    isDismissed,
    isComplete,
    completedSteps,
    totalSteps,
    percentComplete,
    getPhaseProgress,
    markStepComplete,
    dismissWizard,
    resetProgress,
    isUpdating,
  } = useSetupProgress();

  const [isExpanded, setIsExpanded] = useState(true);
  const [showJobSiteModal, setShowJobSiteModal] = useState(false);
  const [showTradesModal, setShowTradesModal] = useState(false);
  const [showTimeSettingsModal, setShowTimeSettingsModal] = useState(false);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Don't show if dismissed or complete (unless forceShow is true)
  if (isLoading || (!forceShow && (isDismissed || isComplete))) {
    return null;
  }

  const phase1 = getPhaseProgress(1);
  const phase2 = getPhaseProgress(2);
  const phase3 = getPhaseProgress(3);
  const phase4 = getPhaseProgress(4);
  const phase5 = getPhaseProgress(5);

  const stepDefinitions: Record<string, { 
    label: string; 
    description: string; 
    timeEstimate: string; 
    helpText?: string;
    action?: () => void;
    actionLabel?: string;
  }> = {
    step_org_created: {
      label: 'Organization Created',
      description: 'Your company is set up in Project Path',
      timeEstimate: '✓ Done',
      helpText: 'This step is automatically completed when you sign up.',
    },
    step_timezone_set: {
      label: 'Set Timezone & Region',
      description: 'Configure your default timezone for accurate scheduling',
      timeEstimate: '~1 min',
      action: () => setShowTimeSettingsModal(true),
      actionLabel: 'Configure',
    },
    step_first_project: {
      label: 'Create Your First Project',
      description: 'Add your first construction project to manage',
      timeEstimate: '~2 min',
      action: () => setShowCreateProjectModal(true),
      actionLabel: 'Create Project',
    },
    step_first_job_site: {
      label: 'Add a Job Site',
      description: 'Set up job site location with GPS coordinates for time tracking',
      timeEstimate: '~3 min',
      action: () => setShowJobSiteModal(true),
      actionLabel: 'Add Site',
      helpText: 'Job sites are used for geofencing and time tracking.',
    },
    step_first_invite: {
      label: 'Invite Team Members',
      description: 'Add your first team member to collaborate on projects',
      timeEstimate: '~2 min',
      action: () => setShowInviteModal(true),
      actionLabel: 'Invite',
    },
    step_trades_configured: {
      label: 'Configure Trades',
      description: 'Set up the trades/subcontractors working on your projects',
      timeEstimate: '~5 min',
      action: () => setShowTradesModal(true),
      actionLabel: 'Manage Trades',
      helpText: 'Add at least 3 trades to complete this step.',
    },
    step_users_assigned: {
      label: 'Assign Users to Projects',
      description: 'Give team members access to specific projects',
      timeEstimate: '~2 min',
      action: () => navigate('/users'),
      actionLabel: 'Manage Users',
    },
    step_time_tracking_enabled: {
      label: 'Enable Time Tracking',
      description: 'Turn on time tracking for your organization',
      timeEstimate: '~1 min',
      action: () => setShowTimeSettingsModal(true),
      actionLabel: 'Enable',
    },
    step_time_tracking_configured: {
      label: 'Configure Time Tracking Rules',
      description: 'Set up auto-close hours, reminders, and geofence settings',
      timeEstimate: '~3 min',
      action: () => setShowTimeSettingsModal(true),
      actionLabel: 'Configure',
    },
    step_ppe_reviewed: {
      label: 'Review PPE Requirements',
      description: 'Ensure PPE checklists are configured for each trade',
      timeEstimate: '~5 min',
      action: () => markStepComplete('step_ppe_reviewed'),
      actionLabel: 'Mark Complete',
      helpText: 'Review and customize the PPE requirements in the Safety section.',
    },
    step_first_safety_form: {
      label: 'Complete First Safety Form',
      description: 'Submit your first daily safety log or toolbox talk',
      timeEstimate: '~5 min',
      action: () => navigate('/safety'),
      actionLabel: 'Go to Safety',
    },
    step_hazard_library: {
      label: 'Set Up Hazard Library',
      description: 'Configure common hazards for quick selection in forms',
      timeEstimate: '~5 min',
      action: () => markStepComplete('step_hazard_library'),
      actionLabel: 'Mark Complete',
      helpText: 'Hazards can be customized in the Safety section.',
    },
    step_first_drawing: {
      label: 'Upload First Drawing',
      description: 'Add your first blueprint or plan document',
      timeEstimate: '~2 min',
      action: () => navigate('/drawings'),
      actionLabel: 'Go to Drawings',
    },
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
                <h3 className="font-semibold text-lg">Get Started with Project Path</h3>
                <p className="text-sm text-muted-foreground">
                  Complete these steps to set up your organization for success
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-muted-foreground"
              >
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={dismissWizard}
                className="text-muted-foreground hover:text-foreground"
                title="Dismiss wizard"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                {completedSteps} of {totalSteps} steps complete
              </span>
              <span className="text-sm text-muted-foreground">{percentComplete}%</span>
            </div>
            <Progress value={percentComplete} className="h-2" />
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="pt-4">
            <div className="rounded-lg border border-border overflow-hidden">
              {/* Phase 1: Foundation */}
              <SetupPhaseSection
                phaseNumber={1}
                phaseName="Foundation"
                completedSteps={phase1.completed}
                totalSteps={phase1.total}
                defaultOpen={phase1.completed < phase1.total}
              >
                {['step_org_created', 'step_timezone_set', 'step_first_project', 'step_first_job_site'].map((key) => {
                  const step = stepDefinitions[key];
                  return (
                    <SetupChecklistItem
                      key={key}
                      label={step.label}
                      description={step.description}
                      isComplete={progress[key as keyof SetupProgress] as boolean}
                      timeEstimate={step.timeEstimate}
                      helpText={step.helpText}
                      actionLabel={step.actionLabel}
                      onAction={step.action}
                    />
                  );
                })}
              </SetupPhaseSection>

              {/* Phase 2: Team Setup */}
              <SetupPhaseSection
                phaseNumber={2}
                phaseName="Team Setup"
                completedSteps={phase2.completed}
                totalSteps={phase2.total}
                defaultOpen={phase1.completed === phase1.total && phase2.completed < phase2.total}
              >
                {['step_first_invite', 'step_trades_configured', 'step_users_assigned'].map((key) => {
                  const step = stepDefinitions[key];
                  return (
                    <SetupChecklistItem
                      key={key}
                      label={step.label}
                      description={step.description}
                      isComplete={progress[key as keyof SetupProgress] as boolean}
                      timeEstimate={step.timeEstimate}
                      helpText={step.helpText}
                      actionLabel={step.actionLabel}
                      onAction={step.action}
                    />
                  );
                })}
              </SetupPhaseSection>

              {/* Phase 3: Time Tracking */}
              <SetupPhaseSection
                phaseNumber={3}
                phaseName="Time Tracking"
                completedSteps={phase3.completed}
                totalSteps={phase3.total}
                defaultOpen={phase2.completed === phase2.total && phase3.completed < phase3.total}
              >
                {['step_time_tracking_enabled', 'step_time_tracking_configured'].map((key) => {
                  const step = stepDefinitions[key];
                  return (
                    <SetupChecklistItem
                      key={key}
                      label={step.label}
                      description={step.description}
                      isComplete={progress[key as keyof SetupProgress] as boolean}
                      timeEstimate={step.timeEstimate}
                      helpText={step.helpText}
                      actionLabel={step.actionLabel}
                      onAction={step.action}
                    />
                  );
                })}
              </SetupPhaseSection>

              {/* Phase 4: Safety & Compliance */}
              <SetupPhaseSection
                phaseNumber={4}
                phaseName="Safety & Compliance"
                completedSteps={phase4.completed}
                totalSteps={phase4.total}
                defaultOpen={phase3.completed === phase3.total && phase4.completed < phase4.total}
              >
                {['step_ppe_reviewed', 'step_first_safety_form', 'step_hazard_library'].map((key) => {
                  const step = stepDefinitions[key];
                  return (
                    <SetupChecklistItem
                      key={key}
                      label={step.label}
                      description={step.description}
                      isComplete={progress[key as keyof SetupProgress] as boolean}
                      timeEstimate={step.timeEstimate}
                      helpText={step.helpText}
                      actionLabel={step.actionLabel}
                      onAction={step.action}
                    />
                  );
                })}
              </SetupPhaseSection>

              {/* Phase 5: Documents */}
              <SetupPhaseSection
                phaseNumber={5}
                phaseName="Documents"
                completedSteps={phase5.completed}
                totalSteps={phase5.total}
                defaultOpen={phase4.completed === phase4.total && phase5.completed < phase5.total}
              >
                {['step_first_drawing'].map((key) => {
                  const step = stepDefinitions[key];
                  return (
                    <SetupChecklistItem
                      key={key}
                      label={step.label}
                      description={step.description}
                      isComplete={progress[key as keyof SetupProgress] as boolean}
                      timeEstimate={step.timeEstimate}
                      helpText={step.helpText}
                      actionLabel={step.actionLabel}
                      onAction={step.action}
                    />
                  );
                })}
              </SetupPhaseSection>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={resetProgress}
                disabled={isUpdating}
                className="text-muted-foreground"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reset Progress
              </Button>
              
              <div className="flex items-center gap-4">
                <p className="text-xs text-muted-foreground">
                  Need help? Contact support at support@projectpath.app
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/dashboard')}
                >
                  Close
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Modals */}
      <CreateJobSiteModal
        open={showJobSiteModal}
        onOpenChange={setShowJobSiteModal}
        projectId={currentProjectId || undefined}
        onSuccess={() => {
          setShowJobSiteModal(false);
          markStepComplete('step_first_job_site');
        }}
      />

      <TradesManagementModal
        open={showTradesModal}
        onOpenChange={setShowTradesModal}
        projectId={currentProjectId || undefined}
        onTradeCountChange={(count) => {
          if (count >= 3) {
            markStepComplete('step_trades_configured');
          }
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

      <CreateProjectModal
        open={showCreateProjectModal}
        onOpenChange={(isOpen) => {
          setShowCreateProjectModal(isOpen);
        }}
        onSuccess={() => {
          setShowCreateProjectModal(false);
          markStepComplete('step_first_project');
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
