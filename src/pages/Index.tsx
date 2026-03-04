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
import { useProjects } from "@/hooks/useProjects";
import { HealthContextBanner } from "@/components/HealthContextBanner";
import type { ProjectProgress } from "@/types/hours-tracking";
import type { IntegrityStatus } from "@/hooks/useProjectIntegrity";

interface ProjectIntegrity {
  status: IntegrityStatus;
  score: number;
  blockers: string[];
}

interface Project {
  id: string;
  name: string;
  location: string;
  status: 'active' | 'planning' | 'completed';
  tasks: { total: number; completed: number };
  blockedTasks: number;
  safetyCompliance: number;
  integrity: ProjectIntegrity | null;
}

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, isPM } = useAuthRole();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const canCreateProjects = isAdmin || isPM();

  const { data: rawProjects = [], isLoading: projectsLoading, refetch: fetchProjects } = useProjects();

  useEffect(() => {
    if (rawProjects.length > 0) {
      // Logic from fetchProjects moved here or handled via derived state
      // For now, mapping rawProjects to the UI Project type
      const formatted: Project[] = rawProjects.map(p => ({
        id: p.id,
        name: p.name,
        location: p.location,
        status: p.status,
        tasks: { total: Number(p.total_tasks) || 0, completed: Number(p.completed_tasks) || 0 },
        blockedTasks: Number(p.blocked_tasks) || 0,
        safetyCompliance: 100, // Default for now
        integrity: null,
      }));
      setProjects(formatted);
      setLoading(false);
    } else if (!projectsLoading) {
      setProjects([]);
      setLoading(false);
    }
  }, [rawProjects, projectsLoading]);

  useEffect(() => {
    // If we want to keep the N+1 integrity fetching for now, it needs a source
    if (projects.length > 0 && projects.every(p => p.integrity === null)) {
       // ... existing integrity fetch logic ...
    }
  }, [projects]);

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
        <HealthContextBanner />
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
