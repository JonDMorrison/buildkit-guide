import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Shield, FlaskConical, Brain } from 'lucide-react';
import { useOrganization } from '@/hooks/useOrganization';
import { NoAccess } from '@/components/NoAccess';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOperationalProfile } from '@/hooks/useOperationalProfile';

export default function OrgSettings() {
  const { activeOrganization, activeOrganizationId, isOrgAdmin, loading: orgLoading } = useOrganization();
  const { toast } = useToast();
  const [sandboxToggling, setSandboxToggling] = useState(false);
  const [optimisticSandbox, setOptimisticSandbox] = useState<boolean | null>(null);

  // AI Configuration state
  const { profile: opProfile, saveProfile, isSaving: isAiSaving } = useOperationalProfile();
  const [aiMode, setAiMode] = useState('balanced');
  const [aiAutoChangeOrders, setAiAutoChangeOrders] = useState(false);
  const [aiFlagRisk, setAiFlagRisk] = useState(true);
  const [aiRecommendPricing, setAiRecommendPricing] = useState(false);

  useEffect(() => {
    setAiMode(opProfile.ai_risk_mode || 'balanced');
    setAiAutoChangeOrders(opProfile.ai_auto_change_orders);
    setAiFlagRisk(opProfile.ai_flag_profit_risk);
    setAiRecommendPricing(opProfile.ai_recommend_pricing);
  }, [opProfile]);

  const handleSaveAI = async () => {
    try {
      await saveProfile({
        ai_risk_mode: aiMode,
        ai_auto_change_orders: aiAutoChangeOrders,
        ai_flag_profit_risk: aiFlagRisk,
        ai_recommend_pricing: aiRecommendPricing,
      });
      toast({ title: 'AI settings saved' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

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
      const { error } = await supabase.rpc('rpc_set_org_sandbox_mode', {
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
    } catch (err) {
      const error = err as Error;
      // Revert optimistic update
      setOptimisticSandbox(null);
      toast({
        title: 'Failed to update sandbox mode',
        description: error.message || 'An error occurred.',
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

        {/* AI Configuration Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Brain className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">AI Configuration</CardTitle>
                <CardDescription>
                  Control how the AI assistant monitors and responds to your projects.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Risk Mode */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">AI Risk Mode</Label>
              <RadioGroup value={aiMode} onValueChange={setAiMode} className="space-y-2">
                {[
                  { value: 'strict', label: 'Strict', desc: 'Block risky actions automatically — best for regulated or high-liability projects' },
                  { value: 'balanced', label: 'Balanced', desc: 'Warn and require confirmation — recommended for most teams' },
                  { value: 'advisory', label: 'Advisory', desc: 'Suggest improvements but never block — for teams who want full control' },
                ].map(opt => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      aiMode === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <RadioGroupItem value={opt.value} className="mt-0.5" />
                    <div>
                      <span className="font-medium text-sm">{opt.label}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>

            {/* Toggles */}
            <div className="space-y-3">
              {[
                { key: 'autoChangeOrders', label: 'Auto-generate change order suggestions', desc: 'AI suggests change orders when scope deviations are detected', value: aiAutoChangeOrders, setter: setAiAutoChangeOrders },
                { key: 'flagRisk', label: 'Flag profit risk early', desc: 'AI monitors burn rate and warns before margins erode', value: aiFlagRisk, setter: setAiFlagRisk },
                { key: 'recommendPricing', label: 'Recommend price adjustments', desc: 'AI suggests rate changes based on historical variance data', value: aiRecommendPricing, setter: setAiRecommendPricing },
              ].map(item => (
                <div key={item.key} className="flex items-start gap-4 p-3 rounded-lg border border-border bg-muted/30">
                  <Switch checked={item.value} onCheckedChange={item.setter} className="mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <Button onClick={handleSaveAI} disabled={isAiSaving} className="gap-1.5">
              {isAiSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save AI Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
