import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { UnratedLaborBanner } from '@/components/UnratedLaborBanner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { TradeBadge } from '@/components/TradeBadge';
import { ListItem } from '@/components/ListItem';
import { EditProjectModal } from '@/components/EditProjectModal';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuthRole } from '@/hooks/useAuthRole';
import { useProjectWorkflow } from '@/hooks/useProjectWorkflow';
import { useProjectIntegrity } from '@/hooks/useProjectIntegrity';
import { IntegrityBadge } from '@/components/IntegrityBadge';
import { ProjectStatusDropdown } from '@/components/ProjectStatusDropdown';
import { ProjectScopeTab } from '@/components/scope/ProjectScopeTab';
import { ProjectBudgetTab } from '@/components/budget/ProjectBudgetTab';
import { EconomicControlPanel } from '@/components/project/EconomicControlPanel';
import { AIInsightsSection } from '@/components/ai-insights';
import { ProjectContextBanner } from '@/components/projects/ProjectContextBanner';
import { ProgressStrip } from '@/components/project/ProgressStrip';
import { WorkTab } from '@/components/project/WorkTab';
import { FinancialsTab } from '@/components/project/FinancialsTab';
import { DocumentsTab } from '@/components/project/DocumentsTab';
import { SectionHelp } from '@/components/dashboard/shared/SectionHelp';
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  AlertTriangle, Shield, CheckCircle2, FileText, Users, Calendar,
  MoreVertical, Archive, Receipt, Pencil, FileImage, Trash2,
  Zap, DollarSign, Loader2,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface Project {
  id: string;
  name: string;
  job_number: string | null;
  location: string;
  billing_address: string | null;
  description: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  client_id: string | null;
  pm_contact_name: string | null;
  pm_email: string | null;
  pm_phone: string | null;
  currency: string | null;
}

interface ProjectStats {
  totalTasks: number;
  completedTasks: number;
  blockedTasks: number;
  safetyCompliance: number;
}

interface MiniTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  due_date: string | null;
  trades: {
    name: string;
    trade_type: string | null;
  } | null;
}

interface ProjectMember {
  id: string;
  profiles: {
    full_name: string | null;
    email: string;
  } | null;
  trades: {
    name: string;
    trade_type: string | null;
    company_name: string | null;
  } | null;
}

interface SafetyForm {
  id: string;
  title: string;
  status: string;
  form_type: string;
  created_at: string;
}

interface ProjectAttachment {
  id: string;
  file_name: string;
  file_type: string;
  file_url: string;
  document_type: string | null;
  created_at: string;
}

interface Deficiency {
  id: string;
  title: string;
  location: string | null;
  status: string;
  trades: {
    name: string;
    trade_type: string | null;
  } | null;
}

// ── Main Component ─────────────────────────────────────────────────────────

const ProjectOverview = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const validTabs = ['overview', 'work', 'financials', 'documents', 'issues'];
  const tabParam = searchParams.get('tab') ?? 'overview';
  const initialTab = validTabs.includes(tabParam) ? tabParam : 'overview';
  const { toast } = useToast();
  const { can, loading: roleLoading } = useAuthRole(projectId);
  const [project, setProject] = useState<Project | null>(null);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const canManageProject = projectId ? can('manage_project', projectId) : false;
  const { integrity } = useProjectIntegrity(projectId ?? null);

  useEffect(() => {
    if (!projectId) return;

    const fetchProjectData = async () => {
      try {
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single();

        if (projectError) throw projectError;
        setProject(projectData);

        const { data: tasks, error: tasksError } = await supabase
          .from('tasks')
          .select('status')
          .eq('project_id', projectId)
          .eq('is_deleted', false);

        if (tasksError) throw tasksError;

        const totalTasks = tasks?.length || 0;
        const completedTasks = tasks?.filter(t => t.status === 'done').length || 0;
        const blockedTasks = tasks?.filter(t => t.status === 'blocked').length || 0;

        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const { data: safetyForms, error: safetyError } = await supabase
          .from('safety_forms')
          .select('status')
          .eq('project_id', projectId)
          .gte('created_at', oneWeekAgo.toISOString());

        if (safetyError) throw safetyError;

        const totalForms = safetyForms?.length || 0;
        const reviewedForms = safetyForms?.filter(f => f.status === 'reviewed').length || 0;
        const safetyCompliance = totalForms > 0 ? Math.round((reviewedForms / totalForms) * 100) : 100;

        setStats({ totalTasks, completedTasks, blockedTasks, safetyCompliance });
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : 'An unknown error occurred';
        toast({ title: 'Error loading project', description: errorMsg, variant: 'destructive' });
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    fetchProjectData();
  }, [projectId, navigate, toast]);

  const handleArchiveProject = async () => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ is_deleted: true })
        .eq('id', projectId);
      if (error) throw error;
      toast({ title: 'Project archived', description: 'This project has been archived successfully.' });
      navigate('/');
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'An unknown error occurred';
      toast({ title: 'Error archiving project', description: errorMsg, variant: 'destructive' });
    } finally {
      setArchiveDialogOpen(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="container max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!project) return null;

  const completion = stats ? Math.round((stats.completedTasks / (stats.totalTasks || 1)) * 100) : 0;

  return (
    <Layout>
      <div className="container max-w-4xl mx-auto px-4 py-6 space-y-4">

        {/* ── Breadcrumb (replaces Back button + fixes UUID) ── */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/projects">Projects</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{project.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <ProjectContextBanner />
        <UnratedLaborBanner projectId={projectId} />

        {/* ── Consolidated Header ── */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-foreground truncate">{project.name}</h1>
              {project.job_number && (
                <Badge variant="outline" className="text-sm font-mono shrink-0">
                  #{project.job_number}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3">
              <p className="text-muted-foreground">{project.location}</p>
              <ProjectStatusDropdown
                projectId={projectId!}
                status={project.status}
                canEdit={canManageProject}
                onStatusChanged={(newStatus) => setProject(prev => prev ? { ...prev, status: newStatus } : prev)}
              />
            </div>
          </div>

          {/* Kebab menu (now includes currency, integrity, workflow toggle) */}
          {canManageProject && (
            <KebabMenu
              project={project}
              projectId={projectId!}
              integrity={integrity}
              canManageProject={canManageProject}
              onEditClick={() => setEditModalOpen(true)}
              onArchiveClick={() => setArchiveDialogOpen(true)}
              onDeleteClick={() => setDeleteDialogOpen(true)}
              onCurrencyChange={(val) => setProject(prev => prev ? { ...prev, currency: val } : prev)}
            />
          )}
        </div>

        {/* ── Compact Progress Strip (replaces 3 stat cards) ── */}
        <ProgressStrip
          completion={completion}
          totalTasks={stats?.totalTasks || 0}
          blockedTasks={stats?.blockedTasks || 0}
          safetyCompliance={stats?.safetyCompliance || 0}
        />

        {/* ── 5-Tab Bar ── */}
        <Tabs defaultValue={initialTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
            <TabsTrigger value="work" className="text-xs sm:text-sm">Work</TabsTrigger>
            <TabsTrigger value="financials" className="text-xs sm:text-sm">Financials</TabsTrigger>
            <TabsTrigger value="documents" className="text-xs sm:text-sm">Docs</TabsTrigger>
            <TabsTrigger value="issues" className="text-xs sm:text-sm">Issues</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <SimplifiedOverviewTab projectId={projectId!} stats={stats} />
          </TabsContent>

          <TabsContent value="work" className="mt-4">
            <WorkTab projectId={projectId!}>
              {{
                tasks: <ProjectTasks projectId={projectId!} />,
                lookahead: <ProjectLookahead projectId={projectId!} />,
                trades: <ProjectTrades projectId={projectId!} />,
              }}
            </WorkTab>
          </TabsContent>

          <TabsContent value="financials" className="mt-4">
            <FinancialsTab projectId={projectId!}>
              {{
                scope: <ProjectScopeTab projectId={projectId!} />,
                budget: <ProjectBudgetTab projectId={projectId!} />,
                receipts: <ProjectReceiptsTab projectId={projectId!} />,
              }}
            </FinancialsTab>
          </TabsContent>

          <TabsContent value="documents" className="mt-4">
            <DocumentsTab projectId={projectId!}>
              {{
                drawings: <ProjectDrawings projectId={projectId!} />,
                docs: <ProjectDocuments projectId={projectId!} />,
                safety: <ProjectSafety projectId={projectId!} />,
              }}
            </DocumentsTab>
          </TabsContent>

          <TabsContent value="issues" className="mt-4">
            <IssuesTab projectId={projectId!} />
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        <ArchiveDialog
          open={archiveDialogOpen}
          onOpenChange={setArchiveDialogOpen}
          projectName={project.name}
          onConfirm={handleArchiveProject}
        />
        <DeleteDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          projectName={project.name}
          projectId={projectId!}
        />
        <EditProjectModal
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          project={project}
          onSuccess={() => {
            if (projectId) {
              supabase.from('projects').select('*').eq('id', projectId).single()
                .then(({ data }) => { if (data) setProject(data); });
            }
          }}
        />
      </div>
    </Layout>
  );
};

// ── Kebab Menu (currency, integrity, workflow, edit, archive, delete) ──────

function KebabMenu({
  project, projectId, integrity, canManageProject,
  onEditClick, onArchiveClick, onDeleteClick, onCurrencyChange,
}: {
  project: Project;
  projectId: string;
  integrity: {
    status: string;
    score: number;
    blockers: string[];
  } | null;
  canManageProject: boolean;
  onEditClick: () => void;
  onArchiveClick: () => void;
  onDeleteClick: () => void;
  onCurrencyChange: (val: string) => void;
}) {
  const { toast } = useToast();
  const { workflow, setFlowMode } = useProjectWorkflow(projectId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreVertical className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {/* Currency */}
        <div className="px-2 py-1.5">
          <p className="text-xs text-muted-foreground mb-1">Currency</p>
          <Select
            value={project.currency || 'CAD'}
            onValueChange={async (val) => {
              const { error } = await supabase.rpc('rpc_update_project_currency', {
                p_project_id: projectId,
                p_currency: val,
              });
              if (error) {
                toast({ title: 'Cannot change currency', description: error.message, variant: 'destructive' });
              } else {
                onCurrencyChange(val);
                toast({ title: `Currency set to ${val}` });
              }
            }}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CAD">CAD ($)</SelectItem>
              <SelectItem value="USD">USD ($)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Integrity */}
        {integrity && (
          <div className="px-2 py-1.5 border-t">
            <p className="text-xs text-muted-foreground mb-1">Integrity</p>
            <IntegrityBadge
              status={integrity.status}
              score={integrity.score}
              blockers={integrity.blockers}
            />
          </div>
        )}

        {/* Workflow toggle */}
        <div className="px-2 py-1.5 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs">AI Workflow</span>
            </div>
            <Switch
              checked={workflow?.flow_mode === 'ai_optimized'}
              onCheckedChange={(checked) => setFlowMode.mutate(checked ? 'ai_optimized' : 'standard')}
              disabled={setFlowMode.isPending}
            />
          </div>
        </div>

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onEditClick}>
          <Pencil className="h-4 w-4 mr-2" />
          Edit Project
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onArchiveClick} className="text-status-issue">
          <Archive className="h-4 w-4 mr-2" />
          Archive Project
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDeleteClick} className="text-destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Simplified Overview Tab ────────────────────────────────────────────────

function SimplifiedOverviewTab({ projectId, stats }: { projectId: string; stats: ProjectStats | null }) {
  const navigate = useNavigate();
  const [blockedTasks, setBlockedTasks] = useState<MiniTask[]>([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<MiniTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOverviewData = async () => {
      const { data: blocked } = await supabase
        .from('tasks')
        .select('*,trades(name,trade_type)')
        .eq('project_id', projectId)
        .eq('status', 'blocked')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(5);

      setBlockedTasks((blocked as unknown) as MiniTask[] || []);

      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const { data: upcoming } = await supabase
        .from('tasks')
        .select('*,trades(name,trade_type)')
        .eq('project_id', projectId)
        .eq('is_deleted', false)
        .gte('due_date', today.toISOString().split('T')[0])
        .lte('due_date', nextWeek.toISOString().split('T')[0])
        .order('due_date', { ascending: true })
        .limit(5);

      setUpcomingDeadlines((upcoming as unknown) as MiniTask[] || []);
      setLoading(false);
    };

    fetchOverviewData();
  }, [projectId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  type AttentionItem = MiniTask & { _type: 'blocked' | 'deadline' };

  const attentionItems: AttentionItem[] = [
    ...blockedTasks.map(t => ({ ...t, _type: 'blocked' as const })),
    ...upcomingDeadlines.map(t => ({ ...t, _type: 'deadline' as const })),
  ];

  return (
    <div className="space-y-6">
      {/* At a Glance — Economic Control */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-base font-semibold">At a Glance</h3>
          <SectionHelp text="High-level economic health of this project — risk score, position, and required actions." />
        </div>
        <EconomicControlPanel projectId={projectId} />
      </div>

      {/* AI Insights (moved from above tabs into Overview tab) */}
      <AIInsightsSection projectId={projectId} />

      {/* Key Contacts */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-base font-semibold">Key Contacts</h3>
          <SectionHelp text="Billing, PM, and site contacts for this project's client." />
        </div>
        <CustomerHierarchyCard projectId={projectId} />
      </div>

      {/* What Needs Attention (merged blockers + deadlines, hidden if empty) */}
      {attentionItems.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-base font-semibold">Needs Attention</h3>
            <Badge variant="destructive" className="text-xs">{attentionItems.length}</Badge>
            <SectionHelp text="Blocked tasks and upcoming deadlines that need your immediate attention." />
          </div>
          <Card>
            <CardContent className="py-3">
              <div className="space-y-2">
                {attentionItems.map((item) => (
                  <ListItem
                    key={item.id}
                    title={item.title}
                    subtitle={
                      item._type === 'blocked'
                        ? `Blocked • ${item.trades?.name || 'Unassigned'}`
                        : `Due: ${new Date(item.due_date).toLocaleDateString()}`
                    }
                    leading={
                      <StatusBadge
                        status={item._type === 'blocked' ? 'blocked' : 'progress'}
                        dotOnly
                      />
                    }
                    trailing={item.trades && <TradeBadge trade={item.trades.trade_type} />}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ── Issues Tab (Deficiencies + Trades list) ────────────────────────────────

function IssuesTab({ projectId }: { projectId: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Issues</h2>
        <SectionHelp text="Deficiencies, punch list items, and quality issues to resolve." />
      </div>
      <ProjectDeficiencies projectId={projectId} />
    </div>
  );
}

// ── Dialogs ────────────────────────────────────────────────────────────────

function ArchiveDialog({ open, onOpenChange, projectName, onConfirm }: {
  open: boolean; onOpenChange: (v: boolean) => void; projectName: string; onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive Project?</AlertDialogTitle>
          <AlertDialogDescription>
            This will archive "{projectName}" and hide it from the active project list.
            All tasks, documents, and data will be preserved.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-status-issue hover:bg-status-issue/90">
            Archive Project
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteDialog({ open, onOpenChange, projectName, projectId }: {
  open: boolean; onOpenChange: (v: boolean) => void; projectName: string; projectId: string;
}) {
  const navigate = useNavigate();
  const { toast } = useToast();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Permanently Delete Project?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">This will permanently delete "{projectName}" and all associated data including:</span>
            <span className="block font-medium text-destructive">• All tasks, blockers, and assignments</span>
            <span className="block font-medium text-destructive">• All documents, drawings, and attachments</span>
            <span className="block font-medium text-destructive">• All safety forms and deficiency records</span>
            <span className="block font-medium text-destructive">• All receipts and daily logs</span>
            <span className="block mt-2">This action cannot be undone.</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => {
              try {
                const { error } = await supabase.from('projects').delete().eq('id', projectId);
                if (error) throw error;
                toast({ title: 'Project deleted', description: 'The project has been permanently deleted.' });
                navigate('/');
              } catch (error: unknown) {
                const errorMsg = error instanceof Error ? error.message : 'An unknown error occurred';
                toast({ title: 'Error deleting project', description: errorMsg, variant: 'destructive' });
              } finally {
                onOpenChange(false);
              }
            }}
            className="bg-destructive hover:bg-destructive/90"
          >
            Delete Permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface Client {
  id: string;
  name: string;
  billing_address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  ap_email: string | null;
  ap_contact_name: string | null;
  ap_phone: string | null;
  gst_number: string | null;
  pm_contact_name: string | null;
  pm_email: string | null;
  pm_phone: string | null;
  contact_name: string | null;
  site_contact_name: string | null;
  site_contact_email: string | null;
  site_contact_phone: string | null;
  zones: number;
  parent_client_id: string | null;
}

const CustomerHierarchyCard = ({ projectId }: { projectId: string }) => {
  const [clientData, setClientData] = useState<Client | null>(null);
  const [parentData, setParentData] = useState<Client | null>(null);
  const [projectPm, setProjectPm] = useState<{ pm_contact_name: string | null; pm_email: string | null; pm_phone: string | null }>({ pm_contact_name: null, pm_email: null, pm_phone: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: proj, error: projError } = await supabase
        .from('projects')
        .select('client_id,pm_contact_name,pm_email,pm_phone')
        .eq('id', projectId)
        .single();
      
      if (projError || !proj) { setLoading(false); return; }
      
      setProjectPm({ 
        pm_contact_name: proj.pm_contact_name, 
        pm_email: proj.pm_email, 
        pm_phone: proj.pm_phone 
      });
      
      const cid = proj.client_id;
      if (!cid) { setLoading(false); return; }
      
      const { data: client } = await supabase.from('clients').select('*').eq('id', cid).single();
      if (client) {
        setClientData(client);
        if (client.parent_client_id) {
          const { data: parent } = await supabase.from('clients').select('*').eq('id', client.parent_client_id).single();
          setParentData(parent);
        }
      }
      setLoading(false);
    };
    fetch();
  }, [projectId]);

  if (loading) return <Skeleton className="h-40" />;
  if (!clientData) return null;

  const billingClient = parentData || clientData;
  const effectivePmName = projectPm.pm_contact_name || clientData.pm_contact_name || clientData.contact_name;
  const effectivePmEmail = projectPm.pm_email || clientData.pm_email;
  const effectivePmPhone = projectPm.pm_phone || clientData.pm_phone;
  const isOverride = !!(projectPm.pm_contact_name || projectPm.pm_email || projectPm.pm_phone);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Customer & Contacts</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="space-y-1.5 p-3 rounded-lg bg-muted/50">
            <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Bill-To (AP) — for Invoices</p>
            <p className="font-medium">{billingClient.name}</p>
            {billingClient.billing_address && <p className="text-muted-foreground">{[billingClient.billing_address, billingClient.city, billingClient.province, billingClient.postal_code].filter(Boolean).join(', ')}</p>}
            {billingClient.ap_email && <p className="text-primary">{billingClient.ap_email}</p>}
            {billingClient.ap_contact_name && <p className="text-muted-foreground">{billingClient.ap_contact_name} {billingClient.ap_phone ? `• ${billingClient.ap_phone}` : ''}</p>}
            {billingClient.gst_number && <p className="text-muted-foreground">GST: {billingClient.gst_number}</p>}
          </div>
          <div className="space-y-1.5 p-3 rounded-lg bg-muted/50">
            <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">PM Contact — for Quotes</p>
            <p className="font-medium">{effectivePmName || '—'}</p>
            {effectivePmEmail && <p className="text-primary">{effectivePmEmail}</p>}
            {effectivePmPhone && <p className="text-muted-foreground">{effectivePmPhone}</p>}
            {isOverride && <Badge variant="outline" className="text-xs">Project Override</Badge>}
          </div>
          <div className="space-y-1.5 p-3 rounded-lg bg-muted/50">
            <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Site Contact</p>
            <p className="font-medium">{clientData.site_contact_name || '—'}</p>
            {clientData.site_contact_email && <p className="text-primary">{clientData.site_contact_email}</p>}
            {clientData.site_contact_phone && <p className="text-muted-foreground">{clientData.site_contact_phone}</p>}
            {clientData.zones > 1 && <p className="text-muted-foreground">{clientData.zones} zones</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ── Existing Tab Sub-Components (logic unchanged) ──────────────────────────

const ProjectTasks = ({ projectId }: { projectId: string }) => {
  const [tasks, setTasks] = useState<MiniTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTasks = async () => {
      const { data } = await supabase
        .from('tasks')
        .select('*,trades(name,trade_type)')
        .eq('project_id', projectId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(10);
      setTasks((data as unknown) as MiniTask[] || []);
      setLoading(false);
    };
    fetchTasks();
  }, [projectId]);

  if (loading) return <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>;
  if (tasks.length === 0) return <EmptyState icon={<CheckCircle2 className="h-8 w-8" />} title="No tasks yet" description="Create your first task to start coordinating work." />;

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <ListItem
          key={task.id}
          title={task.title}
          subtitle={task.description}
          leading={<StatusBadge status={task.status === 'done' ? 'complete' : task.status === 'blocked' ? 'blocked' : task.status === 'in_progress' ? 'progress' : 'info'} dotOnly />}
          trailing={task.trades && <TradeBadge trade={task.trades.trade_type} />}
        />
      ))}
    </div>
  );
};

const ProjectDrawings = ({ projectId }: { projectId: string }) => {
  const [drawings, setDrawings] = useState<ProjectAttachment[]>([]);
  const [filteredDrawings, setFilteredDrawings] = useState<ProjectAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const drawingTypes = [
    { value: 'all', label: 'All' },
    { value: 'plan', label: 'Plans' },
    { value: 'drawing', label: 'Drawings' },
    { value: 'blueprint', label: 'Blueprints' },
    { value: 'specification', label: 'Specs' },
  ];

  useEffect(() => {
    const fetchDrawings = async () => {
      const { data } = await supabase
        .from('attachments')
        .select('*,profiles(full_name)')
        .eq('project_id', projectId)
        .in('document_type', ['plan', 'drawing', 'blueprint', 'specification'])
        .order('created_at', { ascending: false });
      setDrawings((data as unknown) as ProjectAttachment[] || []);
      setFilteredDrawings((data as unknown) as ProjectAttachment[] || []);
      setLoading(false);
    };
    fetchDrawings();
  }, [projectId]);

  useEffect(() => {
    if (activeFilter === 'all') setFilteredDrawings(drawings);
    else setFilteredDrawings(drawings.filter(d => d.document_type === activeFilter));
  }, [activeFilter, drawings]);

  if (loading) return <div className="space-y-4"><Skeleton className="h-10 w-full" /><div className="grid grid-cols-2 md:grid-cols-4 gap-4"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div></div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {drawingTypes.map((type) => (
          <Button key={type.value} variant={activeFilter === type.value ? 'default' : 'outline'} size="sm" onClick={() => setActiveFilter(type.value)}>
            {type.label}
            {type.value !== 'all' && <Badge variant="secondary" className="ml-2">{drawings.filter(d => d.document_type === type.value).length}</Badge>}
          </Button>
        ))}
      </div>
      <Card>
        <CardContent className="py-4">
          <div className="grid grid-cols-4 gap-4 text-center">
            {drawingTypes.slice(1).map((type) => (
              <div key={type.value}>
                <p className="text-2xl font-bold">{drawings.filter(d => d.document_type === type.value).length}</p>
                <p className="text-xs text-muted-foreground">{type.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      {filteredDrawings.length === 0 ? (
        <EmptyState icon={<FileImage className="h-8 w-8" />} title="No drawings found" description={activeFilter === 'all' ? 'Upload drawings, plans, and blueprints for this project.' : `No ${activeFilter}s uploaded yet.`} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredDrawings.map((doc) => (
            <Card key={doc.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => window.open(doc.file_url, '_blank')}>
              <CardContent className="p-4">
                <div className="flex flex-col items-center text-center">
                  {doc.file_type?.startsWith('image/') ? <img src={doc.file_url} alt={doc.file_name} className="w-full h-24 object-cover rounded mb-2" /> : <FileText className="h-12 w-12 text-muted-foreground mb-2" />}
                  <p className="text-sm font-medium truncate w-full">{doc.file_name}</p>
                  <Badge variant="secondary" className="mt-1 capitalize">{doc.document_type || ''}</Badge>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(doc.created_at).toLocaleDateString()}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

const ProjectLookahead = ({ projectId }: { projectId: string }) => {
  const [tasks, setTasks] = useState<MiniTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const twoWeeksFromNow = new Date();
    twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
    const fetchLookahead = async () => {
      const { data } = await supabase
        .from('tasks')
        .select('*,trades(name,trade_type)')
        .eq('project_id', projectId)
        .eq('is_deleted', false)
        .lte('due_date', twoWeeksFromNow.toISOString().split('T')[0])
        .order('due_date', { ascending: true });
      setTasks((data as unknown) as MiniTask[] || []);
      setLoading(false);
    };
    fetchLookahead();
  }, [projectId]);

  if (loading) return <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>;
  if (tasks.length === 0) return <EmptyState icon={<Calendar className="h-8 w-8" />} title="No upcoming tasks" description="Schedule tasks for the next 2 weeks to plan ahead." />;

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <ListItem key={task.id} title={task.title} subtitle={task.due_date ? `Due: ${new Date(task.due_date).toLocaleDateString()}` : 'No due date'} leading={<StatusBadge status={task.status === 'done' ? 'complete' : task.status === 'blocked' ? 'blocked' : 'progress'} dotOnly />} trailing={task.trades && <TradeBadge trade={task.trades.trade_type} />} />
      ))}
    </div>
  );
};

const ProjectTrades = ({ projectId }: { projectId: string }) => {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMembers = async () => {
      const { data } = await supabase
        .from('project_members')
        .select('*,profiles(full_name,email),trades(name,trade_type,company_name)')
        .eq('project_id', projectId);
      setMembers((data as unknown) as ProjectMember[] || []);
      setLoading(false);
    };
    fetchMembers();
  }, [projectId]);

  if (loading) return <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>;
  if (members.length === 0) return <EmptyState icon={<Users className="h-8 w-8" />} title="No team members" description="Add team members and trades to this project." />;

  return (
    <div className="space-y-3">
      {members.map((member) => (
        <ListItem key={member.id} title={member.profiles?.full_name || member.profiles?.email || 'Unknown'} subtitle={member.trades?.company_name || 'No trade assigned'} trailing={member.trades && <TradeBadge trade={member.trades.trade_type} />} showChevron={false} />
      ))}
    </div>
  );
};

const ProjectSafety = ({ projectId }: { projectId: string }) => {
  const [safetyForms, setSafetyForms] = useState<SafetyForm[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSafety = async () => {
      const { data } = await supabase
        .from('safety_forms')
        .select('*')
        .eq('project_id', projectId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(10);
      setSafetyForms((data as unknown) as SafetyForm[] || []);
      setLoading(false);
    };
    fetchSafety();
  }, [projectId]);

  if (loading) return <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>;
  if (safetyForms.length === 0) return <EmptyState icon={<Shield className="h-8 w-8" />} title="No safety forms" description="Submit safety inspections and incident reports." />;

  return (
    <div className="space-y-3">
      {safetyForms.map((form) => (
        <ListItem key={form.id} title={form.title} subtitle={new Date(form.created_at).toLocaleDateString()} leading={<StatusBadge status={form.status === 'reviewed' ? 'complete' : form.status === 'submitted' ? 'progress' : 'info'} dotOnly />} trailing={<Badge variant="outline">{form.form_type}</Badge>} />
      ))}
    </div>
  );
};

const ProjectDocuments = ({ projectId }: { projectId: string }) => {
  const [documents, setDocuments] = useState<ProjectAttachment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDocuments = async () => {
      const { data } = await supabase
        .from('attachments')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(10);
      setDocuments((data as unknown) as ProjectAttachment[] || []);
      setLoading(false);
    };
    fetchDocuments();
  }, [projectId]);

  if (loading) return <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>;
  if (documents.length === 0) return <EmptyState icon={<FileText className="h-8 w-8" />} title="No documents" description="Upload drawings, RFIs, photos, and other project files." />;

  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <ListItem key={doc.id} title={doc.file_name} subtitle={new Date(doc.created_at).toLocaleDateString()} trailing={<Badge variant="outline">{doc.file_type}</Badge>} showChevron={false} />
      ))}
    </div>
  );
};

const ProjectDeficiencies = ({ projectId }: { projectId: string }) => {
  const [deficiencies, setDeficiencies] = useState<Deficiency[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeficiencies = async () => {
      const { data } = await supabase
        .from('deficiencies')
        .select('*,trades(name,trade_type)')
        .eq('project_id', projectId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(10);
      setDeficiencies((data as unknown) as Deficiency[] || []);
      setLoading(false);
    };
    fetchDeficiencies();
  }, [projectId]);

  if (loading) return <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>;
  if (deficiencies.length === 0) return <EmptyState icon={<AlertTriangle className="h-8 w-8" />} title="No deficiencies" description="Track quality issues and punch list items." />;

  return (
    <div className="space-y-3">
      {deficiencies.map((def) => (
        <ListItem key={def.id} title={def.title} subtitle={def.location || 'No location'} leading={<StatusBadge status={def.status === 'verified' ? 'complete' : def.status === 'fixed' ? 'progress' : 'blocked'} dotOnly />} trailing={def.trades && <TradeBadge trade={def.trades.trade_type} />} />
      ))}
    </div>
  );
};

const ProjectReceiptsTab = ({ projectId }: { projectId: string }) => {
  const navigate = useNavigate();
  return (
    <div className="text-center py-8">
      <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
      <h3 className="font-medium mb-2">Project Receipts</h3>
      <p className="text-sm text-muted-foreground mb-4">Upload and manage expense receipts for this project.</p>
      <Button onClick={() => navigate(`/projects/${projectId}/receipts`)}>Open Receipts</Button>
    </div>
  );
};

export default ProjectOverview;
