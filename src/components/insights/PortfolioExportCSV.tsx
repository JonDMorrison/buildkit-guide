import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { PortfolioRow } from "@/hooks/usePortfolioInsights";

interface Props {
  rows: PortfolioRow[];
}

export const PortfolioExportCSV = ({ rows }: Props) => {
  const handleExport = () => {
    const lines: string[] = [];
    lines.push(
      "Job #,Project,Customer,Status,Budget Status,Contract Value,Planned Cost,Actual Cost,Delta ($),Delta (%),Planned Margin %,Actual Margin %"
    );

    for (const r of rows) {
      const budgetStatus = r.has_budget ? "Set" : "Missing";
      lines.push(
        [
          `"${r.job_number || ""}"`,
          `"${r.project_name}"`,
          `"${r.customer_name || ""}"`,
          r.status,
          budgetStatus,
          r.has_budget ? r.contract_value.toFixed(2) : "",
          r.has_budget ? r.planned_total_cost.toFixed(2) : "",
          r.actual_total_cost.toFixed(2),
          r.has_budget ? r.total_cost_delta.toFixed(2) : "",
          r.has_budget && r.planned_total_cost
            ? ((r.total_cost_delta / r.planned_total_cost) * 100).toFixed(1)
            : "",
          r.has_budget ? r.planned_margin_percent.toFixed(1) : "",
          r.has_budget ? r.actual_margin_percent.toFixed(1) : "",
        ].join(",")
      );
    }

    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `portfolio-insights-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport}>
      <Download className="h-4 w-4 mr-2" />
      Export CSV
    </Button>
  );
};
