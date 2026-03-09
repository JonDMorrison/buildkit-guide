import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useOrganizationRole } from '@/hooks/useOrganizationRole';
import { NoAccess } from '@/components/NoAccess';
import { RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import DiagnosticsSection from './ai-brain/DiagnosticsSection';
import MarginToolsSection from './ai-brain/MarginToolsSection';
import OSOperationsSection from './ai-brain/OSOperationsSection';

/**
 * Gate: checks admin before rendering content (which has queries).
 */
export default function AIBrainDiagnostics() {
  const { isAdmin: isGlobalAdmin, loading: roleLoading } = useUserRole();
  const { isAdmin: isOrgAdmin, isLoading: orgLoading } = useOrganizationRole();

  const loading = roleLoading || orgLoading;
  const isAdmin = isGlobalAdmin || isOrgAdmin;

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return (
      <Layout>
        <NoAccess message="Admin access required." />
      </Layout>
    );
  }

  return <AIBrainContent />;
}

/**
 * Content: all queries live here, only rendered after admin check passes.
 */
function AIBrainContent() {
  const { session } = useAuth();
  const { activeOrganizationId } = useOrganization();
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  const [dbAuthOk, setDbAuthOk] = useState(false);
  const [dbAuthLoading, setDbAuthLoading] = useState(true);

  useEffect(() => {
    if (!activeOrganizationId) return;
    supabase.from('projects').select('id, name').eq('organization_id', activeOrganizationId)
      .order('name').then(({ data }) => setProjects(data || []));
  }, [activeOrganizationId]);

  useEffect(() => {
    (async () => {
      setDbAuthLoading(true);
      try {
        const { data, error } = await supabase.rpc('rpc_whoami');
        const userData = data as { uid: string } | null;
        setDbAuthOk(!error && !!userData?.uid);
      } catch {
        setDbAuthOk(false);
      } finally {
        setDbAuthLoading(false);
      }
    })();
  }, []);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <DiagnosticsSection
          orgId={activeOrganizationId}
          session={session}
          projects={projects}
        />

        <MarginToolsSection
          orgId={activeOrganizationId}
          session={session}
          projects={projects}
          dbAuthOk={dbAuthOk}
          dbAuthLoading={dbAuthLoading}
        />

        <OSOperationsSection
          orgId={activeOrganizationId}
          projects={projects}
          dbAuthOk={dbAuthOk}
          dbAuthLoading={dbAuthLoading}
        />
      </div>
    </Layout>
  );
}
