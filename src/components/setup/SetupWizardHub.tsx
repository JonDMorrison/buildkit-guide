import { SmartChecklist } from './SmartChecklist';

interface SetupWizardHubProps {
  forceShow?: boolean;
}

export function SetupWizardHub({ forceShow = false }: SetupWizardHubProps) {
  return <SmartChecklist context={forceShow ? 'all' : undefined} forceShow={forceShow} />;
}
