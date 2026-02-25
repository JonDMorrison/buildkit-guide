import { DashboardCard } from "@/components/dashboard/shared/DashboardCard";
import { Building2 } from "lucide-react";

interface Project {
  id: string;
  name: string;
  status: string;
  progress?: number;
}

interface Props {
  projects: Project[];
  loading?: boolean;
}

export function ActiveProjectsCard({ projects, loading }: Props) {
  const active = projects.filter(p => p.status === "active" || p.status === "in_progress");
  return (
    <DashboardCard
      title="Active Projects"
      icon={Building2}
      loading={loading}
      variant="metric"
      traceSource="project_members → projects"
    >
      <div className="text-4xl font-bold tabular-nums text-foreground">{active.length || projects.length}</div>
      <p className="text-xs text-muted-foreground">
        {projects.length} total assigned
      </p>
    </DashboardCard>
  );
}
