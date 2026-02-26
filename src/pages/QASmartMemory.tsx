import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  CheckCircle2,
  XCircle,
  Play,
  Trash2,
  ExternalLink,
  Loader2,
  FlaskConical,
  ArrowRight,
} from 'lucide-react';

interface SeedResult {
  success: boolean;
  already_existed?: boolean;
  project_id?: string;
  message?: string;
  error?: string;
}

/**
 * Dev-only QA page for Smart Memory validation.
 * Seeds a disposable project with tasks, trades, assignments, and logs,
 * then provides navigation links to verify each Smart Memory flow.
 */
export default function QASmartMemory() {
  const { user } = useAuth();
  const { activeOrganization } = useOrganization();
  const navigate = useNavigate();

  const [seeding, setSeeding] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [seedResult, setSeedResult] = useState<SeedResult | null>(null);

  // Dev guard — this page should never render in production builds
  if (!import.meta.env.DEV) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">QA mode is only available in development.</p>
      </div>
    );
  }

  const orgId = activeOrganization?.id;

  const handleSeed = async () => {
    if (!orgId) { toast.error('No organization selected'); return; }
    setSeeding(true);
    setSeedResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('seed-qa-smart-memory', {
        body: { organizationId: orgId, action: 'seed' },
      });
      if (error) { toast.error(error.message); return; }
      setSeedResult(data as SeedResult);
      if (data?.success) toast.success(data.already_existed ? 'QA project already exists' : 'QA data seeded');
      else toast.error(data?.error || 'Seed failed');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSeeding(false);
    }
  };

  const handleReset = async () => {
    if (!orgId) return;
    setResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke('seed-qa-smart-memory', {
        body: { organizationId: orgId, action: 'reset' },
      });
      if (error) { toast.error(error.message); return; }
      setSeedResult(null);
      toast.success(`Reset complete. Deleted ${data?.deleted_projects ?? 0} QA project(s).`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setResetting(false);
    }
  };

  const projectId = seedResult?.project_id;

  const checklist = [
    {
      category: 'Onboarding',
      items: [
        { label: 'Wizard resume (refresh mid-step)', path: '/welcome', requiresProject: false },
      ],
    },
    {
      category: 'Smart Memory — CreateTaskModal',
      items: [
        { label: 'Open Create Task → verify trade chips', path: `/tasks?projectId=${projectId}`, requiresProject: true },
        { label: 'Verify location chips appear', path: `/tasks?projectId=${projectId}`, requiresProject: true },
        { label: 'Verify crew count / weather prefill in Daily Log', path: `/daily-logs?projectId=${projectId}`, requiresProject: true },
      ],
    },
    {
      category: 'Smart Memory — TaskDetailModal',
      items: [
        { label: 'Open a [QA-SEED] task → see "Recently used on this project" worker chips', path: `/tasks?projectId=${projectId}`, requiresProject: true },
        { label: 'Click chip → worker assigned (toast)', path: `/tasks?projectId=${projectId}`, requiresProject: true },
        { label: 'Click same chip again → "Already assigned" toast (23505)', path: `/tasks?projectId=${projectId}`, requiresProject: true },
      ],
    },
    {
      category: 'Playbooks',
      items: [
        { label: 'Create project → verify playbook selection step', path: '/projects', requiresProject: false },
        { label: '"Set as default" prompt appears (admin/PM only)', path: '/projects', requiresProject: false },
      ],
    },
    {
      category: 'Permissions',
      items: [
        { label: 'Worker role cannot see admin routes', path: '/admin/ui-smoke', requiresProject: false },
        { label: 'Foreman cannot access /users', path: '/users', requiresProject: false },
      ],
    },
  ];

  return (
    <div className="container max-w-3xl py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <FlaskConical className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">QA: Smart Memory & Onboarding</h1>
          <p className="text-sm text-muted-foreground">Dev-only. Seeds disposable data for manual flow validation.</p>
        </div>
      </div>

      {/* Seed / Reset controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Seed Controls</CardTitle>
          <CardDescription>
            Org: <code className="text-xs">{orgId?.slice(0, 8) ?? 'none'}…</code> &nbsp;|&nbsp;
            User: <code className="text-xs">{user?.email}</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={handleSeed} disabled={seeding || !orgId} size="sm">
            {seeding ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Play className="h-4 w-4 mr-1.5" />}
            {seeding ? 'Seeding…' : 'Seed QA Data'}
          </Button>
          <Button onClick={handleReset} disabled={resetting || !orgId} variant="destructive" size="sm">
            {resetting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
            {resetting ? 'Resetting…' : 'Reset QA Data'}
          </Button>
        </CardContent>
      </Card>

      {/* Seed result */}
      {seedResult && (
        <Card className={seedResult.success ? 'border-primary/30' : 'border-destructive'}>
          <CardContent className="p-4 flex items-start gap-3">
            {seedResult.success
              ? <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              : <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />}
            <div className="space-y-1">
              <p className="text-sm">{seedResult.message || seedResult.error}</p>
              {projectId && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-mono">{projectId.slice(0, 8)}…</Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs"
                    onClick={() => navigate(`/tasks?projectId=${projectId}`)}
                  >
                    Open Tasks <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* QA Checklist */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Validation Checklist</h2>
        {checklist.map((section) => (
          <Card key={section.category}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{section.category}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {section.items.map((item, i) => {
                const disabled = item.requiresProject && !projectId;
                return (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <span className={`text-sm ${disabled ? 'text-muted-foreground' : ''}`}>
                      {item.label}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs shrink-0"
                      disabled={disabled}
                      onClick={() => navigate(item.path)}
                    >
                      Go <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
