import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, FileWarning, TrendingUp } from "lucide-react";

interface SafetyDashboardProps {
  totalForms: number;
  submittedThisWeek: number;
  draftForms: number;
  complianceRate: number;
  missingForms: Array<{ type: string; dueDate: string }>;
}

export const SafetyDashboard = ({
  totalForms,
  submittedThisWeek,
  draftForms,
  complianceRate,
  missingForms,
}: SafetyDashboardProps) => {
  return (
    <div className="space-y-6 mb-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileWarning className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalForms}</p>
              <p className="text-xs text-muted-foreground">Total Forms</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-status-complete/10">
              <CheckCircle2 className="h-5 w-5 text-status-complete" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{submittedThisWeek}</p>
              <p className="text-xs text-muted-foreground">Last 7 Days</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-status-info/10">
              <TrendingUp className="h-5 w-5 text-status-info" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{complianceRate}%</p>
              <p className="text-xs text-muted-foreground">Compliance</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-status-issue/10">
              <AlertCircle className="h-5 w-5 text-status-issue" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{draftForms}</p>
              <p className="text-xs text-muted-foreground">Drafts</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Missing Forms Alert */}
      {missingForms.length > 0 && (
        <Card className="p-4 border-status-issue/50 bg-status-issue/5">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-status-issue mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-foreground mb-2">Missing Required Forms</h3>
              <div className="space-y-2">
                {missingForms.map((form, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted-foreground">{form.type}</span>
                    <Badge variant="outline" className="text-status-issue border-status-issue/50">
                      Due: {form.dueDate}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
