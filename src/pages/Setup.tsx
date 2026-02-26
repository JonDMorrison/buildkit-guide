import { useNavigate } from 'react-router-dom';
import { SetupWizardHub } from '@/components/setup/SetupWizardHub';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export default function Setup() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto py-6 max-w-4xl space-y-4">
      <SetupWizardHub forceShow />
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => navigate('/')}>
          Skip to Dashboard
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
