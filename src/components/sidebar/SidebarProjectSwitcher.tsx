import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { useOrganization } from "@/hooks/useOrganization";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Building2, ChevronDown, CheckCircle2, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProjectSwitcherProps {
  collapsed?: boolean;
}

export const SidebarProjectSwitcher = ({ collapsed }: SidebarProjectSwitcherProps) => {
  const { user } = useAuth();
  const { activeOrganizationId } = useOrganization();
  const { currentProjectId, setCurrentProject } = useCurrentProject();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: projects = [] } = useQuery({
    queryKey: ["sidebar-projects", user?.id, activeOrganizationId],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("project_members")
        .select("project_id,projects (id,name,status)")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data?.map((pm: any) => pm.projects).filter(Boolean) || []) as {
        id: string;
        name: string;
        status: string;
      }[];
    },
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const currentProject = projects.find((p) => p.id === currentProjectId);

  const filtered = projects.filter(
    (p) => !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (projectId: string) => {
    setCurrentProject(projectId);
    setOpen(false);
    setSearch("");

    // Invalidate project-scoped queries
    queryClient.invalidateQueries({ queryKey: ["dashboard-tasks"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-blockers"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-safety"] });
    queryClient.invalidateQueries({ queryKey: ["current-project"] });
    queryClient.invalidateQueries({ queryKey: ["sidebar-project"] });
  };

  const formatStatus = (status: string) =>
    status
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "completed": return "default" as const;
      case "in_progress": return "secondary" as const;
      case "on_hold": return "destructive" as const;
      default: return "outline" as const;
    }
  };

  // Collapsed: just show icon
  if (collapsed) {
    return (
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "flex items-center justify-center rounded-xl h-10 w-10 mx-auto transition-all duration-300",
              "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-white/[0.08]",
              "border border-transparent hover:border-sidebar-primary/20",
              "animate-sidebar-item",
              open && "bg-white/[0.08] text-primary shadow-inner"
            )}
            aria-label="Switch project"
          >
            <Building2 className="h-5 w-5" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="right" align="start" className="w-[280px] p-0 bg-popover/95 backdrop-blur-xl border-border shadow-2xl animate-in zoom-in-95 fade-in duration-200" sideOffset={12}>
          <ProjectList
            projects={filtered}
            currentProjectId={currentProjectId}
            search={search}
            onSearchChange={setSearch}
            onSelect={handleSelect}
            formatStatus={formatStatus}
            getStatusVariant={getStatusVariant}
          />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className="px-3 mb-2">
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "w-full flex items-center gap-3 rounded-xl px-3 py-3 mt-2",
              "bg-white/[0.03] hover:bg-white/[0.06] backdrop-blur-sm",
              "border border-sidebar-border/50 hover:border-sidebar-primary/40",
              "transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1) group",
              "animate-sidebar-item",
              open && "border-sidebar-primary/60 bg-white/[0.08] shadow-lg shadow-black/20"
            )}
            role="combobox"
            aria-expanded={open}
          >
            <div className={cn(
              "flex items-center justify-center h-9 w-9 rounded-lg shrink-0 transition-all duration-500",
              "bg-sidebar-primary/10 group-hover:bg-sidebar-primary/20 group-hover:scale-105",
              "shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_1px_3px_rgba(0,0,0,0.1)]"
            )}>
              <Building2 className="h-4.5 w-4.5 text-sidebar-primary" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-sidebar-foreground/25 mb-0.5">
                Current Project
              </p>
              <p className="text-[13px] font-semibold text-sidebar-foreground/90 truncate group-hover:text-sidebar-foreground transition-colors">
                {currentProject?.name || "Select Project"}
              </p>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-sidebar-foreground/20 transition-all duration-500",
                open && "rotate-180 text-sidebar-primary"
              )}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="start"
          className="w-[var(--radix-popover-trigger-width)] p-0 bg-popover/98 backdrop-blur-2xl border-sidebar-border shadow-2xl animate-in slide-in-from-top-2 fade-in duration-300"
          sideOffset={8}
        >
          <ProjectList
            projects={filtered}
            currentProjectId={currentProjectId}
            search={search}
            onSearchChange={setSearch}
            onSelect={handleSelect}
            formatStatus={formatStatus}
            getStatusVariant={getStatusVariant}
            showAllProjects={projects.length >= 5}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};

/* ── Internal project list used by both expanded and collapsed popovers ── */
function ProjectList({
  projects,
  currentProjectId,
  search,
  onSearchChange,
  onSelect,
  formatStatus,
  getStatusVariant,
  showAllProjects,
}: {
  projects: { id: string; name: string; status: string }[];
  currentProjectId: string | null;
  search: string;
  onSearchChange: (v: string) => void;
  onSelect: (id: string) => void;
  formatStatus: (s: string) => string;
  getStatusVariant: (s: string) => "default" | "secondary" | "destructive" | "outline";
  showAllProjects?: boolean;
}) {
  return (
    <>
      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-8 pl-8 text-sm bg-muted/50 border-none"
            autoFocus
          />
        </div>
      </div>
      <div className="max-h-[260px] overflow-y-auto p-1">
        {projects.map((project) => (
          <button
            key={project.id}
            onClick={() => onSelect(project.id)}
            className={cn(
              "flex items-center gap-2.5 w-full text-left rounded-md px-2.5 py-2 text-sm",
              "hover:bg-muted transition-colors duration-100",
              project.id === currentProjectId && "bg-primary/10"
            )}
          >
            {project.id === currentProjectId && (
              <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
            )}
            <span
              className={cn(
                "flex-1 truncate",
                project.id === currentProjectId ? "font-semibold text-foreground" : "text-foreground/80"
              )}
            >
              {project.name}
            </span>
            <Badge variant={getStatusVariant(project.status)} className="text-[9px] shrink-0">
              {formatStatus(project.status)}
            </Badge>
          </button>
        ))}
        {projects.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No projects found</p>
        )}
        {showAllProjects && (
          <>
            <div className="mx-2 my-1 border-t border-border" />
            <button
              disabled
              className="flex items-center gap-2 w-full text-left rounded-md px-2.5 py-2 text-sm text-muted-foreground/50 cursor-not-allowed"
            >
              All Projects (coming soon)
            </button>
          </>
        )}
      </div>
    </>
  );
}
