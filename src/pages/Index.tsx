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
import { useAuthRole } from "@/hooks/useAuthRole";
import { Plus, Building2 } from "lucide-react";
import type { ProjectProgress } from "@/types/hours-tracking";

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
  const { isAdmin, isPM } = useAuthRole();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const canCreateProjects = isAdmin || isPM();

  const fetchProjects = async () => {
    try {
      // Use the new view to eliminate N+1 queries
      const { data: projectsWithProgress, error: progressError } = await supabase
        .from('v_project_progress')
        .select('*')
        .order('name');

      if (progressError) {
        console.error('View query failed, falling back to legacy query:', progressError);
        // Fallback to legacy query if view doesn't exist
        await fetchProjectsLegacy();
        return;
      }

      // Batch fetch safety compliance for all projects
      const projectIds = (projectsWithProgress || []).map(p => p.id);
      
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const { data: safetyForms } = await supabase
        .from('safety_forms')
        .select('project_id, status')
        .in('project_id', projectIds)
        .gte('created_at', oneWeekAgo.toISOString());

      // Group safety forms by project
      const safetyByProject = new Map<string, { total: number; reviewed: number }>();
      (safetyForms || []).forEach(form => {
        const existing = safetyByProject.get(form.project_id) || { total: 0, reviewed: 0 };
        existing.total++;
        if (form.status === 'reviewed') existing.reviewed++;
        safetyByProject.set(form.project_id, existing);
      });

      const formattedProjects: Project[] = (projectsWithProgress || []).map((p: ProjectProgress) => {
        const safety = safetyByProject.get(p.id) || { total: 0, reviewed: 0 };
        const safetyCompliance = safety.total > 0 
          ? Math.round((safety.reviewed / safety.total) * 100) 
          : 100;

        return {
          id: p.id,
          name: p.name,
          location: p.location,
          status: p.status as 'active' | 'planning' | 'completed',
          tasks: { 
            total: Number(p.total_tasks) || 0, 
            completed: Number(p.completed_tasks) || 0 
          },
          blockedTasks: Number(p.blocked_tasks) || 0,
          safetyCompliance,
        };
      });

      setProjects(formattedProjects);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: 'Error loading projects',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Legacy fallback for when view doesn't exist
  const fetchProjectsLegacy = async () => {
    const { data: projectsData, error: projectsError } = await supabase
      .from('projects')
      .select('*')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (projectsError) throw projectsError;

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
    setLoading(false);
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
          action={canCreateProjects ? {
            label: "Add Project",
            icon: <Plus className="h-6 w-6" />,
            onClick: () => setCreateModalOpen(true),
          } : undefined}
        />

        {projects.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-8 w-8" />}
            title="No projects yet"
            description={canCreateProjects ? "Create your first project to start coordinating construction work." : "No projects available. Contact your project manager for access."}
            action={canCreateProjects ? {
              label: "Create Project",
              onClick: () => setCreateModalOpen(true),
            } : undefined}
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
