import { useState } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Loader2, CheckCircle2, XCircle, Archive } from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";

const ALL_TABLES = [
  "ai_insight_validation_log",
  "ai_insights",
  "ai_queries",
  "api_idempotency_keys",
  "attachments",
  "audit_log",
  "audit_run_history",
  "blockers",
  "change_order_line_items",
  "change_orders",
  "clients",
  "comments",
  "daily_logs",
  "dashboard_layouts",
  "deficiencies",
  "document_texts",
  "economic_flag_dictionary",
  "economic_risk_thresholds",
  "estimate_line_items",
  "estimate_task_links",
  "estimates",
  "event_dedupe",
  "executive_decision_notes",
  "financial_integrity_overrides",
  "gc_column_mappings",
  "gc_deficiency_imports",
  "gc_deficiency_items",
  "gc_import_logs",
  "invitations",
  "invoice_activity_log",
  "invoice_line_items",
  "invoice_payments",
  "invoice_receipt_links",
  "invoice_settings",
  "invoice_tax_lines",
  "invoices",
  "job_sites",
  "manpower_requests",
  "notification_dedupe",
  "notification_preferences",
  "notifications",
  "org_financial_snapshots",
  "organization_guardrails",
  "organization_intelligence_profile",
  "organization_memberships",
  "organization_operational_profile",
  "organization_settings",
  "organizations",
  "payroll_exports",
  "playbook_phases",
  "playbook_tasks",
  "playbook_versions",
  "playbooks",
  "profiles",
  "project_archetypes",
  "project_budgets",
  "project_economic_snapshots",
  "project_financial_snapshots",
  "project_invoice_permissions",
  "project_margin_snapshots",
  "project_members",
  "project_scope_items",
  "project_workflow_steps",
  "project_workflows",
  "projects",
  "proposal_events",
  "proposal_sections",
  "proposals",
  "quote_conversions",
  "quote_events",
  "quote_line_items",
  "quotes",
  "receipts",
  "recurring_invoice_templates",
  "release_manual_checks",
  "safety_entries",
  "safety_form_acknowledgments",
  "safety_form_amendments",
  "safety_form_attendees",
  "safety_forms",
  "scope_items",
  "setup_checklist_progress",
  "snapshots_run_log",
  "support_issues",
  "task_assignments",
  "task_checklist_items",
  "task_dependencies",
  "tasks",
  "time_adjustment_requests",
  "time_entries",
  "time_entry_adjustments",
  "time_entry_flags",
  "time_events",
  "time_flag_codes",
  "timesheet_periods",
  "trade_ppe_requirements",
  "trades",
  "user_roles",
  "voice_transcriptions",
  "workflow_phase_requirements",
  "workflow_phases",
] as const;

type TableStatus = "idle" | "loading" | "done" | "error";

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          const str = val === null || val === undefined ? "" : typeof val === "object" ? JSON.stringify(val) : String(val);
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(",")
    ),
  ];
  return lines.join("\n");
}

async function fetchAllRows(tableName: string): Promise<Record<string, unknown>[]> {
  const PAGE_SIZE = 1000;
  let allRows: Record<string, unknown>[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await (supabase.from(tableName as any) as any)
      .select("*")
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allRows = allRows.concat(data);
      offset += PAGE_SIZE;
      if (data.length < PAGE_SIZE) hasMore = false;
    }
  }

  return allRows;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const Export = () => {
  const [statuses, setStatuses] = useState<Record<string, TableStatus>>({});
  const [rowCounts, setRowCounts] = useState<Record<string, number>>({});
  const [downloadingAll, setDownloadingAll] = useState(false);

  const setTableStatus = (table: string, status: TableStatus) => {
    setStatuses((prev) => ({ ...prev, [table]: status }));
  };

  const downloadSingleTable = async (tableName: string) => {
    setTableStatus(tableName, "loading");
    try {
      const rows = await fetchAllRows(tableName);
      setRowCounts((prev) => ({ ...prev, [tableName]: rows.length }));
      if (rows.length === 0) {
        setTableStatus(tableName, "done");
        toast.info(`${tableName}: 0 rows (empty table)`);
        return null;
      }
      const csv = toCsv(rows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      downloadBlob(blob, `${tableName}.csv`);
      setTableStatus(tableName, "done");
      return { csv, count: rows.length };
    } catch (err) {
      console.error(`Error exporting ${tableName}:`, err);
      setTableStatus(tableName, "error");
      toast.error(`Failed to export ${tableName}`);
      return null;
    }
  };

  const downloadAll = async () => {
    setDownloadingAll(true);
    const zip = new JSZip();
    let totalRows = 0;
    let successCount = 0;

    for (const tableName of ALL_TABLES) {
      setTableStatus(tableName, "loading");
      try {
        const rows = await fetchAllRows(tableName);
        setRowCounts((prev) => ({ ...prev, [tableName]: rows.length }));
        if (rows.length > 0) {
          zip.file(`${tableName}.csv`, toCsv(rows));
          totalRows += rows.length;
        }
        successCount++;
        setTableStatus(tableName, "done");
      } catch (err) {
        console.error(`Error exporting ${tableName}:`, err);
        setTableStatus(tableName, "error");
      }
    }

    if (successCount > 0) {
      const blob = await zip.generateAsync({ type: "blob" });
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `buildkit-export-${date}.zip`);
      toast.success(`Exported ${successCount} tables (${totalRows.toLocaleString()} total rows)`);
    } else {
      toast.error("No tables could be exported");
    }

    setDownloadingAll(false);
  };

  const getStatusIcon = (status: TableStatus) => {
    switch (status) {
      case "loading":
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case "done":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />;
      case "error":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };

  return (
    <Layout>
      <div className="container max-w-4xl mx-auto px-4 py-6 space-y-6 pb-20">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Data Export</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Download all database tables as CSV files for migration
            </p>
          </div>
          <Button
            onClick={downloadAll}
            disabled={downloadingAll}
            size="lg"
            className="gap-2"
          >
            {downloadingAll ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Archive className="h-5 w-5" />
            )}
            Download All (.zip)
          </Button>
        </div>

        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-4">
            {ALL_TABLES.length} tables available. Click individual tables to download, or use "Download All" to get a single ZIP.
          </p>
          <div className="grid gap-2">
            {ALL_TABLES.map((table) => (
              <div
                key={table}
                className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(statuses[table] || "idle")}
                  <span className="text-sm font-mono text-foreground">{table}</span>
                  {rowCounts[table] !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      ({rowCounts[table].toLocaleString()} rows)
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => downloadSingleTable(table)}
                  disabled={statuses[table] === "loading" || downloadingAll}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Layout>
  );
};

export default Export;
