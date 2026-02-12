import { forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { JobCostReport } from "@/types/job-cost-report";

interface Props {
  report: JobCostReport;
  projectName: string;
}

export const JobCostExportCSV = forwardRef<HTMLButtonElement, Props>(({ report, projectName }, ref) => {
  const handleExport = () => {
    const lines: string[] = [];
    lines.push("Section,Worker/Vendor,Category,Hours,Rate,Amount");

    for (const row of report.labor.rows) {
      lines.push(
        `Labor,"${row.userName}",,${row.hoursWorked.toFixed(1)},${row.billRate?.toFixed(2) ?? ""},${row.totalCost.toFixed(2)}`
      );
    }

    for (const row of report.materials.rows) {
      lines.push(
        `Materials,"${row.vendor ?? ""}","${row.category}",,,${row.amount.toFixed(2)}`
      );
    }

    lines.push(`,,,,TOTAL,${report.grandTotal.toFixed(2)}`);

    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `job-cost-report-${projectName.replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button ref={ref} variant="outline" size="sm" onClick={handleExport}>
      <Download className="h-4 w-4 mr-2" />
      Export CSV
    </Button>
  );
});

JobCostExportCSV.displayName = "JobCostExportCSV";
