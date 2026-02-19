import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Settings, ChevronRight } from "lucide-react";
import { useUnratedLaborSummary } from "@/hooks/useUnratedLaborSummary";
import { UnratedLaborDetailsDrawer } from "./UnratedLaborDetailsDrawer";

interface UnratedLaborBannerProps {
  projectId?: string | null;
}

export function UnratedLaborBanner({ projectId }: UnratedLaborBannerProps) {
  const navigate = useNavigate();
  const { data: summary, isLoading } = useUnratedLaborSummary(projectId);
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (isLoading || !summary) return null;

  const totalIssueHours = summary.unrated_hours + summary.currency_mismatch_hours;
  const totalIssueEntries = summary.unrated_entries_count + summary.currency_mismatch_count;

  if (totalIssueHours === 0 && totalIssueEntries === 0) return null;

  return (
    <>
      <Alert variant="destructive" className="flex items-start gap-3" data-testid="unrated-labor-banner">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <AlertTitle className="text-sm font-semibold">Labor cost data missing</AlertTitle>
          <AlertDescription className="text-sm mt-1 space-y-1">
            <p>
              <strong>{totalIssueEntries}</strong> time {totalIssueEntries === 1 ? 'entry has' : 'entries have'} no rate. Financial totals may be understated.
            </p>
            {summary.currency_mismatch_hours > 0 && (
              <p className="text-xs opacity-80">
                Includes {summary.currency_mismatch_hours}h with currency mismatch.
              </p>
            )}
          </AlertDescription>
          <div className="flex items-center gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDrawerOpen(true)}
            >
              <ChevronRight className="h-3 w-3 mr-1" />
              View details
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/settings/labor-rates")}
            >
              <Settings className="h-3 w-3 mr-1" />
              Fix labor rates
            </Button>
          </div>
        </div>
      </Alert>

      <UnratedLaborDetailsDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        details={summary.details}
      />
    </>
  );
}
