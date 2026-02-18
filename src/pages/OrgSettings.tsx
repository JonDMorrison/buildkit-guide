import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Loader2, Shield, FlaskConical } from 'lucide-react';
import { useOrganization } from '@/hooks/useOrganization';
import { NoAccess } from '@/components/NoAccess';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function OrgSettings() {
  const { activeOrganization, activeOrganizationId, isOrgAdmin, loading: orgLoading } = useOrganization();
  const { toast } = useToast();
  const [sandboxToggling, setSandboxToggling] = useState(false);
  const [optimisticSandbox, setOptimisticSandbox] = useState<boolean | null>(null);

  if (orgLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!isOrgAdmin) {
    return (
      <Layout>
        <NoAccess />
      </Layout>
    );
  }

  const isSandbox = optimisticSandbox ?? activeOrganization?.is_sandbox ?? false;

  const handleSandboxToggle = async (checked: boolean) => {
    if (!activeOrganizationId || sandboxToggling) return;

    setOptimisticSandbox(checked);
    setSandboxToggling(true);

    try {
      const { error } = await supabase.rpc('rpc_set_org_sandbox_mode' as any, {
        p_org_id: activeOrganizationId,
        p_is_sandbox: checked,
      });

      if (error) throw error;

      toast({
        title: checked ? 'Sandbox mode enabled' : 'Sandbox mode disabled',
        description: checked
          ? 'This organization is now marked as sandbox/test data.'
          : 'This organization is now in production mode.',
      });
    } catch (err: any) {
      // Revert optimistic update
      setOptimisticSandbox(null);
      toast({
        title: 'Failed to update sandbox mode',
        description: err.message || 'An error occurred.',
        variant: 'destructive',
      });
    } finally {
      setSandboxToggling(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto py-6 max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Organization Settings</h1>
          <p className="text-muted-foreground">
            Manage settings for {activeOrganization?.name || 'your organization'}
          </p>
        </div>

        {/* Sandbox Mode Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <FlaskConical className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">Sandbox Mode</CardTitle>
                  <Badge variant={isSandbox ? 'default' : 'outline'} className="text-xs">
                    {isSandbox ? 'Sandbox' : 'Production'}
                  </Badge>
                </div>
                <CardDescription>
                  Marks this org as sandbox/test data. Use for demos and trial runs.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Label htmlFor="sandbox-toggle" className="flex items-center gap-2 text-sm cursor-pointer">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span>Enable sandbox mode</span>
              </Label>
              <div className="flex items-center gap-2">
                {sandboxToggling && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                <Switch
                  id="sandbox-toggle"
                  checked={isSandbox}
                  onCheckedChange={handleSandboxToggle}
                  disabled={sandboxToggling}
                />
              </div>
            </div>
            {isSandbox && (
              <p className="text-xs text-muted-foreground mt-3 bg-muted/50 rounded-md p-2">
                Sandbox organizations display a visible badge across the app. Data in sandbox orgs is excluded from production reporting.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
