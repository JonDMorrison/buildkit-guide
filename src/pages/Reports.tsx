import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  FileText,
  Loader2,
  Printer,
  RotateCcw,
} from "lucide-react";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { useProgressReport } from "@/hooks/useProgressReport";
import { ProgressReport } from "@/components/reports/ProgressReport";

const LOADING_MESSAGES = [
  "Pulling this week's data...",
  "Writing your report...",
  "Almost ready...",
];

export default function Reports() {
  const { currentProjectId } = useCurrentProject();
  const { report, isGenerating, error, generateReport, clearReport } =
    useProgressReport();

  const [reportType, setReportType] = useState<"weekly" | "milestone">(
    "weekly"
  );
  const [recipientType, setRecipientType] = useState<"owner" | "gc">("owner");
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);

  useEffect(() => {
    if (!isGenerating) return;
    const interval = setInterval(() => {
      setLoadingMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isGenerating]);

  const handleGenerate = () => {
    if (!currentProjectId) return;
    generateReport(currentProjectId, reportType, recipientType);
  };

  return (
    <Layout>
      <div className="flex h-[calc(100vh-64px)]">
        {/* Left panel — config */}
        <div className="w-[300px] shrink-0 border-r border-border/50 bg-card/50 p-5 space-y-6 flex flex-col">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Reports
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Generate professional client-facing reports
            </p>
          </div>

          <Separator />

          <div className="space-y-4 flex-1">
            <div className="space-y-1.5">
              <Label>Report Type</Label>
              <Select
                value={reportType}
                onValueChange={(v) =>
                  setReportType(v as "weekly" | "milestone")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly Progress</SelectItem>
                  <SelectItem value="milestone">Milestone Summary</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Recipient</Label>
              <Select
                value={recipientType}
                onValueChange={(v) =>
                  setRecipientType(v as "owner" | "gc")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Project Owner</SelectItem>
                  <SelectItem value="gc">General Contractor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={!currentProjectId || isGenerating}
              className="w-full gap-2"
              size="lg"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isGenerating
                ? LOADING_MESSAGES[loadingMsgIdx]
                : "Generate Report"}
            </Button>

            {!currentProjectId && (
              <p className="text-xs text-muted-foreground text-center">
                Select a project first
              </p>
            )}

            {error && (
              <p className="text-xs text-destructive text-center">{error}</p>
            )}
          </div>

          {report && (
            <div className="space-y-2 pt-4 border-t">
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => window.print()}
              >
                <Printer className="h-4 w-4" />
                Export as PDF
              </Button>
              <Button
                variant="ghost"
                className="w-full gap-2"
                onClick={() => {
                  clearReport();
                }}
              >
                <RotateCcw className="h-4 w-4" />
                New Report
              </Button>
            </div>
          )}
        </div>

        {/* Right panel — report */}
        <div className="flex-1 overflow-y-auto">
          {isGenerating && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm font-medium">
                {LOADING_MESSAGES[loadingMsgIdx]}
              </p>
            </div>
          )}

          {!isGenerating && report && (
            <div className="p-8 print:p-0">
              <ProgressReport report={report} />
            </div>
          )}

          {!isGenerating && !report && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
              <FileText className="h-16 w-16 text-muted-foreground/20" />
              <div className="space-y-1">
                <p className="text-lg font-medium text-muted-foreground">
                  Generate your first report
                </p>
                <p className="text-sm text-muted-foreground/70 max-w-md">
                  Choose your settings and click Generate. A professional
                  progress report will be ready in seconds.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
