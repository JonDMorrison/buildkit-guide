import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user is admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin via service client
    const db = createClient(supabaseUrl, serviceKey);
    const { data: adminCheck } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminCheck) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const projectId = body.project_id;

    const results: Record<string, unknown> = {
      ran_at: new Date().toISOString(),
      sections: {},
    };

    // ─── SECTION 1: FINANCIAL RECONCILIATION ──────────────────────
    if (projectId) {
      const s1 = await runFinancialReconciliation(db, projectId);
      (results.sections as Record<string, unknown>).financial_reconciliation =
        s1;
    }

    // ─── SECTION 2: TIME INCLUSION CONTRACT ───────────────────────
    const s2 = await runTimeInclusionContract(db, projectId);
    (results.sections as Record<string, unknown>).time_inclusion_contract = s2;

    // ─── SECTION 3: ENUM INTEGRITY ────────────────────────────────
    const s3 = await runEnumIntegrity(db);
    (results.sections as Record<string, unknown>).enum_integrity = s3;

    // ─── SECTION 4: CROSS-ORG BEHAVIORAL ISOLATION TEST ──────────
    const s4 = await runCrossOrgBehavioralTest(db, userClient, supabaseUrl, anonKey, user.id, projectId);
    (results.sections as Record<string, unknown>).cross_org_leak_test = s4;

    // ─── SECTION 5: AI NARRATIVE VALIDATION ───────────────────────
    const s5 = await runAINarrativeValidation(db);
    (results.sections as Record<string, unknown>).ai_narrative_validation = s5;

    // ─── SECTION 6: SNAPSHOT CONSISTENCY ──────────────────────────
    if (projectId) {
      const s6 = await runSnapshotConsistency(db, projectId);
      (results.sections as Record<string, unknown>).snapshot_consistency = s6;
    }

    // ─── SECTION 7: DRIFT DETECTION ──────────────────────────────
    const s7 = await runDriftDetection(db);
    (results.sections as Record<string, unknown>).drift_detection = s7;

    // ─── SECTION 8: STRUCTURAL RLS CHECK ──────────────────────────
    const s8 = await runStructuralRlsCheck(db);
    (results.sections as Record<string, unknown>).structural_rls_check = s8;

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("System audit error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// ─── SECTION 1 ────────────────────────────────────────────────────
async function runFinancialReconciliation(
  db: ReturnType<typeof createClient>,
  projectId: string
) {
  // Planned total
  const { data: budget } = await db
    .from("project_budgets")
    .select(
      "planned_labor_cost, planned_material_cost, planned_machine_cost, planned_other_cost, contract_value"
    )
    .eq("project_id", projectId)
    .maybeSingle();

  const plannedTotal = budget
    ? (budget.planned_labor_cost || 0) +
      (budget.planned_material_cost || 0) +
      (budget.planned_machine_cost || 0) +
      (budget.planned_other_cost || 0)
    : null;

  // Manual recompute - labor costs via raw SQL-like approach
  const { data: laborEntries } = await db
    .from("time_entries")
    .select("duration_hours, user_id, project_id")
    .eq("project_id", projectId)
    .eq("status", "closed")
    .not("check_out_at", "is", null)
    .not("duration_hours", "is", null)
    .gt("duration_hours", 0);

  let laborTotal = 0;
  if (laborEntries && laborEntries.length > 0) {
    // Get cost rates for all relevant users
    const userIds = [...new Set(laborEntries.map((e) => e.user_id))];
    const { data: members } = await db
      .from("project_members")
      .select("user_id, cost_rate")
      .eq("project_id", projectId)
      .in("user_id", userIds);

    const rateMap = new Map(
      (members || []).map((m) => [m.user_id, m.cost_rate || 0])
    );
    for (const entry of laborEntries) {
      laborTotal += entry.duration_hours * (rateMap.get(entry.user_id) || 0);
    }
  }

  // Receipts total (reviewed + processed)
  const { data: receiptRows } = await db
    .from("receipts")
    .select("amount")
    .eq("project_id", projectId)
    .in("review_status", ["reviewed", "processed"]);

  const receiptTotal = (receiptRows || []).reduce(
    (sum, r) => sum + (r.amount || 0),
    0
  );

  const manualActualTotal =
    Math.round((laborTotal + receiptTotal) * 100) / 100;

  // RPC actual
  let rpcActual: number | null = null;
  try {
    const { data: rpcData } = await db.rpc("project_actual_costs", {
      p_project_id: projectId,
    });
    if (rpcData && rpcData.length > 0) {
      rpcActual = rpcData[0].total_actual_cost;
    }
  } catch {
    rpcActual = null;
  }

  // Latest snapshot
  const { data: snapshot } = await db
    .from("project_financial_snapshots")
    .select("actual_labor_cost, actual_material_cost, actual_machine_cost, actual_other_cost")
    .eq("project_id", projectId)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const snapshotTotal = snapshot
    ? (snapshot.actual_labor_cost || 0) +
      (snapshot.actual_material_cost || 0) +
      (snapshot.actual_machine_cost || 0) +
      (snapshot.actual_other_cost || 0)
    : null;

  const rpcDiff =
    rpcActual !== null
      ? Math.round(Math.abs(manualActualTotal - rpcActual) * 100) / 100
      : null;
  const snapshotDiff =
    snapshotTotal !== null
      ? Math.round(Math.abs(manualActualTotal - snapshotTotal) * 100) / 100
      : null;

  return {
    pass: (rpcDiff === null || rpcDiff <= 0.01) && (snapshotDiff === null || snapshotDiff <= 0.01),
    planned_total: plannedTotal,
    contract_value: budget?.contract_value ?? null,
    manual_actual_total: manualActualTotal,
    labor_total: Math.round(laborTotal * 100) / 100,
    receipt_total: Math.round(receiptTotal * 100) / 100,
    rpc_actual_total: rpcActual,
    rpc_difference: rpcDiff,
    snapshot_actual_total: snapshotTotal !== null ? Math.round(snapshotTotal * 100) / 100 : null,
    snapshot_difference: snapshotDiff,
  };
}

// ─── SECTION 2 ────────────────────────────────────────────────────
async function runTimeInclusionContract(
  db: ReturnType<typeof createClient>,
  projectId?: string
) {
  const filter = (q: ReturnType<typeof db.from>) =>
    projectId ? q.eq("project_id", projectId) : q;

  // Closed with duration = 0
  const { count: zeroDuration } = await filter(
    db
      .from("time_entries")
      .select("id", { count: "exact", head: true })
      .eq("status", "closed")
      .eq("duration_hours", 0)
  );

  // Closed with check_out_at NULL
  const { count: nullCheckout } = await filter(
    db
      .from("time_entries")
      .select("id", { count: "exact", head: true })
      .eq("status", "closed")
      .is("check_out_at", null)
  );

  // Total closed
  const { count: totalClosed } = await filter(
    db
      .from("time_entries")
      .select("id", { count: "exact", head: true })
      .eq("status", "closed")
  );

  // Matching canonical predicate (closed + checkout not null + duration > 0)
  const { count: canonicalMatch } = await filter(
    db
      .from("time_entries")
      .select("id", { count: "exact", head: true })
      .eq("status", "closed")
      .not("check_out_at", "is", null)
      .not("duration_hours", "is", null)
      .gt("duration_hours", 0)
  );

  const invalidInClosed = (zeroDuration || 0) + (nullCheckout || 0);

  return {
    pass: invalidInClosed === 0,
    closed_with_zero_duration: zeroDuration || 0,
    closed_with_null_checkout: nullCheckout || 0,
    total_closed_entries: totalClosed || 0,
    canonical_predicate_matches: canonicalMatch || 0,
    invalid_entries_in_closed: invalidInClosed,
  };
}

// ─── SECTION 3 ────────────────────────────────────────────────────
async function runEnumIntegrity(db: ReturnType<typeof createClient>) {
  const canonicalEnums: Record<string, { table: string; column: string; allowed: string[] }> = {
    scope_item_type: {
      table: "project_scope_items",
      column: "item_type",
      allowed: ["labor", "material", "machine", "other"],
    },
    receipt_review_status: {
      table: "receipts",
      column: "review_status",
      allowed: ["pending", "reviewed", "processed"],
    },
    task_status: {
      table: "tasks",
      column: "status",
      allowed: ["not_started", "in_progress", "blocked", "done"],
    },
    deficiency_status: {
      table: "deficiencies",
      column: "status",
      allowed: ["open", "in_progress", "fixed", "verified"],
    },
    invoice_status: {
      table: "invoices",
      column: "status",
      allowed: ["draft", "sent", "paid", "overdue", "void"],
    },
    safety_status: {
      table: "safety_forms",
      column: "status",
      allowed: ["draft", "submitted", "reviewed"],
    },
  };

  const checks: Record<string, unknown> = {};
  let allPass = true;

  for (const [key, config] of Object.entries(canonicalEnums)) {
    const { data: rows } = await db
      .from(config.table)
      .select(config.column)
      .limit(1000);

    const distinctValues = [
      ...new Set((rows || []).map((r) => r[config.column]).filter(Boolean)),
    ];
    const unexpected = distinctValues.filter(
      (v) => !config.allowed.includes(v as string)
    );
    const pass = unexpected.length === 0;
    if (!pass) allPass = false;

    checks[key] = {
      pass,
      found: distinctValues,
      allowed: config.allowed,
      unexpected,
    };
  }

  return { pass: allPass, checks };
}

// ─── SECTION 4: BEHAVIORAL CROSS-ORG ISOLATION ───────────────────
async function runCrossOrgBehavioralTest(
  serviceDb: ReturnType<typeof createClient>,
  userClient: ReturnType<typeof createClient>,
  supabaseUrl: string,
  anonKey: string,
  callerUserId: string,
  targetProjectId?: string,
) {
  const tests: Array<{
    test_name: string;
    actor: string;
    query: string;
    expected: string;
    actual: string;
    pass: boolean;
  }> = [];

  // Find caller's org(s)
  const { data: callerOrgs } = await serviceDb
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", callerUserId)
    .eq("is_active", true);

  const callerOrgIds = (callerOrgs || []).map((o: { organization_id: string }) => o.organization_id);

  // Find a project NOT in caller's org(s) for cross-org tests
  let crossOrgProjectId: string | null = null;
  if (callerOrgIds.length > 0) {
    const { data: otherProject } = await serviceDb
      .from("projects")
      .select("id")
      .not("organization_id", "in", `(${callerOrgIds.join(",")})`)
      .limit(1)
      .maybeSingle();
    crossOrgProjectId = otherProject?.id || null;
  }

  const anonClient = createClient(supabaseUrl, anonKey);

  // ── BASELINE: Member can see own project ──
  if (targetProjectId) {
    const { data, error } = await userClient
      .from("projects")
      .select("id")
      .eq("id", targetProjectId);

    tests.push({
      test_name: "Baseline: member can read own project",
      actor: "org_member",
      query: `SELECT id FROM projects WHERE id = '${targetProjectId}'`,
      expected: "1 row",
      actual: error ? `Error: ${error.code}` : `${(data || []).length} rows`,
      pass: !error && (data || []).length === 1,
    });
  }

  // ── CROSS-ORG: Caller queries project from another org ──
  if (crossOrgProjectId) {
    const crossTests: Array<{ name: string; table: string; filter: string }> = [
      { name: "SELECT projects", table: "projects", filter: "id" },
      { name: "SELECT tasks", table: "tasks", filter: "project_id" },
      { name: "SELECT invoices", table: "invoices", filter: "project_id" },
      { name: "SELECT time_entries", table: "time_entries", filter: "project_id" },
      { name: "SELECT receipts", table: "receipts", filter: "project_id" },
      { name: "SELECT safety_forms", table: "safety_forms", filter: "project_id" },
      { name: "SELECT project_budgets", table: "project_budgets", filter: "project_id" },
      { name: "SELECT project_scope_items", table: "project_scope_items", filter: "project_id" },
    ];

    for (const ct of crossTests) {
      const q = userClient
        .from(ct.table)
        .select("id", { count: "exact", head: false })
        .eq(ct.filter, crossOrgProjectId)
        .limit(1);

      const { data: rows, error: qErr } = await q;
      const rowCount = (rows || []).length;

      tests.push({
        test_name: `Cross-org ${ct.name}`,
        actor: "non_member",
        query: `SELECT id FROM ${ct.table} WHERE ${ct.filter} = '${crossOrgProjectId}' LIMIT 1`,
        expected: "0 rows",
        actual: qErr ? `Error: ${qErr.code}` : `${rowCount} rows`,
        pass: qErr ? qErr.code === "42501" : rowCount === 0,
      });
    }
  } else {
    tests.push({
      test_name: "Cross-org tests skipped",
      actor: "non_member",
      query: "N/A — no other organization exists in the database",
      expected: "Requires multi-org data",
      actual: "Skipped",
      pass: true,
    });
  }

  // ── UNAUTHENTICATED: Anon key, no JWT ──
  const unauthTarget = targetProjectId || crossOrgProjectId;
  if (unauthTarget) {
    const unauthTests: Array<{ name: string; table: string; filter: string }> = [
      { name: "SELECT projects", table: "projects", filter: "id" },
      { name: "SELECT tasks", table: "tasks", filter: "project_id" },
      { name: "SELECT invoices", table: "invoices", filter: "project_id" },
      { name: "SELECT time_entries", table: "time_entries", filter: "project_id" },
    ];

    for (const ut of unauthTests) {
      const { data: rows, error: qErr } = await anonClient
        .from(ut.table)
        .select("id")
        .eq(ut.filter, unauthTarget)
        .limit(1);

      const rowCount = (rows || []).length;

      tests.push({
        test_name: `Unauth ${ut.name}`,
        actor: "unauthenticated",
        query: `SELECT id FROM ${ut.table} WHERE ${ut.filter} = '${unauthTarget}' LIMIT 1`,
        expected: "0 rows or permission error",
        actual: qErr ? `Error: ${qErr.code}` : `${rowCount} rows`,
        pass: qErr !== null || rowCount === 0,
      });
    }
  }

  const allPass = tests.every(t => t.pass);
  const failCount = tests.filter(t => !t.pass).length;

  return {
    pass: allPass,
    tests,
    test_count: tests.length,
    fail_count: failCount,
    target_project_id: targetProjectId || null,
    cross_org_project_id: crossOrgProjectId,
    note: crossOrgProjectId
      ? `Behavioral isolation tests ran across ${tests.length} queries`
      : "Limited to baseline + unauthenticated tests (single org detected)",
  };
}

// ─── SECTION 5 ────────────────────────────────────────────────────
async function runAINarrativeValidation(
  db: ReturnType<typeof createClient>
) {
  const { data: latestInsight } = await db
    .from("ai_insights")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestInsight) {
    return { pass: true, note: "No AI insights found" };
  }

  const content =
    typeof latestInsight.content === "string"
      ? JSON.parse(latestInsight.content)
      : latestInsight.content;

  const narrative = content?.narrative || content?.summary || "";
  const evidence = content?.evidence || content?.EVIDENCE || null;

  if (!narrative) {
    return { pass: true, note: "No narrative in latest insight" };
  }

  // Extract numeric patterns from narrative
  const numericPattern =
    /\$[0-9,]+(?:\.\d+)?|[0-9,]+(?:\.\d+)?%|(?<!\w)[0-9,]+(?:\.\d+)?(?!\w)/g;
  const narrativeNumbers = (narrative.match(numericPattern) || []).map(
    (n: string) => n.replace(/[$,%]/g, "").replace(/,/g, "")
  );

  if (!evidence) {
    return {
      pass: narrativeNumbers.length === 0,
      narrative_numbers: narrativeNumbers,
      evidence_numbers: [],
      missing: narrativeNumbers,
      note: "No EVIDENCE block found",
    };
  }

  // Flatten evidence values
  const evidenceValues: string[] = [];
  function extractValues(obj: unknown) {
    if (obj === null || obj === undefined) return;
    if (typeof obj === "number") {
      evidenceValues.push(String(obj));
      evidenceValues.push(String(Math.round(obj)));
      evidenceValues.push(String(Math.round(obj * 100) / 100));
      evidenceValues.push(obj.toFixed(1));
      evidenceValues.push(obj.toFixed(2));
    } else if (typeof obj === "string") {
      const nums = obj.match(/[0-9]+(?:\.\d+)?/g);
      if (nums) evidenceValues.push(...nums);
    } else if (Array.isArray(obj)) {
      obj.forEach(extractValues);
    } else if (typeof obj === "object") {
      Object.values(obj as Record<string, unknown>).forEach(extractValues);
    }
  }
  extractValues(evidence);

  const evidenceSet = new Set(evidenceValues);
  const missing = narrativeNumbers.filter(
    (n: string) => !evidenceSet.has(n) && n !== "0" && n !== "1" && n !== "2"
  );

  return {
    pass: missing.length === 0,
    insight_id: latestInsight.id,
    insight_type: latestInsight.insight_type,
    narrative_numbers: narrativeNumbers,
    evidence_numbers: [...new Set(evidenceValues)].slice(0, 50),
    missing,
  };
}

// ─── SECTION 6 ────────────────────────────────────────────────────
async function runSnapshotConsistency(
  db: ReturnType<typeof createClient>,
  projectId: string
) {
  const { data: snapshot } = await db
    .from("project_financial_snapshots")
    .select("*")
    .eq("project_id", projectId)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!snapshot) {
    return { pass: true, note: "No snapshots found for project" };
  }

  // Recompute current values
  const { data: budget } = await db
    .from("project_budgets")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  const { data: taskCounts } = await db
    .from("tasks")
    .select("status")
    .eq("project_id", projectId);

  const totalTasks = taskCounts?.length || 0;
  const completedTasks =
    taskCounts?.filter((t) => t.status === "done").length || 0;

  const diffs: Record<string, { snapshot: number; live: number; diff: number }> = {};

  if (budget) {
    const fields = [
      { key: "planned_labor_cost", snap: snapshot.planned_labor_cost, live: budget.planned_labor_cost },
      { key: "planned_material_cost", snap: snapshot.planned_material_cost, live: budget.planned_material_cost },
    ];
    for (const f of fields) {
      const d = Math.abs((f.snap || 0) - (f.live || 0));
      if (d > 0.01) {
        diffs[f.key] = { snapshot: f.snap || 0, live: f.live || 0, diff: Math.round(d * 100) / 100 };
      }
    }
  }

  return {
    pass: Object.keys(diffs).length === 0,
    snapshot_id: snapshot.id,
    captured_at: snapshot.captured_at,
    drifted_fields: diffs,
    task_counts: { total: totalTasks, completed: completedTasks },
    note:
      Object.keys(diffs).length > 0
        ? "Budget changed since last snapshot — expected drift until next snapshot capture"
        : "Snapshot consistent with current data",
  };
}

// ─── SECTION 7 ────────────────────────────────────────────────────
async function runDriftDetection(db: ReturnType<typeof createClient>) {
  // Canonical contract: what MUST exist in the DB
  const canonicalChecks = [
    { table: "projects", constraint: "chk_projects_status" },
    { table: "project_scope_items", constraint: "chk_scope_item_type" },
    { table: "project_scope_items", constraint: "source_type_check" },
    { table: "organization_memberships", constraint: "valid_org_role" },
    { table: "receipts", constraint: "cost_type_check" },
    { table: "time_adjustment_requests", constraint: "status_check" },
    { table: "safety_form_amendments", constraint: "status_check" },
  ];

  const canonicalEnums = [
    "task_status",
    "invoice_status",
    "deficiency_status",
    "safety_status",
    "notification_type",
    "receipt_category",
    "receipt_review_status",
    "app_role",
  ];

  const canonicalNotNull: Record<string, string[]> = {
    time_entries: ["project_timezone", "organization_id", "user_id", "project_id"],
    tasks: ["title", "project_id", "created_by"],
    projects: ["name", "organization_id", "created_by", "location"],
    receipts: ["file_path", "project_id", "uploaded_by"],
  };

  // Check constraints exist by querying columns (indirect check via schema)
  // Since we can't query pg_constraint directly via supabase-js,
  // verify by attempting to read the schema
  const { data: columns } = await db
    .from("information_schema.columns" as never)
    .select("table_name, column_name, is_nullable, column_default")
    .eq("table_schema", "public")
    .in("table_name", Object.keys(canonicalNotNull));

  const notNullIssues: Array<{ table: string; column: string; expected: string; actual: string }> = [];

  if (columns) {
    for (const [table, cols] of Object.entries(canonicalNotNull)) {
      for (const col of cols) {
        const found = (columns as Array<Record<string, string>>).find(
          (c) => c.table_name === table && c.column_name === col
        );
        if (found && found.is_nullable === "YES") {
          notNullIssues.push({
            table,
            column: col,
            expected: "NOT NULL",
            actual: "NULLABLE",
          });
        }
      }
    }
  }

  return {
    pass: notNullIssues.length === 0,
    canonical_check_constraints: canonicalChecks,
    canonical_enums: canonicalEnums,
    not_null_issues: notNullIssues,
    note: "Verifies critical NOT NULL constraints. CHECK/ENUM verification requires direct pg_constraint access.",
  };
}

// ─── SECTION 8: STRUCTURAL RLS CHECK ─────────────────────────────
async function runStructuralRlsCheck(db: ReturnType<typeof createClient>) {
  const criticalTables = [
    "projects",
    "tasks",
    "time_entries",
    "receipts",
    "invoices",
    "project_budgets",
    "project_financial_snapshots",
    "org_financial_snapshots",
    "project_scope_items",
    "project_members",
    "safety_forms",
    "blockers",
    "deficiencies",
    "attachments",
    "daily_logs",
    "comments",
    "manpower_requests",
    "timesheet_periods",
  ];

  const { data: rlsData, error } = await db.rpc("check_rls_status", {
    p_tables: criticalTables,
  });

  if (error) {
    return {
      pass: false,
      tables: [],
      note: `RPC error: ${error.message}`,
    };
  }

  const tables = (rlsData || []) as Array<{
    table_name: string;
    rls_enabled: boolean;
    policy_count: number;
    policy_names: string[];
  }>;

  const missingRls = tables.filter((t) => !t.rls_enabled);
  const noPolicies = tables.filter((t) => t.rls_enabled && t.policy_count === 0);
  const checkedNames = tables.map((t) => t.table_name);
  const missingFromDb = criticalTables.filter((t) => !checkedNames.includes(t));

  return {
    pass: missingRls.length === 0 && noPolicies.length === 0 && missingFromDb.length === 0,
    tables,
    missing_rls: missingRls.map((t) => t.table_name),
    rls_no_policies: noPolicies.map((t) => t.table_name),
    missing_from_db: missingFromDb,
    note:
      missingRls.length > 0
        ? `CRITICAL: ${missingRls.length} table(s) have RLS disabled`
        : noPolicies.length > 0
          ? `WARNING: ${noPolicies.length} table(s) have RLS enabled but no policies`
          : `All ${tables.length} critical tables have RLS enabled with policies`,
  };
}
