import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardCard } from "@/components/dashboard/shared/DashboardCard";
import { Button } from "@/components/ui/button";
import { FileText, ArrowRight } from "lucide-react";

export const ReportsWidget = memo(function ReportsWidget() {
  const navigate = useNavigate();

  return (
    <DashboardCard
      title="Progress Reports"
      icon={FileText}
      variant="metric"
      description="AI-generated client reports"
    >
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Generate a professional weekly report for your owner or GC in
          seconds.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/reports")}
          className="w-full gap-1.5"
        >
          Generate Weekly Report
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </DashboardCard>
  );
});
