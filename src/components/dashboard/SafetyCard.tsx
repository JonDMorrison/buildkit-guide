import { useNavigate } from "react-router-dom";
import { ShieldCheck, ChevronRight, FileText, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SafetyCardProps {
  formsToday: number;
  formsThisWeek: number;
  incidents: number;
  isLoading?: boolean;
}

export const SafetyCard = ({
  formsToday,
  formsThisWeek,
  incidents,
  isLoading = false,
}: SafetyCardProps) => {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="widget-card">
        <div className="widget-header">
          <div className="space-y-1">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
        <div className="widget-body">
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="text-center p-3 rounded-lg bg-muted/10">
                <Skeleton className="h-6 w-8 mx-auto mb-2" />
                <Skeleton className="h-3 w-12 mx-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "widget-card premium-card-interactive group",
        incidents > 0 && "premium-card-danger"
      )}
      onClick={() => navigate("/safety")}
    >
      <div className="widget-header">
        <div>
          <h3 className="widget-title">
            <ShieldCheck className={cn(
              "h-4 w-4",
              incidents > 0 ? "text-red-600" : "text-secondary"
            )} />
            Safety & Compliance
          </h3>
          <p className="widget-subtitle">Form submissions</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      <div className="widget-body flex items-center justify-center">
        <div className="grid grid-cols-3 gap-4 w-full">
          {/* Today */}
          <div className="flex flex-col items-center p-3 rounded-lg bg-accent/10">
            <FileText className="h-4 w-4 text-accent mb-2" />
            <span className="text-2xl font-bold text-foreground">{formsToday}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Today
            </span>
          </div>

          {/* This Week */}
          <div className="flex flex-col items-center p-3 rounded-lg bg-secondary/10">
            <FileText className="h-4 w-4 text-secondary mb-2" />
            <span className="text-2xl font-bold text-foreground">{formsThisWeek}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              This Week
            </span>
          </div>

          {/* Incidents */}
          <div className={cn(
            "flex flex-col items-center p-3 rounded-lg",
            incidents > 0 ? "bg-status-danger-bg" : "bg-muted/10"
          )}>
            <AlertCircle className={cn(
              "h-4 w-4 mb-2",
              incidents > 0 ? "text-red-600" : "text-muted-foreground"
            )} />
            <span className={cn(
              "text-2xl font-bold",
              incidents > 0 ? "text-red-600" : "text-foreground"
            )}>
              {incidents}
            </span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Incidents
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};