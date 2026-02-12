import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { JobCostReport } from "@/types/job-cost-report";
import jsPDF from "jspdf";

interface Props {
  report: JobCostReport;
  projectName: string;
  jobNumber?: string;
  dateRange?: string;
}

export const JobCostExportPDF = ({ report, projectName, jobNumber, dateRange }: Props) => {
  const handleExport = () => {
    const doc = new jsPDF();
    const margin = 14;
    let y = 20;

    // Header
    doc.setFontSize(18);
    doc.text("Job Cost Report", margin, y);
    y += 10;

    doc.setFontSize(11);
    doc.text(`Project: ${projectName}`, margin, y);
    y += 6;
    if (jobNumber) {
      doc.text(`Job #: ${jobNumber}`, margin, y);
      y += 6;
    }
    if (dateRange) {
      doc.text(`Period: ${dateRange}`, margin, y);
      y += 6;
    }
    y += 6;

    // Labor table
    doc.setFontSize(13);
    doc.text("Labor Costs", margin, y);
    y += 7;

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Worker", margin, y);
    doc.text("Hours", 100, y, { align: "right" });
    doc.text("Rate", 130, y, { align: "right" });
    doc.text("Cost", 170, y, { align: "right" });
    y += 5;
    doc.setFont("helvetica", "normal");

    for (const row of report.labor.rows) {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(row.userName, margin, y);
      doc.text(row.hoursWorked.toFixed(1), 100, y, { align: "right" });
      doc.text(row.billRate ? `$${row.billRate.toFixed(2)}` : "—", 130, y, { align: "right" });
      doc.text(`$${row.totalCost.toFixed(2)}`, 170, y, { align: "right" });
      y += 5;
    }

    doc.setFont("helvetica", "bold");
    doc.text("Labor Total", margin, y);
    doc.text(report.labor.totalHours.toFixed(1), 100, y, { align: "right" });
    doc.text(`$${report.labor.totalCost.toFixed(2)}`, 170, y, { align: "right" });
    y += 10;

    // Materials table
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Material / Expense Costs", margin, y);
    y += 7;

    doc.setFontSize(9);
    doc.text("Category", margin, y);
    doc.text("Vendor", 70, y);
    doc.text("Amount", 170, y, { align: "right" });
    y += 5;
    doc.setFont("helvetica", "normal");

    for (const row of report.materials.rows) {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(row.category, margin, y);
      doc.text(row.vendor || "—", 70, y);
      doc.text(`$${row.amount.toFixed(2)}`, 170, y, { align: "right" });
      y += 5;
    }

    doc.setFont("helvetica", "bold");
    doc.text("Materials Total", margin, y);
    doc.text(`$${report.materials.totalCost.toFixed(2)}`, 170, y, { align: "right" });
    y += 10;

    // Grand total
    doc.setFontSize(14);
    doc.text("Grand Total", margin, y);
    doc.text(`$${report.grandTotal.toFixed(2)}`, 170, y, { align: "right" });

    doc.save(`job-cost-report-${projectName.replace(/\s+/g, "-").toLowerCase()}.pdf`);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport}>
      <FileText className="h-4 w-4 mr-2" />
      Export PDF
    </Button>
  );
};
