import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from "@/components/Layout";
import { ProjectCard } from "@/components/ProjectCard";
import { SectionHeader } from "@/components/SectionHeader";
import { CreateProjectModal } from "@/components/CreateProjectModal";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Building2 } from "lucide-react";

interface Project {
  id: string;
  name: string;
  location: string;
  status: 'active' | 'planning' | 'completed';
  tasks: { total: number; completed: number };
  blockedTasks: number;
  safetyCompliance: number;
}

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const fetchProjects = async () => {
    try {
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (projectsError) throw projectsError;

      // Fetch task counts and stats for each project
      const projectsWithTasks = await Promise.all(
        (projectsData || []).map(async (project) => {
          const { data: tasks } = await supabase
            .from('tasks')
            .select('status')
            .eq('project_id', project.id)
            .eq('is_deleted', false);

          const total = tasks?.length || 0;
          const completed = tasks?.filter(t => t.status === 'done').length || 0;
          const blocked = tasks?.filter(t => t.status === 'blocked').length || 0;

          // Fetch safety compliance for last 7 days
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

          const { data: safetyForms } = await supabase
            .from('safety_forms')
            .select('status')
            .eq('project_id', project.id)
            .gte('created_at', oneWeekAgo.toISOString());

          const totalForms = safetyForms?.length || 0;
          const reviewedForms = safetyForms?.filter(f => f.status === 'reviewed').length || 0;
          const safetyCompliance = totalForms > 0 ? Math.round((reviewedForms / totalForms) * 100) : 100;

          return {
            id: project.id,
            name: project.name,
            location: project.location,
            status: project.status as 'active' | 'planning' | 'completed',
            tasks: { total, completed },
            blockedTasks: blocked,
            safetyCompliance,
          };
        })
      );

      setProjects(projectsWithTasks);
    } catch (error: any) {
      toast({
        title: 'Error loading projects',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleProjectClick = (projectId: string) => {
    navigate(`/projects/${projectId}`);
  };

  if (loading) {
    return (
      <Layout>
        <div className="container max-w-2xl mx-auto px-4 py-6">
          <Skeleton className="h-12 w-64 mb-6" />
          <div className="space-y-3">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container max-w-2xl mx-auto px-4 py-6">
        <SectionHeader
          title="Projects"
          count={projects.length}
          action={{
            label: "Add Project",
            icon: <Plus className="h-6 w-6" />,
            onClick: () => setCreateModalOpen(true),
          }}
        />

        {projects.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-8 w-8" />}
            title="No projects yet"
            description="Create your first project to start coordinating construction work."
            action={{
              label: "Create Project",
              onClick: () => setCreateModalOpen(true),
            }}
          />
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
              <div key={project.id} onClick={() => handleProjectClick(project.id)}>
                <ProjectCard {...project} />
              </div>
            ))}
          </div>
        )}

        <CreateProjectModal
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
          onSuccess={fetchProjects}
        />
      </div>
    </Layout>
  );
};

export default Index;
