import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { UnratedLaborBanner } from '@/components/UnratedLaborBanner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuthRole } from '@/hooks/useAuthRole';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, AlertTriangle, Shield, CheckCircle2, FileText, Users, Calendar, Plus, MoreVertical, Archive, Receipt, Pencil, FileImage, Trash2, Zap, DollarSign, Loader2 } from 'lucide-react';
import { DashboardGrid } from '@/components/dashboard/shared/DashboardGrid';
import { DashboardCard } from '@/components/dashboard/shared/DashboardCard';
import { IntegrityBadge } from '@/components/IntegrityBadge';
import { useProjectIntegrity } from '@/hooks/useProjectIntegrity';
import { ProjectScopeTab } from '@/components/scope/ProjectScopeTab';
import { ProjectBudgetTab } from '@/components/budget/ProjectBudgetTab';
import { ProjectStatusDropdown } from '@/components/ProjectStatusDropdown';
import { Switch } from '@/components/ui/switch';
import { useProjectWorkflow } from '@/hooks/useProjectWorkflow';
import { EconomicControlPanel } from '@/components/project/EconomicControlPanel';
import { AIInsightsSection } from '@/components/ai-insights';
import { ProjectContextBanner } from '@/components/projects/ProjectContextBanner';

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

const ProjectOverview = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
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
        // Fetch project details
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single();

        if (projectError) throw projectError;
        setProject(projectData);

        // Fetch task statistics
        const { data: tasks, error: tasksError } = await supabase
          .from('tasks')
          .select('status')
          .eq('project_id', projectId)
          .eq('is_deleted', false);

        if (tasksError) throw tasksError;

        const totalTasks = tasks?.length || 0;
        const completedTasks = tasks?.filter(t => t.status === 'done').length || 0;
        const blockedTasks = tasks?.filter(t => t.status === 'blocked').length || 0;

        // Fetch safety forms for compliance calculation
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

        setStats({
          totalTasks,
          completedTasks,
          blockedTasks,
          safetyCompliance,
        });
      } catch (error: any) {
        toast({
          title: 'Error loading project',
          description: error.message,
          variant: 'destructive',
        });
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

      toast({
        title: 'Project archived',
        description: 'This project has been archived successfully.',
      });

      navigate('/');
    } catch (error: any) {
      toast({
        title: 'Error archiving project',
        description: error.message,
        variant: 'destructive',
      });
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
      <div className="container max-w-4xl mx-auto px-4 py-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-4 -ml-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Projects
        </Button>

        <ProjectContextBanner />

        <UnratedLaborBanner projectId={projectId} />

        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
              {project.job_number && (
                <Badge variant="outline" className="text-sm font-mono">
                  #{project.job_number}
                </Badge>
              )}
              {integrity && (
                <IntegrityBadge
                  status={integrity.status}
                  score={integrity.score}
                  blockers={integrity.blockers}
                />
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
              {canManageProject ? (
                <Select
                  value={project.currency || "CAD"}
                  onValueChange={async (val) => {
                    const { error } = await supabase.rpc('rpc_update_project_currency', {
                      p_project_id: projectId!,
                      p_currency: val,
                    });
                    if (error) {
                      toast({ title: "Cannot change currency", description: error.message, variant: "destructive" });
                    } else {
                      setProject(prev => prev ? { ...prev, currency: val } : prev);
                      toast({ title: `Currency set to ${val}` });
                    }
                  }}
                >
                  <SelectTrigger className="w-24 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CAD">CAD ($)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant="outline" className="text-xs">
                  <DollarSign className="h-3 w-3 mr-0.5" />
                  {project.currency || "CAD"}
                </Badge>
              )}
            </div>
          </div>
          {canManageProject && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditModalOpen(true)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit Project
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setArchiveDialogOpen(true)}
                  className="text-status-issue"
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Archive Project
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setDeleteDialogOpen(true)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Stats Overview */}
        <DashboardGrid columns={3}>
          <DashboardCard title="Overall Progress" icon={CheckCircle2} variant="metric" value={`${completion}%`}>
            <Progress value={completion} />
            <p className="text-xs text-muted-foreground">
              {stats?.completedTasks} of {stats?.totalTasks} tasks complete
            </p>
          </DashboardCard>

          <DashboardCard title="Blocked Tasks" icon={AlertTriangle} variant="metric" value={stats?.blockedTasks || 0}>
            <p className="text-xs text-muted-foreground">
              {stats?.blockedTasks ? 'Requires immediate attention' : 'No blockers'}
            </p>
          </DashboardCard>

          <DashboardCard title="Safety Compliance" icon={Shield} variant="metric" value={`${stats?.safetyCompliance || 0}%`}>
            <p className="text-xs text-muted-foreground">
              This week's forms reviewed
            </p>
          </DashboardCard>
        </DashboardGrid>

        {/* AI Insights Section */}
        <AIInsightsSection projectId={projectId} />

        {/* Tabbed Content */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-11">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="scope">Scope</TabsTrigger>
            <TabsTrigger value="budget">Budget</TabsTrigger>
            <TabsTrigger value="drawings">Drawings</TabsTrigger>
            <TabsTrigger value="lookahead">Lookahead</TabsTrigger>
            <TabsTrigger value="trades">Trades</TabsTrigger>
            <TabsTrigger value="safety">Safety</TabsTrigger>
            <TabsTrigger value="documents">Docs</TabsTrigger>
            <TabsTrigger value="deficiencies">Issues</TabsTrigger>
            <TabsTrigger value="receipts">Receipts</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <ProjectOverviewTab projectId={projectId!} stats={stats} />
          </TabsContent>

          <TabsContent value="tasks" className="mt-4">
            <ProjectTasks projectId={projectId!} />
          </TabsContent>

          <TabsContent value="scope" className="mt-4">
            <ProjectScopeTab projectId={projectId!} />
          </TabsContent>

          <TabsContent value="budget" className="mt-4">
            <ProjectBudgetTab projectId={projectId!} />
          </TabsContent>

          <TabsContent value="drawings" className="mt-4">
            <ProjectDrawings projectId={projectId!} />
          </TabsContent>

          <TabsContent value="lookahead" className="mt-4">
            <ProjectLookahead projectId={projectId!} />
          </TabsContent>

          <TabsContent value="trades" className="mt-4">
            <ProjectTrades projectId={projectId!} />
          </TabsContent>

          <TabsContent value="safety" className="mt-4">
            <ProjectSafety projectId={projectId!} />
          </TabsContent>

          <TabsContent value="documents" className="mt-4">
            <ProjectDocuments projectId={projectId!} />
          </TabsContent>

          <TabsContent value="deficiencies" className="mt-4">
            <ProjectDeficiencies projectId={projectId!} />
          </TabsContent>

          <TabsContent value="receipts" className="mt-4">
            <ProjectReceiptsTab projectId={projectId!} />
          </TabsContent>
        </Tabs>

        {/* Archive Confirmation Dialog */}
        <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Archive Project?</AlertDialogTitle>
              <AlertDialogDescription>
                This will archive "{project.name}" and hide it from the active project list.
                All tasks, documents, and data will be preserved. You can restore archived projects later if needed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleArchiveProject}
                className="bg-status-issue hover:bg-status-issue/90"
              >
                Archive Project
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Permanently Delete Project?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <span className="block">This will permanently delete "{project.name}" and all associated data including:</span>
                <span className="block font-medium text-destructive">• All tasks, blockers, and assignments</span>
                <span className="block font-medium text-destructive">• All documents, drawings, and attachments</span>
                <span className="block font-medium text-destructive">• All safety forms and deficiency records</span>
                <span className="block font-medium text-destructive">• All receipts and daily logs</span>
                <span className="block mt-2">This action cannot be undone. Consider archiving instead if you may need this data later.</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  try {
                    const { error } = await supabase
                      .from('projects')
                      .delete()
                      .eq('id', projectId);
                    if (error) throw error;
                    toast({
                      title: 'Project deleted',
                      description: 'The project has been permanently deleted.',
                    });
                    navigate('/');
                  } catch (error: any) {
                    toast({
                      title: 'Error deleting project',
                      description: error.message,
                      variant: 'destructive',
                    });
                  } finally {
                    setDeleteDialogOpen(false);
                  }
                }}
                className="bg-destructive hover:bg-destructive/90"
              >
                Delete Permanently
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit Project Modal */}
        <EditProjectModal
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          project={project}
          onSuccess={() => {
            // Refresh project data
            if (projectId) {
              supabase
                .from('projects')
                .select('*')
                .eq('id', projectId)
                .single()
                .then(({ data }) => {
                  if (data) setProject(data);
                });
            }
          }}
        />
      </div>
    </Layout>
  );
};

// Customer Hierarchy Card
const CustomerHierarchyCard = ({ projectId }: { projectId: string }) => {
  const [clientData, setClientData] = useState<any>(null);
  const [parentData, setParentData] = useState<any>(null);
  const [projectPm, setProjectPm] = useState<{ pm_contact_name: string | null; pm_email: string | null; pm_phone: string | null }>({ pm_contact_name: null, pm_email: null, pm_phone: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: proj } = await supabase
        .from('projects')
        .select('client_id, pm_contact_name, pm_email, pm_phone')
        .eq('id', projectId)
        .single();
      if (!proj) { setLoading(false); return; }
      setProjectPm({ pm_contact_name: (proj as any).pm_contact_name, pm_email: (proj as any).pm_email, pm_phone: (proj as any).pm_phone });
      const cid = (proj as any).client_id;
      if (!cid) { setLoading(false); return; }
      const { data: client } = await supabase
        .from('clients')
        .select('*')
        .eq('id', cid)
        .single();
      if (client) {
        setClientData(client);
        if ((client as any).parent_client_id) {
          const { data: parent } = await supabase
            .from('clients')
            .select('*')
            .eq('id', (client as any).parent_client_id)
            .single();
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
          {/* Billing / AP (read-only from parent client) */}
          <div className="space-y-1.5 p-3 rounded-lg bg-muted/50">
            <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Bill-To (AP) — for Invoices</p>
            <p className="font-medium">{billingClient.name}</p>
            {billingClient.billing_address && <p className="text-muted-foreground">{[billingClient.billing_address, billingClient.city, billingClient.province, billingClient.postal_code].filter(Boolean).join(", ")}</p>}
            {billingClient.ap_email && <p className="text-primary">{billingClient.ap_email}</p>}
            {billingClient.ap_contact_name && <p className="text-muted-foreground">{billingClient.ap_contact_name} {billingClient.ap_phone ? `• ${billingClient.ap_phone}` : ""}</p>}
            {billingClient.gst_number && <p className="text-muted-foreground">GST: {billingClient.gst_number}</p>}
          </div>

          {/* PM Contact — for Quotes */}
          <div className="space-y-1.5 p-3 rounded-lg bg-muted/50">
            <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">PM Contact — for Quotes</p>
            <p className="font-medium">{effectivePmName || "—"}</p>
            {effectivePmEmail && <p className="text-primary">{effectivePmEmail}</p>}
            {effectivePmPhone && <p className="text-muted-foreground">{effectivePmPhone}</p>}
            {isOverride && <Badge variant="outline" className="text-xs">Project Override</Badge>}
          </div>

          {/* Site Contact */}
          <div className="space-y-1.5 p-3 rounded-lg bg-muted/50">
            <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Site Contact</p>
            <p className="font-medium">{clientData.site_contact_name || "—"}</p>
            {clientData.site_contact_email && <p className="text-primary">{clientData.site_contact_email}</p>}
            {clientData.site_contact_phone && <p className="text-muted-foreground">{clientData.site_contact_phone}</p>}
            {clientData.zones > 1 && <p className="text-muted-foreground">{clientData.zones} zones</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Tab Components
const ProjectOverviewTab = ({ projectId, stats }: { projectId: string; stats: ProjectStats | null }) => {
  const navigate = useNavigate();
  const [blockedTasks, setBlockedTasks] = useState<any[]>([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [pendingManpower, setPendingManpower] = useState<any[]>([]);
  const [drawings, setDrawings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOverviewData = async () => {
      // Fetch top 5 blocked tasks
      const { data: blocked } = await supabase
        .from('tasks')
        .select('*, trades(name, trade_type)')
        .eq('project_id', projectId)
        .eq('status', 'blocked')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(5);

      setBlockedTasks(blocked || []);

      // Fetch upcoming deadlines (next 7 days)
      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const { data: upcoming } = await supabase
        .from('tasks')
        .select('*, trades(name, trade_type)')
        .eq('project_id', projectId)
        .eq('is_deleted', false)
        .gte('due_date', today.toISOString().split('T')[0])
        .lte('due_date', nextWeek.toISOString().split('T')[0])
        .order('due_date', { ascending: true })
        .limit(5);

      setUpcomingDeadlines(upcoming || []);

      // Fetch recent activity (latest 5 tasks created or updated)
      const { data: recent } = await supabase
        .from('tasks')
        .select('*, trades(name, trade_type)')
        .eq('project_id', projectId)
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false })
        .limit(5);

      setRecentActivity(recent || []);

      // Fetch pending manpower requests
      const { data: manpower } = await supabase
        .from('manpower_requests')
        .select('*, trades(name, trade_type), tasks(title)')
        .eq('project_id', projectId)
        .eq('status', 'pending')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(3);

      setPendingManpower(manpower || []);

      // Fetch drawings (plan, drawing, blueprint document types)
      const { data: drawingsData } = await supabase
        .from('attachments')
        .select('*')
        .eq('project_id', projectId)
        .in('document_type', ['plan', 'drawing', 'blueprint', 'specification'])
        .order('created_at', { ascending: false })
        .limit(4);

      setDrawings(drawingsData || []);
      setLoading(false);
    };

    fetchOverviewData();
  }, [projectId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Economic Control Panel */}
      <div id="economic-control">
        <EconomicControlPanel projectId={projectId} />
      </div>

      {/* Customer Hierarchy */}
      <CustomerHierarchyCard projectId={projectId} />

      {/* Drawings Quick Access */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileImage className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Drawings & Plans</CardTitle>
            </div>
            <Badge variant="secondary">{drawings.length} files</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {drawings.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-3">No drawings uploaded yet</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/projects/${projectId}/documents?type=plan`)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Upload Drawings
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                {drawings.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3 bg-background rounded-lg border hover:border-primary/50 cursor-pointer transition-colors"
                    onClick={() => window.open(doc.file_url, '_blank')}
                  >
                    <FileText className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-xs font-medium truncate">{doc.file_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{doc.document_type}</p>
                  </div>
                ))}
              </div>
              <Button
                variant="link"
                className="p-0 h-auto"
                onClick={() => navigate(`/projects/${projectId}/documents?type=plan`)}
              >
                View All Drawings →
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Pending Manpower Requests */}
      {pendingManpower.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Pending Manpower Requests</CardTitle>
              <Badge variant="secondary">{pendingManpower.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingManpower.map((request) => (
                <div
                  key={request.id}
                  className="p-3 bg-muted rounded-lg"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">
                      {request.requested_count} workers • {request.duration_days} days
                    </span>
                    <Badge variant="secondary">Pending</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {request.trades?.name} • Starting {new Date(request.required_date).toLocaleDateString()}
                  </p>
                  {request.tasks && (
                    <p className="text-xs text-muted-foreground mt-1">
                      For task: {request.tasks.title}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <Button
              variant="link"
              className="mt-3 p-0 h-auto"
              onClick={() => navigate('/manpower')}
            >
              View All Requests →
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Blocked Tasks */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Blocked Tasks</CardTitle>
            {blockedTasks.length > 0 && (
              <Badge variant="destructive">{blockedTasks.length}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {blockedTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No blocked tasks - great work!</p>
          ) : (
            <div className="space-y-2">
              {blockedTasks.map((task) => (
                <ListItem
                  key={task.id}
                  title={task.title}
                  subtitle={task.trades?.name || 'Unassigned'}
                  leading={<StatusBadge status="blocked" dotOnly />}
                  trailing={task.trades && <TradeBadge trade={task.trades.trade_type} />}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Deadlines */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upcoming Deadlines (Next 7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingDeadlines.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks due in the next 7 days</p>
          ) : (
            <div className="space-y-2">
              {upcomingDeadlines.map((task) => (
                <ListItem
                  key={task.id}
                  title={task.title}
                  subtitle={`Due: ${new Date(task.due_date).toLocaleDateString()}`}
                  leading={
                    <StatusBadge
                      status={
                        task.status === 'done' ? 'complete' :
                        task.status === 'blocked' ? 'blocked' :
                        task.status === 'in_progress' ? 'progress' : 'info'
                      }
                      dotOnly
                    />
                  }
                  trailing={task.trades && <TradeBadge trade={task.trades.trade_type} />}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity</p>
          ) : (
            <div className="space-y-2">
              {recentActivity.map((task) => (
                <ListItem
                  key={task.id}
                  title={task.title}
                  subtitle={`Updated ${new Date(task.updated_at).toLocaleDateString()}`}
                  leading={
                    <StatusBadge
                      status={
                        task.status === 'done' ? 'complete' :
                        task.status === 'blocked' ? 'blocked' :
                        task.status === 'in_progress' ? 'progress' : 'info'
                      }
                      dotOnly
                    />
                  }
                  trailing={task.trades && <TradeBadge trade={task.trades.trade_type} />}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Task Button */}
      <Button
        onClick={() => navigate('/tasks')}
        className="w-full min-h-[52px]"
        size="lg"
      >
        <Plus className="h-5 w-5 mr-2" />
        Add Task
      </Button>

      {/* Workflow Toggle */}
      <WorkflowToggleCard projectId={projectId} />
    </div>
  );
};

const WorkflowToggleCard = ({ projectId }: { projectId: string }) => {
  const { workflow, setFlowMode } = useProjectWorkflow(projectId);
  const navigate = useNavigate();
  const { can } = useAuthRole(projectId);
  const canManage = can('manage_project', projectId);

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium">AI-Optimized Flow</p>
              <p className="text-xs text-muted-foreground">Guided workflow with phase gating and approvals</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {workflow?.flow_mode === 'ai_optimized' && (
              <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => navigate(`/workflow?projectId=${projectId}`)}>
                View Workflow →
              </Button>
            )}
            {canManage && (
              <Switch
                checked={workflow?.flow_mode === 'ai_optimized'}
                onCheckedChange={(checked) => setFlowMode.mutate(checked ? 'ai_optimized' : 'standard')}
                disabled={setFlowMode.isPending}
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const ProjectTasks = ({ projectId }: { projectId: string }) => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTasks = async () => {
      const { data } = await supabase
        .from('tasks')
        .select('*, trades(name, trade_type)')
        .eq('project_id', projectId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(10);

      setTasks(data || []);
      setLoading(false);
    };

    fetchTasks();
  }, [projectId]);

  if (loading) {
    return <div className="space-y-3">
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
    </div>;
  }

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircle2 className="h-8 w-8" />}
        title="No tasks yet"
        description="Create your first task to start coordinating work."
        action={{
          label: 'Create Task',
          onClick: () => console.log('Create task'),
        }}
      />
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <ListItem
          key={task.id}
          title={task.title}
          subtitle={task.description}
          leading={
            <StatusBadge
              status={
                task.status === 'done' ? 'complete' :
                task.status === 'blocked' ? 'blocked' :
                task.status === 'in_progress' ? 'progress' : 'info'
              }
              dotOnly
            />
          }
          trailing={
            task.trades && (
              <TradeBadge trade={task.trades.trade_type} />
            )
          }
        />
      ))}
    </div>
  );
};

const ProjectDrawings = ({ projectId }: { projectId: string }) => {
  const [drawings, setDrawings] = useState<any[]>([]);
  const [filteredDrawings, setFilteredDrawings] = useState<any[]>([]);
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
        .select('*, profiles(full_name)')
        .eq('project_id', projectId)
        .in('document_type', ['plan', 'drawing', 'blueprint', 'specification'])
        .order('created_at', { ascending: false });

      setDrawings(data || []);
      setFilteredDrawings(data || []);
      setLoading(false);
    };

    fetchDrawings();
  }, [projectId]);

  useEffect(() => {
    if (activeFilter === 'all') {
      setFilteredDrawings(drawings);
    } else {
      setFilteredDrawings(drawings.filter(d => d.document_type === activeFilter));
    }
  }, [activeFilter, drawings]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {drawingTypes.map((type) => (
          <Button
            key={type.value}
            variant={activeFilter === type.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveFilter(type.value)}
          >
            {type.label}
            {type.value !== 'all' && (
              <Badge variant="secondary" className="ml-2">
                {drawings.filter(d => d.document_type === type.value).length}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {/* Summary Stats */}
      <Card>
        <CardContent className="py-4">
          <div className="grid grid-cols-4 gap-4 text-center">
            {drawingTypes.slice(1).map((type) => (
              <div key={type.value}>
                <p className="text-2xl font-bold">
                  {drawings.filter(d => d.document_type === type.value).length}
                </p>
                <p className="text-xs text-muted-foreground">{type.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {filteredDrawings.length === 0 ? (
        <EmptyState
          icon={<FileImage className="h-8 w-8" />}
          title="No drawings found"
          description={activeFilter === 'all' 
            ? "Upload drawings, plans, and blueprints for this project."
            : `No ${activeFilter}s uploaded yet.`}
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredDrawings.map((doc) => (
            <Card
              key={doc.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => window.open(doc.file_url, '_blank')}
            >
              <CardContent className="p-4">
                <div className="flex flex-col items-center text-center">
                  {doc.file_type?.startsWith('image/') ? (
                    <img
                      src={doc.file_url}
                      alt={doc.file_name}
                      className="w-full h-24 object-cover rounded mb-2"
                    />
                  ) : (
                    <FileText className="h-12 w-12 text-muted-foreground mb-2" />
                  )}
                  <p className="text-sm font-medium truncate w-full">{doc.file_name}</p>
                  <Badge variant="secondary" className="mt-1 capitalize">
                    {doc.document_type}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </p>
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
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLookahead = async () => {
      const twoWeeksFromNow = new Date();
      twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);

      const { data } = await supabase
        .from('tasks')
        .select('*, trades(name, trade_type)')
        .eq('project_id', projectId)
        .eq('is_deleted', false)
        .lte('due_date', twoWeeksFromNow.toISOString().split('T')[0])
        .order('due_date', { ascending: true });

      setTasks(data || []);
      setLoading(false);
    };

    fetchLookahead();
  }, [projectId]);

  if (loading) {
    return <div className="space-y-3">
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
    </div>;
  }

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={<Calendar className="h-8 w-8" />}
        title="No upcoming tasks"
        description="Schedule tasks for the next 2 weeks to plan ahead."
      />
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <ListItem
          key={task.id}
          title={task.title}
          subtitle={task.due_date ? `Due: ${new Date(task.due_date).toLocaleDateString()}` : 'No due date'}
          leading={
            <StatusBadge
              status={task.status === 'done' ? 'complete' : task.status === 'blocked' ? 'blocked' : 'progress'}
              dotOnly
            />
          }
          trailing={
            task.trades && <TradeBadge trade={task.trades.trade_type} />
          }
        />
      ))}
    </div>
  );
};

const ProjectTrades = ({ projectId }: { projectId: string }) => {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMembers = async () => {
      const { data } = await supabase
        .from('project_members')
        .select('*, profiles(full_name, email), trades(name, trade_type, company_name)')
        .eq('project_id', projectId);

      setMembers(data || []);
      setLoading(false);
    };

    fetchMembers();
  }, [projectId]);

  if (loading) {
    return <div className="space-y-3">
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
    </div>;
  }

  if (members.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-8 w-8" />}
        title="No team members"
        description="Add team members and trades to this project."
        action={{
          label: 'Add Member',
          onClick: () => console.log('Add member'),
        }}
      />
    );
  }

  return (
    <div className="space-y-3">
      {members.map((member) => (
        <ListItem
          key={member.id}
          title={member.profiles?.full_name || member.profiles?.email || 'Unknown'}
          subtitle={member.trades?.company_name || 'No trade assigned'}
          trailing={
            member.trades && <TradeBadge trade={member.trades.trade_type} />
          }
          showChevron={false}
        />
      ))}
    </div>
  );
};

const ProjectSafety = ({ projectId }: { projectId: string }) => {
  const [safetyForms, setSafetyForms] = useState<any[]>([]);
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

      setSafetyForms(data || []);
      setLoading(false);
    };

    fetchSafety();
  }, [projectId]);

  if (loading) {
    return <div className="space-y-3">
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
    </div>;
  }

  if (safetyForms.length === 0) {
    return (
      <EmptyState
        icon={<Shield className="h-8 w-8" />}
        title="No safety forms"
        description="Submit safety inspections and incident reports."
        action={{
          label: 'Create Safety Form',
          onClick: () => console.log('Create safety form'),
        }}
      />
    );
  }

  return (
    <div className="space-y-3">
      {safetyForms.map((form) => (
        <ListItem
          key={form.id}
          title={form.title}
          subtitle={new Date(form.created_at).toLocaleDateString()}
          leading={
            <StatusBadge
              status={
                form.status === 'reviewed' ? 'complete' :
                form.status === 'submitted' ? 'progress' : 'info'
              }
              dotOnly
            />
          }
          trailing={
            <Badge variant="outline">{form.form_type}</Badge>
          }
        />
      ))}
    </div>
  );
};

const ProjectDocuments = ({ projectId }: { projectId: string }) => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDocuments = async () => {
      const { data } = await supabase
        .from('attachments')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(10);

      setDocuments(data || []);
      setLoading(false);
    };

    fetchDocuments();
  }, [projectId]);

  if (loading) {
    return <div className="space-y-3">
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
    </div>;
  }

  if (documents.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="h-8 w-8" />}
        title="No documents"
        description="Upload drawings, RFIs, photos, and other project files."
        action={{
          label: 'Upload Document',
          onClick: () => console.log('Upload document'),
        }}
      />
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <ListItem
          key={doc.id}
          title={doc.file_name}
          subtitle={new Date(doc.created_at).toLocaleDateString()}
          trailing={
            <Badge variant="outline">{doc.file_type}</Badge>
          }
          showChevron={false}
        />
      ))}
    </div>
  );
};

const ProjectDeficiencies = ({ projectId }: { projectId: string }) => {
  const [deficiencies, setDeficiencies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeficiencies = async () => {
      const { data } = await supabase
        .from('deficiencies')
        .select('*, trades(name, trade_type)')
        .eq('project_id', projectId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(10);

      setDeficiencies(data || []);
      setLoading(false);
    };

    fetchDeficiencies();
  }, [projectId]);

  if (loading) {
    return <div className="space-y-3">
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
    </div>;
  }

  if (deficiencies.length === 0) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-8 w-8" />}
        title="No deficiencies"
        description="Track quality issues and punch list items."
        action={{
          label: 'Report Deficiency',
          onClick: () => console.log('Create deficiency'),
        }}
      />
    );
  }

  return (
    <div className="space-y-3">
      {deficiencies.map((def) => (
        <ListItem
          key={def.id}
          title={def.title}
          subtitle={def.location || 'No location'}
          leading={
            <StatusBadge
              status={
                def.status === 'verified' ? 'complete' :
                def.status === 'fixed' ? 'progress' : 'blocked'
              }
              dotOnly
            />
          }
          trailing={
            def.trades && <TradeBadge trade={def.trades.trade_type} />
          }
        />
      ))}
    </div>
  );
};

// Receipts Tab Component
const ProjectReceiptsTab = ({ projectId }: { projectId: string }) => {
  const navigate = useNavigate();

  return (
    <div className="text-center py-8">
      <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
      <h3 className="font-medium mb-2">Project Receipts</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Upload and manage expense receipts for this project.
      </p>
      <Button onClick={() => navigate(`/projects/${projectId}/receipts`)}>
        Open Receipts
      </Button>
    </div>
  );
};

export default ProjectOverview;