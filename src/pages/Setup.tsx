import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { SetupWizardHub } from '@/components/setup/SetupWizardHub';
import { Button } from '@/components/ui/button';
import { Rocket, CheckCircle } from 'lucide-react';
import { useSetupProgress } from '@/hooks/useSetupProgress';
import { SETUP_STEP_KEYS } from '@/lib/setupSteps';

export default function Setup() {
  const navigate = useNavigate();
  const { progress } = useSetupProgress();

  const totalSteps = SETUP_STEP_KEYS.length;
  const completedCount = progress
    ? SETUP_STEP_KEYS.filter(k => progress[k]).length
    : 0;
  const pct = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;
  const remainingMin = (totalSteps - completedCount) * 3;

  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <Layout>
      <div className="container mx-auto py-6 max-w-4xl space-y-6">
        {/* Progress Ring Header */}
        <div className="flex items-center gap-6">
          <div className="relative shrink-0">
            <svg width="96" height="96" viewBox="0 0 96 96">
              <circle cx="48" cy="48" r="40" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
              <circle
                cx="48" cy="48" r="40" fill="none" stroke="currentColor" strokeWidth="6"
                className="text-primary transition-all duration-700"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                transform="rotate(-90 48 48)"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-bold tabular-nums">{pct}%</span>
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold">Setup Progress</h1>
            <p className="text-sm text-muted-foreground">
              {completedCount} of {totalSteps} steps completed
            </p>
            {remainingMin > 0 && (
              <p className="text-xs text-muted-foreground/60 mt-0.5">
                ~{remainingMin} min remaining
              </p>
            )}
          </div>
        </div>

        <SetupWizardHub forceShow />

        <div className="flex justify-end">
          {pct === 100 ? (
            <Button disabled className="gap-2 bg-green-600 hover:bg-green-600">
              <CheckCircle className="h-4 w-4" />
              Setup Complete
            </Button>
          ) : pct >= 50 ? (
            <Button onClick={() => navigate('/')} className="gap-2">
              <Rocket className="h-4 w-4" />
              Launch ProjectPath
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => navigate('/')}
              className="gap-2"
              title="Complete at least 50% to unlock full AI features"
            >
              <Rocket className="h-4 w-4" />
              Launch ProjectPath
            </Button>
          )}
        </div>
      </div>
    </Layout>
  );
}
