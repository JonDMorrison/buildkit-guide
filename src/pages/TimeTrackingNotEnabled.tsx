import { Layout } from '@/components/Layout';
import { Clock, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useOrganization } from '@/hooks/useOrganization';

export default function TimeTrackingNotEnabled() {
  const navigate = useNavigate();
  const { isOrgAdmin, activeOrganization } = useOrganization();

  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="bg-muted rounded-full p-6 mb-6">
          <Clock className="h-12 w-12 text-muted-foreground" />
        </div>
        
        <h1 className="text-2xl font-bold mb-2">Time Tracking Not Enabled</h1>
        
        <p className="text-muted-foreground max-w-md mb-6">
          Time tracking is not enabled for {activeOrganization?.name || 'your organization'}.
          {isOrgAdmin 
            ? ' As an organization admin, you can enable this feature in organization settings.'
            : ' Please contact your organization administrator to enable this feature.'
          }
        </p>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Go Back
          </Button>
          
          {isOrgAdmin && (
            <Button onClick={() => navigate('/settings/organization')}>
              <Settings className="h-4 w-4 mr-2" />
              Organization Settings
            </Button>
          )}
        </div>
      </div>
    </Layout>
  );
}
