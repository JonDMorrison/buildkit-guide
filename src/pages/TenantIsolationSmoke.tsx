import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { useOrganizationRole } from '@/hooks/useOrganizationRole';
import { useUserRole } from '@/hooks/useUserRole';
import { useRouteAccess } from '@/hooks/useRouteAccess';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { NoAccess } from '@/components/NoAccess';
import { Loader2, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface ProbeResult {
  label: string;
  count: number | null;
  status: 'pass' | 'error';
  error?: string;
}

function useTenantProbes(orgId: string | null) {
  return useQuery({
    queryKey: ['tenant-isolation-probes', orgId],
    queryFn: async (): Promise<ProbeResult[]> => {
      if (!orgId) return [];

      const probes: ProbeResult[] = [];

      // Probe 1: Projects count (RLS-scoped)
      try {
        const { count, error } = await supabase
          .from('projects')
          .select('*',{ count: 'exact',head: true })
          .eq('organization_id',orgId);
        probes.push({
          label: 'Projects (org-scoped)',count: error ? null : count,status: error ? 'error' : 'pass',error: error?.message,});
      } catch (e: any) {
        probes.push({ label: 'Projects (org-scoped)',count: null,status: 'error',error: e.message });
      }

      // Probe 2: Tasks count (RLS-scoped via project membership)
      try {
        const { count,error } = await supabase
          .from('tasks')
          .select('*',{ count: 'exact',head: true });
        probes.push({
          label: 'Tasks (RLS-visible)',count: error ? null : count,status: error ? 'error' : 'pass',error: error?.message,});
      } catch (e: any) {
        probes.push({ label: 'Tasks (RLS-visible)',count: null,status: 'error',error: e.message });
      }

      // Probe 3: Estimates count (org-scoped)
      try {
        const { count,error } = await supabase
          .from('estimates')
          .select('*',{ count: 'exact',head: true })
          .eq('organization_id',orgId);
        probes.push({
          label: 'Estimates (org-scoped)',count: error ? null : count,status: error ? 'error' : 'pass',error: error?.message,});
      } catch (e: any) {
        probes.push({ label: 'Estimates (org-scoped)',count: null,status: 'error',error: e.message });
      }

      // Probe 4: Change orders (org-scoped)
      try {
        const { count,error } = await supabase
          .from('change_orders')
          .select('*',{ count: 'exact',head: true })
          .eq('organization_id',orgId);
        probes.push({
          label: 'Change Orders (org-scoped)',count: error ? null : count,status: error ? 'error' : 'pass',error: error?.message,});
      } catch (e: any) {
        probes.push({ label: 'Change Orders (org-scoped)',count: null,status: 'error',error: e.message });
      }

      // Probe 5: Organization memberships (only current org)
      try {
        const { count,error } = await supabase
          .from('organization_memberships')
          .select('*',{ count: 'exact',head: true })
          .eq('organization_id',orgId)
          .eq('is_active',true);
        probes.push({
          label: 'Org Members (active)',count: error ? null : count,status: error ? 'error' : 'pass',error: error?.message,});
      } catch (e: any) {
        probes.push({ label: 'Org Members (active)',count: null,status: 'error',error: e.message });
      }

      return probes;
    },enabled: !!orgId,staleTime: 0,});
}

function SmokeContent() {
  const { user } = useAuth();
  const { activeOrganization,activeOrganizationId } = useOrganization();
  const { role: orgRole } = useOrganizationRole();
  const { roles: globalRoles } = useUserRole();
  const routeAccess = useRouteAccess();
  const { data: probes,isLoading: probesLoading } = useTenantProbes(activeOrganizationId);

  // Count project memberships
  const { data: projectMemberCount } = useQuery({
    queryKey: ['tenant-smoke-pm-count',user?.id],queryFn: async () => {
      const { count } = await supabase
        .from('project_members')
        .select('*',{ count: 'exact',head: true })
        .eq('user_id',user!.id);
      return count ?? 0;
    },enabled: !!user?.id,});

  return (
    <div className="container mx-auto py-8 space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Tenant Isolation Smoke Test</h1>
          <p className="text-sm text-muted-foreground">
            Read-only verification of org context wiring and RLS scoping.
          </p>
        </div>
      </div>

      {/* Identity & Context */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identity & Context</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">User ID:</span>
              <p className="font-mono text-xs break-all">{user?.id}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Email:</span>
              <p>{user?.email}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Active Org:</span>
              <p className="font-semibold">{activeOrganization?.name ?? '—'}</p>
              <p className="font-mono text-xs text-muted-foreground break-all">{activeOrganizationId}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Org Role:</span>
              <Badge variant="outline" className="ml-1">{orgRole ?? 'none'}</Badge>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Role Sources</h4>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Global Roles:</span>
                <p>{globalRoles.length > 0 ? globalRoles.join(',') : 'none'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Org Membership:</span>
                <p>{orgRole ?? 'none'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Project Memberships:</span>
                <p>{projectMemberCount ?? '…'}</p>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Derived Permissions (useRouteAccess)</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(routeAccess)
                .filter(([k]) => k !== 'loading')
                .map(([key, val]) => (
                  <Badge
                    key={key}
                    variant={val ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {key}: {String(val)}
                  </Badge>
                ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* RLS Probes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">RLS Isolation Probes (Read-Only)</CardTitle>
        </CardHeader>
        <CardContent>
          {probesLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Running probes…
            </div>
          ) : (
            <div className="space-y-2">
              {probes?.map((probe, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    {probe.status === 'pass' ? (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    )}
                    <span className="text-sm">{probe.label}</span>
                  </div>
                  <div className="text-right">
                    {probe.status === 'pass' ? (
                      <span className="font-mono text-sm">{probe.count}</span>
                    ) : (
                      <span className="text-xs text-destructive">{probe.error}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-4">
            All counts above are scoped by RLS + org filter. If isolation is working, these counts
            should only reflect data belonging to <strong>{activeOrganization?.name}</strong>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Admin-only tenant isolation smoke test page.
 * Route gate: AdminRoute in App.tsx
 * Page gate: useRouteAccess (defense-in-depth)
 */
export default function TenantIsolationSmoke() {
  const { isAdmin, loading } = useRouteAccess();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return <NoAccess title="Admin Only" message="Tenant isolation diagnostics require admin access." />;
  }

  return <SmokeContent />;
}
