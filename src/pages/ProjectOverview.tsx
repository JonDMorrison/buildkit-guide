import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { SectionHeader } from '@/components/SectionHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { TradeBadge } from '@/components/TradeBadge';
import { ListItem } from '@/components/ListItem';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, AlertTriangle, Shield, CheckCircle2, FileText, Users, Calendar, Plus } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  location: string;
  description: string;
  status: string;
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
  const [project, setProject] = useState<Project | null>(null);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <Layout>
        <div className="container max-w-4xl mx-auto px-4 py-6">
          <Skeleton className="h-8 w-64 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-96" />
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

        <SectionHeader
          title={project.name}
          subtitle={project.location}
        />

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Overall Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{completion}%</span>
                  <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                </div>
                <Progress value={completion} />
                <p className="text-xs text-muted-foreground">
                  {stats?.completedTasks} of {stats?.totalTasks} tasks complete
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Blocked Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-status-issue">
                    {stats?.blockedTasks || 0}
                  </span>
                  <AlertTriangle className="h-5 w-5 text-status-issue" />
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats?.blockedTasks ? 'Requires immediate attention' : 'No blockers'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Safety Compliance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-status-complete">
                    {stats?.safetyCompliance || 0}%
                  </span>
                  <Shield className="h-5 w-5 text-status-complete" />
                </div>
                <p className="text-xs text-muted-foreground">
                  This week's forms reviewed
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabbed Content */}
        <Tabs defaultValue="tasks" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="lookahead">Lookahead</TabsTrigger>
            <TabsTrigger value="trades">Trades</TabsTrigger>
            <TabsTrigger value="safety">Safety</TabsTrigger>
            <TabsTrigger value="documents">Docs</TabsTrigger>
            <TabsTrigger value="deficiencies">Issues</TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="mt-4">
            <ProjectTasks projectId={projectId!} />
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
        </Tabs>
      </div>
    </Layout>
  );
};

// Tab Components
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

export default ProjectOverview;