import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Building2, 
  ChevronDown, 
  CheckCircle2, 
  Plus, 
  ArrowRight,
  Sparkles,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
  status: string;
  progress: number;
  totalTasks: number;
}

interface DashboardHeaderProps {
  currentProject: { id: string; name: string; status: string } | null;
  projects: Project[];
  onProjectChange: (projectId: string) => void;
  onQuickAdd: () => void;
  onTasksClick: () => void;
  showAIAssist?: boolean;
}

export const DashboardHeader = ({
  currentProject,
  projects,
  onProjectChange,
  onQuickAdd,
  onTasksClick,
  showAIAssist = true,
}: DashboardHeaderProps) => {
  const navigate = useNavigate();

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "completed": return "default";
      case "in_progress": return "secondary";
      case "planning": return "outline";
      case "on_hold": return "destructive";
      default: return "outline";
    }
  };

  const formatStatus = (status: string) =>
    status.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");

  return (
    <div className="premium-card premium-card-gradient">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left: Project selector + title */}
        <div className="space-y-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                className="justify-start gap-3 h-auto py-2.5 px-4 border-border hover:border-primary/50 bg-card/50"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                <div className="text-left">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                    Project
                  </p>
                  <p className="text-sm font-semibold text-foreground truncate max-w-[200px]">
                    {currentProject?.name || "Select Project"}
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[320px]">
              <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                Switch Project
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {projects?.map((project) => (
                <DropdownMenuItem
                  key={project.id}
                  onClick={() => onProjectChange(project.id)}
                  className="flex items-center gap-3 p-3 cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {project.id === currentProject?.id && (
                        <CheckCircle2 className="h-3 w-3 text-secondary flex-shrink-0" />
                      )}
                      <p className="font-medium text-sm truncate">{project.name}</p>
                    </div>
                    {project.totalTasks > 0 && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-secondary rounded-full transition-all" 
                            style={{ width: `${project.progress}%` }} 
                          />
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">
                          {project.progress}%
                        </span>
                      </div>
                    )}
                  </div>
                  <Badge variant={getStatusBadgeVariant(project.status)} className="text-[10px]">
                    {formatStatus(project.status)}
                  </Badge>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Title with live indicator */}
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              Today on Site
            </h1>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-secondary/10">
              <span className="status-dot status-dot-success status-dot-animated" />
              <span className="text-[10px] font-medium text-secondary uppercase tracking-wider">
                Live
              </span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Project status and priorities
          </p>
        </div>

        {/* Right: Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {showAIAssist && (
            <Sheet>
              <SheetTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2 border-border hover:border-primary/50"
                >
                  <Sparkles className="h-4 w-4 text-accent" />
                  <span className="hidden sm:inline">AI Assist</span>
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[400px] sm:w-[540px]">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-accent" />
                    AI Assistant
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  <p className="text-muted-foreground">
                    Ask questions about your project, get risk assessments, and suggested actions.
                  </p>
                  <Button 
                    onClick={() => navigate("/ai")} 
                    className="w-full"
                  >
                    Open Full AI Assistant
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          )}
          
          <Button 
            onClick={onQuickAdd} 
            size="sm" 
            className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add</span>
          </Button>
          
          <Button 
            onClick={onTasksClick} 
            size="sm" 
            className="gap-2 bg-primary hover:bg-primary/90"
          >
            <ArrowRight className="h-4 w-4" />
            <span className="hidden sm:inline">Tasks</span>
          </Button>
        </div>
      </div>
    </div>
  );
};