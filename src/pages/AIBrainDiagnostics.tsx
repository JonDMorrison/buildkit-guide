import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { NoAccess } from '@/components/NoAccess';
import { RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import DiagnosticsSection from './ai-brain/DiagnosticsSection';
import MarginToolsSection from './ai-brain/MarginToolsSection';
import OSOperationsSection from './ai-brain/OSOperationsSection';

export default function AIBrainDiagnostics() {
  const { session } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { activeOrganizationId } = useOrganization();
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  // Shared DB auth state (needed by MarginTools + OSOperations)
  const [dbAuthOk, setDbAuthOk] = useState(false);
  const [dbAuthLoading, setDbAuthLoading] = useState(true);

  // Fetch projects
  useEffect(() => {
    if (!activeOrganizationId) return;
    supabase.from('projects').select('id, name').eq('organization_id', activeOrganizationId)
      .order('name').then(({ data }) => setProjects(data || []));
  }, [activeOrganizationId]);

  // DB auth check for child sections
  useEffect(() => {
    (async () => {
      setDbAuthLoading(true);
      try {
        const { data, error } = await (supabase as any).rpc('rpc_whoami');
        setDbAuthOk(!error && !!data?.uid);
      } catch {
        setDbAuthOk(false);
      } finally {
        setDbAuthLoading(false);
      }
    })();
  }, []);

  if (roleLoading) {
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
