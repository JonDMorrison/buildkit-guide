import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { SectionHeader } from '@/components/SectionHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DailyLogForm } from '@/components/dailyLogs/DailyLogForm';
import { EODReportModal } from '@/components/ai-assist/EODReportModal';
import { useCurrentProject } from '@/hooks/useCurrentProject';
import { useAuthRole } from '@/hooks/useAuthRole';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Plus, Calendar, Cloud, Users, FileText, Mail } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { NoAccess } from '@/components/NoAccess';

export default function DailyLogs() {
  const { toast } = useToast();
  const { currentProjectId } = useCurrentProject();
  const { can, loading: rolesLoading } = useAuthRole(currentProjectId || undefined);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [eodReportOpen, setEodReportOpen] = useState(false);

  // Fetch project details for EOD Report
  const { data: currentProject } = useQuery({
    queryKey: ['project-details', currentProjectId],
    queryFn: async () => {
      if (!currentProjectId) return null;
      const { data, error } = await supabase
        .from('projects')
        .select('name,job_number')
        .eq('id', currentProjectId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!currentProjectId,
  });

  const canViewLogs = currentProjectId && can('view_safety', currentProjectId);
  const canCreateLogs = currentProjectId && can('create_safety', currentProjectId);

  useEffect(() => {
    if (currentProjectId && canViewLogs) {
      fetchLogs();
    } else {
      setLoading(false);
    }
  }, [currentProjectId, canViewLogs]);

  const fetchLogs = async () => {
    if (!currentProjectId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('daily_logs')
        .select('*,profiles:created_by(full_name,email)')
        .eq('project_id', currentProjectId)
        .order('log_date', { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (error: any) {
      toast({
        title: 'Error loading daily logs',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLog = () => {
    setSelectedLog(null);
    setFormOpen(true);
  };

  const handleEditLog = (log: any) => {
    setSelectedLog(log);
    setFormOpen(true);
  };

  if (rolesLoading || loading) {
    return (
      <Layout>
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </Layout>
    );
  }

  if (!currentProjectId) {
    return (
      <Layout>
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="No Project Selected"
          description="Please select a project to view daily logs"
        />
      </Layout>
    );
  }

  if (!canViewLogs) {
    return (
      <Layout>
        <NoAccess />
      </Layout>
    );
  }

  return (
    <Layout>
      <SectionHeader
        title="Daily Logs"
        subtitle="Track daily progress, crew, and site conditions"
        count={logs.length}
        action={
          canCreateLogs
            ? {
                label: 'Add Log',
                icon: <Plus className="h-6 w-6" />,
                onClick: handleCreateLog,
              }
            : undefined
        }
      />

      {/* EOD Report Action */}
      <div className="flex justify-end mb-4">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setEodReportOpen(true)}
          className="gap-2"
        >
          <Mail className="h-4 w-4" />
          Generate EOD Report
        </Button>
      </div>

      {logs.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="No daily logs yet"
          description={canCreateLogs ? "Start logging daily activities to track project progress" : "No daily logs have been created for this project"}
          action={
            canCreateLogs
              ? {
                  label: 'Create First Log',
                  onClick: handleCreateLog,
                }
              : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {logs.map((log) => (
            <Card
              key={log.id}
              className="p-6 cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => handleEditLog(log)}
            >
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-semibold">
                        {format(new Date(log.log_date), 'EEEE, MMMM d, yyyy')}
                      </h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      by {log.profiles?.full_name || log.profiles?.email}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {log.weather && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Cloud className="h-3 w-3" />
                        {log.weather}
                      </Badge>
                    )}
                    {log.crew_count !== null && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {log.crew_count}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Work Performed */}
                <div>
                  <h4 className="text-sm font-semibold mb-1">Work Performed</h4>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {log.work_performed}
                  </p>
                </div>

                {/* Issues */}
                {log.issues && (
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Issues</h4>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {log.issues}
                    </p>
                  </div>
                )}

                {/* Next Day Plan */}
                {log.next_day_plan && (
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Next Day Plan</h4>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {log.next_day_plan}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <DailyLogForm
        projectId={currentProjectId}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={fetchLogs}
        existingLog={selectedLog}
      />

      <EODReportModal
        open={eodReportOpen}
        onOpenChange={setEodReportOpen}
        projectId={currentProjectId || ''}
        projectName={currentProject?.name || ''}
        jobNumber={currentProject?.job_number}
      />
    </Layout>
  );
}