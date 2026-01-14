import { SetupWizardHub } from '@/components/setup/SetupWizardHub';

export default function Setup() {
  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <SetupWizardHub forceShow />
    </div>
  );
}