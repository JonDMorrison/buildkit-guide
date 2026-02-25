/**
 * RPC Tracer — lightweight interceptor that records Supabase RPC/query
 * timings for the dashboard-diagnostics admin tool.
 *
 * Usage: wrap `supabase.rpc(...)` or table queries with `traceRpc()`.
 * The tracer is a singleton in-memory store, cleared on page reload.
 */

export interface RpcTraceEntry {
  id: string;
  name: string;           // RPC name or "table:tableName"
  startedAt: number;      // performance.now()
  durationMs: number;
  status: "ok" | "error";
  error?: string;
  callerHint?: string;    // optional component/card name
}

const MAX_ENTRIES = 500;
let entries: RpcTraceEntry[] = [];
let idCounter = 0;
const listeners = new Set<() => void>();

export function getRpcTraces(): readonly RpcTraceEntry[] {
  return entries;
}

export function clearRpcTraces() {
  entries = [];
  notify();
}

export function subscribeRpcTraces(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function notify() {
  listeners.forEach((fn) => fn());
}

/**
 * Record a completed RPC call.
 */
export function recordTrace(entry: Omit<RpcTraceEntry, "id">) {
  const id = `t-${++idCounter}`;
  entries = [{ ...entry, id }, ...entries].slice(0, MAX_ENTRIES);
  notify();
}

/**
 * Wraps any async Supabase call to automatically trace it.
 *
 * Example:
 *   const { data, error } = await traceRpc("rpc_my_function", () =>
 *     supabase.rpc("rpc_my_function", { p_org_id: orgId })
 *   );
 */
export async function traceRpc<T>(
  name: string,
  fn: () => Promise<{ data: T; error: any }>,
  callerHint?: string,
): Promise<{ data: T; error: any }> {
  const start = performance.now();
  try {
    const result = await fn();
    const durationMs = performance.now() - start;
    recordTrace({
      name,
      startedAt: start,
      durationMs,
      status: result.error ? "error" : "ok",
      error: result.error?.message,
      callerHint,
    });
    return result;
  } catch (err: any) {
    const durationMs = performance.now() - start;
    recordTrace({
      name,
      startedAt: start,
      durationMs,
      status: "error",
      error: err?.message ?? "Unknown error",
      callerHint,
    });
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/* Static dashboard card → RPC mapping registry                        */
/* ------------------------------------------------------------------ */

export interface CardRpcMapping {
  dashboard: string;
  card: string;
  rpcs: string[];
  variant: string;
}

export const CARD_RPC_REGISTRY: CardRpcMapping[] = [
  // PM Dashboard
  { dashboard: "/dashboard", card: "Active Projects", rpcs: ["project_members", "projects"], variant: "metric" },
  { dashboard: "/dashboard", card: "Today's Tasks", rpcs: ["tasks"], variant: "metric" },
  { dashboard: "/dashboard", card: "Blocked Tasks", rpcs: ["tasks"], variant: "metric" },
  { dashboard: "/dashboard", card: "Blockers", rpcs: ["blockers"], variant: "table" },
  { dashboard: "/dashboard", card: "My Day", rpcs: ["tasks"], variant: "table" },
  { dashboard: "/dashboard", card: "Crew Assigned", rpcs: ["daily_logs"], variant: "metric" },
  { dashboard: "/dashboard", card: "Open Change Orders", rpcs: ["change_orders"], variant: "metric" },
  { dashboard: "/dashboard", card: "Project Health Signal", rpcs: ["rpc_generate_project_margin_control", "rpc_get_margin_snapshot_history"], variant: "chart" },
  { dashboard: "/dashboard", card: "Lookahead Preview", rpcs: ["tasks"], variant: "table" },
  { dashboard: "/dashboard", card: "Manpower Overview", rpcs: ["manpower_requests"], variant: "table" },

  // Executive Dashboard
  { dashboard: "/executive", card: "Executive Brief", rpcs: ["rpc_executive_change_feed"], variant: "alert" },
  { dashboard: "/executive", card: "Portfolio Volatility Index", rpcs: ["rpc_get_executive_risk_summary"], variant: "metric" },
  { dashboard: "/executive", card: "Margin Control Index", rpcs: ["rpc_get_executive_risk_summary"], variant: "metric" },
  { dashboard: "/executive", card: "OS Health Score", rpcs: ["rpc_get_executive_risk_summary"], variant: "metric" },
  { dashboard: "/executive", card: "Projects at Risk", rpcs: ["rpc_get_executive_risk_summary"], variant: "table" },
  { dashboard: "/executive", card: "Attention Required", rpcs: ["rpc_executive_change_feed"], variant: "table" },
  { dashboard: "/executive", card: "Economic Signals", rpcs: ["rpc_get_executive_risk_summary"], variant: "chart" },
  { dashboard: "/executive", card: "Data Integrity", rpcs: ["rpc_get_executive_risk_summary"], variant: "table" },
  { dashboard: "/executive", card: "Snapshot Status", rpcs: ["rpc_snapshot_coverage_report"], variant: "table" },

  // Insights
  { dashboard: "/insights", card: "Variance Leaderboard", rpcs: ["rpc_generate_project_margin_control"], variant: "table" },
  { dashboard: "/insights", card: "Job Cost Alerts", rpcs: ["rpc_generate_project_margin_control"], variant: "table" },
  { dashboard: "/insights", card: "Invoice Pipeline", rpcs: ["invoices"], variant: "table" },
  { dashboard: "/insights", card: "Financial Trends", rpcs: ["financial_snapshots"], variant: "chart" },
  { dashboard: "/insights", card: "AI Change Feed", rpcs: ["rpc_executive_change_feed"], variant: "ai_insight" },
  { dashboard: "/insights", card: "Weekly Ops Summary", rpcs: ["ai_insights"], variant: "ai_insight" },
];
