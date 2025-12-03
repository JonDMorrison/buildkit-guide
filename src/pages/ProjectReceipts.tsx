import { useParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { useAuthRole } from '@/hooks/useAuthRole';
import { useAuth } from '@/hooks/useAuth';
import { WorkerReceiptsView } from '@/components/receipts/WorkerReceiptsView';
import { PMReceiptsView } from '@/components/receipts/PMReceiptsView';
import { NoAccess } from '@/components/NoAccess';
import { EmptyState } from '@/components/EmptyState';
import { Receipt } from 'lucide-react';

const ProjectReceipts = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const { isAdmin, isPM, currentProjectRole, loading } = useAuthRole(projectId);

  if (!projectId) {
    return (
      <Layout>
        <EmptyState
          icon={<Receipt className="h-8 w-8" />}
          title="No Project Selected"
          description="Select a project to view receipts."
        />
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  // Check if user has access to this project
  if (!currentProjectRole && !isAdmin) {
    return (
      <Layout>
        <NoAccess />
      </Layout>
    );
  }

  // Determine if user is PM/Admin (sees full project view) or worker (sees simplified view)
  const isPMOrAdmin = isAdmin || isPM();

  return (
    <Layout>
      {isPMOrAdmin ? (
        <PMReceiptsView projectId={projectId} />
      ) : (
        <WorkerReceiptsView projectId={projectId} userId={user?.id || ''} />
      )}
    </Layout>
  );
};

export default ProjectReceipts;
