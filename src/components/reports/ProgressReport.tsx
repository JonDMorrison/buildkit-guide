import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertCircle } from "lucide-react";
import type { ProgressReport as ProgressReportType } from "@/hooks/useProgressReport";

interface ProgressReportProps {
  report: ProgressReportType;
}

export function ProgressReport({ report }: ProgressReportProps) {
  return (
    <div className="max-w-3xl mx-auto bg-white dark:bg-card text-foreground print:text-black print:bg-white">
      {/* Header */}
      <div className="space-y-3 pb-6">
        <h1 className="text-2xl font-bold">{report.project_name}</h1>
        <h2 className="text-lg text-muted-foreground font-medium">
          Weekly Progress Report
        </h2>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{report.report_period}</span>
          <span>·</span>
          <span>
            Prepared for:{" "}
            {report.recipient_type === "gc"
              ? "General Contractor"
              : "Project Owner"}
          </span>
        </div>
        <Separator />
      </div>

      {/* Key Metrics */}
      {report.key_metrics.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pb-6 print:grid-cols-4">
          {report.key_metrics.map((m, i) => (
            <div
              key={i}
              className="rounded-lg border border-border/50 p-3 text-center print:border-gray-300"
            >
              <p className="text-xs text-muted-foreground uppercase tracking-wider print:text-gray-500">
                {m.label}
              </p>
              <p className="text-lg font-bold mt-1 print:text-black">
                {m.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Sections */}
      <div className="space-y-6">
        {report.sections.map((section, i) => (
          <div key={i} className="space-y-2 print:break-inside-avoid">
            <h3 className="text-base font-semibold">{section.title}</h3>
            <div className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line print:text-gray-700">
              {section.content}
            </div>
          </div>
        ))}
      </div>

      {/* Action Items */}
      {report.action_items.length > 0 && (
        <div className="mt-8 space-y-3 print:break-inside-avoid">
          <Separator />
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <h3 className="text-base font-semibold">Action Required</h3>
          </div>
          <ul className="space-y-2 pl-1">
            {report.action_items.map((item, i) => (
              <li
                key={i}
                className="text-sm text-muted-foreground flex items-start gap-2 print:text-gray-700"
              >
                <span className="text-amber-500 mt-0.5 shrink-0">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next Week Preview */}
      {report.next_week_preview && (
        <div className="mt-8 space-y-2 print:break-inside-avoid">
          <Separator />
          <h3 className="text-base font-semibold">Looking Ahead</h3>
          <p className="text-sm leading-relaxed text-muted-foreground print:text-gray-700">
            {report.next_week_preview}
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-10 pt-4 border-t text-center">
        <p className="text-[10px] text-muted-foreground/50 print:text-gray-400">
          Powered by ProjectPath · Generated{" "}
          {new Date(report.generated_at).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          nav, aside, header, footer, button, [data-print-hide] { display: none !important; }
          body { background: white !important; color: black !important; }
          @page { margin: 1in; }
        }
      `}</style>
    </div>
  );
}
