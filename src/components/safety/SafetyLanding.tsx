import { useMemo, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { BackfillHashesButton } from "./BackfillHashesButton";
import { SafetyAssurancePanel } from "./SafetyAssurancePanel";
import { useUserRole } from "@/hooks/useUserRole";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { 
  ClipboardList, 
  Users, 
  AlertTriangle, 
  FileWarning, 
  ShieldBan,
  FileText, 
  Camera, 
  PenLine,
  Search,
  Filter,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SafetyForm {
  id: string;
  form_type: string;
  title: string;
  status: "draft" | "submitted" | "reviewed";
  inspection_date: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  attachments?: Array<{ id: string }>;
  profiles?: { full_name: string | null };
}

interface SafetyLandingProps {
  forms: SafetyForm[];
  loading: boolean;
  onCreateForm: (type: string) => void;
  onFormClick: (id: string) => void;
  canCreate: boolean;
  isWorker?: boolean; // If true, show limited options for workers
}

const formTypeConfig = {
  daily_safety_log: {
    label: "Daily Safety Log",
    shortLabel: "Daily Log",
    icon: ClipboardList,
    description: "Document daily site conditions",
    primary: true,
  },
  toolbox_meeting: {
    label: "Toolbox Talk",
    shortLabel: "Toolbox",
    icon: Users,
    description: "Record safety meeting",
  },
  near_miss: {
    label: "Near Miss",
    shortLabel: "Near Miss",
    icon: AlertTriangle,
    description: "Report close calls",
  },
  incident_report: {
    label: "Incident Report",
    shortLabel: "Incident",
    icon: FileWarning,
    description: "Document safety events",
  },
  right_to_refuse: {
    label: "Right to Refuse",
    shortLabel: "R2R",
    icon: ShieldBan,
    description: "Document work refusal",
  },
  hazard_id: {
    label: "Hazard ID",
    shortLabel: "Hazard",
    icon: AlertTriangle,
    description: "Report potential hazards",
  },
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "reviewed":
      return "bg-green-500/10 text-green-600 border-green-500/30";
    case "submitted":
      return "bg-blue-500/10 text-blue-600 border-blue-500/30";
    case "draft":
      return "bg-yellow-500/10 text-yellow-600 border-yellow-500/30";
    default:
      return "bg-muted text-muted-foreground";
  }
};

export const SafetyLanding = ({
  forms,
  loading,
  onCreateForm,
  onFormClick,
  canCreate,
  isWorker = false,
}: SafetyLandingProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Memoized filtered forms
  const filteredForms = useMemo(() => {
    return forms.filter((form) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = form.title.toLowerCase().includes(query);
        const matchesType = formTypeConfig[form.form_type as keyof typeof formTypeConfig]?.label
          ?.toLowerCase()
          .includes(query);
        if (!matchesTitle && !matchesType) return false;
      }

      // Type filter
      if (typeFilter !== "all" && form.form_type !== typeFilter) return false;

      // Status filter
      if (statusFilter !== "all" && form.status !== statusFilter) return false;

      return true;
    });
  }, [forms, searchQuery, typeFilter, statusFilter]);

  const handleCreateDaily = useCallback(() => {
    onCreateForm("daily_safety_log");
  }, [onCreateForm]);

  if (loading) {
    return <SafetyLandingSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Worker-specific: Right to Refuse button only */}
      {isWorker && (
        <Card
          className="p-6 cursor-pointer hover:bg-accent/50 transition-colors border-2 border-destructive/30 bg-destructive/5"
          onClick={() => onCreateForm("right_to_refuse")}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-destructive/10">
              <ShieldBan className="h-6 w-6 text-destructive" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">Report Unsafe Work</h3>
              <p className="text-sm text-muted-foreground">
                Exercise your right to refuse work you believe is unsafe
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </Card>
      )}

      {/* Primary CTA - New Daily Safety Log (PM/Foreman only) */}
      {canCreate && !isWorker && (
        <Button
          onClick={handleCreateDaily}
          size="lg"
          className="w-full h-16 text-lg font-semibold gap-3 shadow-lg"
        >
          <ClipboardList className="h-6 w-6" />
          New Daily Safety Log
        </Button>
      )}

      {/* Secondary CTAs - Horizontal scroll on mobile (PM/Foreman only) */}
      {canCreate && !isWorker && (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {Object.entries(formTypeConfig)
            .filter(([key]) => key !== "daily_safety_log")
            .map(([type, config]) => {
              const Icon = config.icon;
              return (
                <Card
                  key={type}
                  className="flex-shrink-0 p-4 cursor-pointer hover:bg-accent/50 transition-colors min-w-[140px]"
                  onClick={() => onCreateForm(type)}
                >
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-sm font-medium">{config.shortLabel}</span>
                    <span className="text-xs text-muted-foreground line-clamp-1">
                      {config.description}
                    </span>
                  </div>
                </Card>
              );
            })}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search forms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-12"
          />
        </div>
        <div className="flex gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[130px] h-12">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(formTypeConfig).map(([type, config]) => (
                <SelectItem key={type} value={type}>
                  {config.shortLabel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[120px] h-12">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Forms List */}
      <div className="space-y-3">
        {filteredForms.length === 0 ? (
          <Card className="p-8 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold text-lg mb-2">No safety forms found</h3>
            <p className="text-sm text-muted-foreground">
              {searchQuery || typeFilter !== "all" || statusFilter !== "all"
                ? "Try adjusting your filters"
                : "Create your first safety form to get started"}
            </p>
          </Card>
        ) : (
          filteredForms.map((form) => (
            <SafetyFormCard key={form.id} form={form} onClick={() => onFormClick(form.id)} />
          ))
        )}
      </div>

      {/* Safety Assurance Panel */}
      <SafetyAssurancePanel variant="full" className="mt-6" />

      {/* Admin-only: Backfill Hashes Tool */}
      <AdminBackfillSection />
    </div>
  );
};

// Individual form card component
const SafetyFormCard = ({
  form,
  onClick,
}: {
  form: SafetyForm;
  onClick: () => void;
}) => {
  const config = formTypeConfig[form.form_type as keyof typeof formTypeConfig];
  const Icon = config?.icon || FileText;
  const attachmentCount = form.attachments?.length || 0;

  return (
    <Card
      className="p-4 cursor-pointer hover:bg-accent/50 transition-colors active:scale-[0.99]"
      onClick={onClick}
    >
      <div className="flex items-center gap-4">
        {/* Icon */}
        <div className="p-2 rounded-lg bg-muted flex-shrink-0">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-foreground truncate">{form.title}</h3>
          </div>
          <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
            <span>{config?.shortLabel || form.form_type}</span>
            <span>•</span>
            <span>{format(new Date(form.inspection_date), "MMM d, yyyy")}</span>
            {attachmentCount > 0 && (
              <>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <Camera className="h-3 w-3" />
                  <span>{attachmentCount}</span>
                </div>
              </>
            )}
            {form.status === "draft" && (
              <>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <PenLine className="h-3 w-3" />
                  <span>Draft</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Status + Arrow */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge className={cn("text-xs", getStatusColor(form.status))}>
            {form.status.charAt(0).toUpperCase() + form.status.slice(1)}
          </Badge>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </Card>
  );
};

// Admin-only backfill section
const AdminBackfillSection = () => {
  const { isAdmin, loading } = useUserRole();
  
  if (loading || !isAdmin) return null;
  
  return (
    <div className="pt-6 border-t">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Admin Tools</h3>
      <BackfillHashesButton />
    </div>
  );
};

// Skeleton loading state
const SafetyLandingSkeleton = () => (
  <div className="space-y-6">
    <Skeleton className="h-16 w-full" />
    <div className="flex gap-3 overflow-x-auto pb-2">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-24 w-[140px] flex-shrink-0" />
      ))}
    </div>
    <div className="flex gap-3">
      <Skeleton className="h-12 flex-1" />
      <Skeleton className="h-12 w-[130px]" />
      <Skeleton className="h-12 w-[120px]" />
    </div>
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  </div>
);