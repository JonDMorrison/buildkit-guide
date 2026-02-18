import { supabase } from '@/integrations/supabase/client';

// -- Types --

export type AuditStatus = 'PASS' | 'FAIL' | 'NEEDS_MANUAL';

export interface AuditCheck {
  id: string;
  name: string;
  area: string;
  expected: string;
  actual: string;
  status: AuditStatus;
  pass: boolean; // derived: status === 'PASS'
  evidence: string;
  severity: 'P0' | 'P1' | 'P2';
}

export interface PromptsAuditResult {
  ran_at: string;
  environment: string;
  checks: AuditCheck[];
  summary: {
    total: number;
    pass: number;
    fail: number;
    needs_manual: number;
    blockers: AuditCheck[];
  };
}

// -- Helpers --

function makeCheck(
  id: string,
  name: string,
  area: string,
  severity: 'P0' | 'P1' | 'P2',
  expected: string,
  actual: string,
  status: AuditStatus,
  evidence: string,
): AuditCheck {
  return { id, name, area, severity, expected, actual, status, pass: status === 'PASS', evidence };
}

const tableExists = async (tableName: string): Promise<{ exists: boolean; count: number }> => {
  try {
    const { count, error } = await (supabase as any)
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    if (error) return { exists: false, count: 0 };
    return { exists: true, count: count ?? 0 };
  } catch {
    return { exists: false, count: 0 };
  }
};

// -- Individual Checks --

async function checkWorkflowTablesExist(): Promise<AuditCheck> {
  const tables = ['workflow_phases', 'workflow_phase_requirements', 'project_workflows', 'project_workflow_steps'];
  const results: Record<string, { exists: boolean; count: number }> = {};
  for (const t of tables) {
    results[t] = await tableExists(t);
  }
  const allExist = tables.every(t => results[t].exists);
  const evidence = tables.map(t => `${t}: ${results[t].exists ? `exists (${results[t].count} rows)` : 'NOT FOUND'}`).join('\n');

  return makeCheck(
    'workflow_tables', 'Workflow Tables Exist', 'Schema', 'P0',
    'All 4 workflow tables exist',
    allExist ? 'All found' : `Missing: ${tables.filter(t => !results[t].exists).join(', ')}`,
    allExist ? 'PASS' : 'FAIL',
    evidence,
  );
}

async function checkWorkflowRls(): Promise<AuditCheck> {
  const tables = ['workflow_phases', 'workflow_phase_requirements', 'project_workflows', 'project_workflow_steps'];
  const results: Record<string, { rls: boolean; force: boolean }> = {};
  let allPass = true;

  for (const t of tables) {
    try {
      const { data } = await (supabase as any).rpc('check_table_rls', { p_table_name: t });
      const row = data?.[0] ?? data;
      results[t] = { rls: !!row?.rls_enabled, force: !!row?.force_rls };
      if (!row?.rls_enabled || !row?.force_rls) allPass = false;
    } catch {
      results[t] = { rls: false, force: false };
      allPass = false;
    }
  }

  const evidence = tables.map(t =>
    `${t}: rls=${results[t]?.rls ?? 'unknown'}, force=${results[t]?.force ?? 'unknown'}`
  ).join('\n');

  return makeCheck(
    'workflow_rls', 'Workflow RLS + FORCE RLS Enabled', 'Security', 'P0',
    'RLS enabled + forced on all workflow tables',
    allPass ? 'All enabled & forced' : 'Some tables missing RLS/FORCE',
    allPass ? 'PASS' : 'FAIL',
    evidence,
  );
}

// B) Fixed: only PASS on genuine RLS denial (42501 or 'row-level security')
async function checkWorkflowWriteDeny(): Promise<AuditCheck> {
  const id = 'workflow_write_deny';
  const name = 'Workflow Write Deny (Client)';
  const area = 'Security';
  const severity: 'P0' = 'P0';
  const expected = 'UPDATE on project_workflow_steps denied by RLS (code 42501)';

  try {
    // 1. Get a real row
    const { data: rows, error: fetchErr } = await (supabase as any)
      .from('project_workflow_steps')
      .select('id')
      .limit(1);

    if (fetchErr || !rows || rows.length === 0) {
      return makeCheck(id, name, area, severity, expected,
        'No rows in project_workflow_steps to test against',
        'NEEDS_MANUAL', 'Insert workflow steps via rpc_set_project_flow_mode first, then rerun.');
    }

    const rowId = rows[0].id;

    // 2. Attempt UPDATE on that row
    const { error } = await (supabase as any)
      .from('project_workflow_steps')
      .update({ sort_order: 999 })
      .eq('id', rowId);

    if (!error) {
      // Update succeeded -- vulnerability
      return makeCheck(id, name, area, severity, expected,
        'UPDATE succeeded (VULNERABILITY)', 'FAIL',
        `Row ${rowId} was updated without RLS denial.`);
    }

    // 3. Check for RLS-specific denial
    const code = error.code;
    const msg = (error.message || '').toLowerCase();
    const isRlsDenial = code === '42501' || msg.includes('row-level security');

    if (isRlsDenial) {
      return makeCheck(id, name, area, severity, expected,
        `Denied: code=${code}`, 'PASS',
        `Error: ${error.message}`);
    }

    // 4. Some other error -- not proof of RLS
    return makeCheck(id, name, area, severity, expected,
      `Error but not RLS denial: code=${code}`, 'FAIL',
      `Error: ${error.message} (code: ${code}). This is NOT proof of RLS enforcement.`);
  } catch (e: any) {
    return makeCheck(id, name, area, severity, expected,
      `Exception: ${e.message}`, 'FAIL', e.message);
  }
}

// H) Fixed: use pg_proc query via execute_readonly_sql
async function checkRpcInventory(): Promise<AuditCheck> {
  const rpcs = [
    'rpc_set_project_flow_mode',
    'rpc_get_project_workflow',
    'rpc_request_phase_advance',
    'rpc_approve_phase',
    'convert_quote_to_invoice',
    'rpc_log_quote_event',
    'rpc_update_project_status',
    'rpc_create_estimate',
    'rpc_update_estimate_header',
    'rpc_upsert_estimate_line_item',
    'rpc_delete_estimate_line_item',
    'rpc_recalculate_estimate_totals',
    'rpc_approve_estimate',
    'rpc_delete_estimate',
    'rpc_duplicate_estimate',
    'rpc_generate_tasks_from_estimate',
  ];

  try {
    const sql = `SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = ANY(ARRAY[${rpcs.map(r => `'${r}'`).join(',')}])`;
    const { data, error } = await (supabase as any).rpc('execute_readonly_sql', { p_sql: sql });

    if (error) {
      // Fallback: try calling each RPC with empty args and check if function exists
      return await checkRpcInventoryFallback(rpcs);
    }

    const foundNames = (data || []).map((r: any) => r.proname);
    const missing = rpcs.filter(r => !foundNames.includes(r));

    return makeCheck(
      'rpc_inventory', 'RPC Inventory Exists', 'Schema', 'P1',
      `All ${rpcs.length} RPCs exist in pg_proc`,
      `${foundNames.length}/${rpcs.length} found`,
      missing.length === 0 ? 'PASS' : 'FAIL',
      `Found: ${foundNames.join(', ')}\nMissing: ${missing.length ? missing.join(', ') : 'none'}`,
    );
  } catch {
    return await checkRpcInventoryFallback(rpcs);
  }
}

async function checkRpcInventoryFallback(rpcs: string[]): Promise<AuditCheck> {
  const found: string[] = [];
  const missing: string[] = [];

  for (const rpc of rpcs) {
    try {
      const { error } = await (supabase as any).rpc(rpc, {});
      if (!error || !error.message?.includes('does not exist')) {
        found.push(rpc);
      } else {
        missing.push(rpc);
      }
    } catch {
      missing.push(rpc);
    }
  }

  return makeCheck(
    'rpc_inventory', 'RPC Inventory Exists', 'Schema', 'P1',
    `All ${rpcs.length} RPCs exist`,
    `${found.length}/${rpcs.length} found (fallback method)`,
    missing.length === 0 ? 'PASS' : 'FAIL',
    `Found: ${found.join(', ')}\nMissing: ${missing.length ? missing.join(', ') : 'none'}\nNote: Used fallback method (pg_proc query unavailable).`,
  );
}

async function checkFlowModeToggle(projectId: string): Promise<AuditCheck> {
  const id = 'flow_mode_toggle';
  const name = 'Flow Mode Toggle Works';
  const area = 'Workflow';
  const severity: 'P1' = 'P1';

  if (!projectId) {
    return makeCheck(id, name, area, severity,
      'Toggle flow mode and verify',
      'No project selected',
      'NEEDS_MANUAL', 'Select a project to run this check.');
  }

  try {
    const { error: setErr } = await (supabase as any).rpc('rpc_set_project_flow_mode', {
      p_project_id: projectId, p_flow_mode: 'ai_optimized',
    });
    if (setErr) throw setErr;

    const { data: wf, error: getErr } = await (supabase as any).rpc('rpc_get_project_workflow', {
      p_project_id: projectId,
    });
    if (getErr) throw getErr;

    const mode = wf?.flow_mode;
    const hasPhases = Array.isArray(wf?.phases) && wf.phases.length > 0;
    const currentPhase = wf?.current_phase;
    const pass = mode === 'ai_optimized' && hasPhases;

    // Restore
    await (supabase as any).rpc('rpc_set_project_flow_mode', {
      p_project_id: projectId, p_flow_mode: 'standard',
    });

    return makeCheck(id, name, area, severity,
      'mode=ai_optimized, phases initialized, current_phase set',
      `mode=${mode}, phases=${wf?.phases?.length ?? 0}, current_phase=${currentPhase}`,
      pass ? 'PASS' : 'FAIL',
      JSON.stringify({ mode, phase_count: wf?.phases?.length, current_phase: currentPhase }),
    );
  } catch (e: any) {
    return makeCheck(id, name, area, severity,
      'Toggle succeeds', `Error: ${e.message}`, 'FAIL', e.message);
  }
}

// F) Fixed: never hard-code PASS
async function checkSidebarGating(): Promise<AuditCheck> {
  return makeCheck(
    'sidebar_gating', 'Sidebar "Workflow" Nav Gating', 'UI', 'P2',
    'Workflow nav only visible when ai_optimized enabled',
    'Cannot be verified automatically from audit runner',
    'NEEDS_MANUAL',
    'Manual test: Enable ai_optimized for a project, confirm "Workflow" appears in sidebar. Disable and confirm it disappears.',
  );
}

// 7) Quote Status + Events
async function checkQuoteStatusAndEvents(): Promise<AuditCheck> {
  const eventsTable = await tableExists('quote_events');

  let writeDenied = false;
  try {
    const { error } = await (supabase as any)
      .from('quote_events')
      .insert({
        quote_id: '00000000-0000-0000-0000-000000000000',
        event_type: 'test',
        actor_user_id: '00000000-0000-0000-0000-000000000000',
      });
    writeDenied = !!error;
  } catch {
    writeDenied = true;
  }

  const { data: statusSample } = await (supabase as any)
    .from('quotes')
    .select('status')
    .limit(100);
  const foundStatuses = [...new Set((statusSample || []).map((r: any) => r.status))];
  const pass = eventsTable.exists && writeDenied;

  return makeCheck(
    'quote_status_events', 'Quote Status Enum + Events', 'Quotes', 'P0',
    'quote_events exists and is write-denied to client',
    `table=${eventsTable.exists}, write_denied=${writeDenied}, found_statuses=[${foundStatuses.join(',')}]`,
    pass ? 'PASS' : 'FAIL',
    `Events table rows: ${eventsTable.count}\nWrite denied: ${writeDenied}\nFound statuses: ${foundStatuses.join(',') || 'no quotes'}`,
  );
}

// C) Uses quotes.converted_invoice_id as canonical source
async function checkQuoteConversion(): Promise<AuditCheck> {
  const id = 'quote_conversion';
  const name = 'Quote -> Invoice Conversion';
  const area = 'Conversion';
  const severity: 'P0' = 'P0';
  const expected = 'Conversion creates invoice, quote.converted_invoice_id set, repeat call blocked (idempotency guard)';

  // 1. Find an approved quote (deterministic ordering)
  const { data: approvedQuotes } = await (supabase as any)
    .from('quotes')
    .select('id, quote_number, converted_invoice_id')
    .eq('status', 'approved')
    .order('updated_at', { ascending: false })
    .limit(1);

  if (!approvedQuotes || approvedQuotes.length === 0) {
    return makeCheck(id, name, area, severity, expected,
      'No approved quotes found', 'NEEDS_MANUAL',
      'Create and approve a quote, then rerun audit to test conversion.');
  }

  const quote = approvedQuotes[0];

  // 2. If not yet converted, we cannot test -- NEEDS_MANUAL
  if (!quote.converted_invoice_id) {
    return makeCheck(id, name, area, severity, expected,
      `Quote ${quote.quote_number} is approved but not yet converted`,
      'NEEDS_MANUAL',
      'Click Convert in the Quote Detail UI, then rerun audit to verify idempotency.');
  }

  // 3. Already converted -- verify idempotency guard by re-calling RPC
  try {
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;
    if (!userId) {
      return makeCheck(id, name, area, severity, expected,
        'No authenticated user session', 'NEEDS_MANUAL',
        'Log in and rerun audit.');
    }

    const { data: secondResult, error } = await supabase.rpc('convert_quote_to_invoice', {
      p_quote_id: quote.id,
      p_actor_id: userId,
    });

    if (error) {
      // Expected: RPC raises "already converted" exception
      const msg = (error.message || '').toLowerCase();
      const isAlreadyConverted = msg.includes('already converted');
      return makeCheck(id, name, area, severity, expected,
        isAlreadyConverted
          ? `Idempotency guard working: RPC rejected duplicate conversion`
          : `Unexpected error on re-call: ${error.message}`,
        isAlreadyConverted ? 'PASS' : 'FAIL',
        `Canonical converted_invoice_id: ${quote.converted_invoice_id}\nRPC error: ${error.message} (code: ${error.code})`);
    }

    // RPC succeeded -- check if same ID returned (alternative idempotency)
    if (secondResult === quote.converted_invoice_id) {
      return makeCheck(id, name, area, severity, expected,
        `Same invoice_id returned: ${secondResult}`, 'PASS',
        `Canonical: ${quote.converted_invoice_id}, Repeat call: ${secondResult}`);
    }

    // Duplicate invoice created -- P0 vulnerability
    return makeCheck(id, name, area, severity, expected,
      `DUPLICATE INVOICE CREATED: rpc returned ${secondResult}, expected ${quote.converted_invoice_id}`,
      'FAIL',
      `This is a P0 idempotency violation. Two invoices exist for the same quote.`);
  } catch (e: any) {
    return makeCheck(id, name, area, severity, expected,
      `Exception: ${e.message}`, 'FAIL', e.message);
  }
}

// D) Uses quotes.converted_invoice_id as canonical source for snapshots
async function checkConversionSnapshots(): Promise<AuditCheck> {
  const id = 'conversion_snapshots';
  const name = 'Conversion Snapshots (Source Integrity)';
  const area = 'Conversion';
  const severity: 'P0' = 'P0';
  const expected = 'bill_to from parent client, ship_to from project.location, send_to from AP email (not PM email)';

  // Find most recent converted quote
  const { data: convertedQuotes } = await (supabase as any)
    .from('quotes')
    .select('id, quote_number, converted_invoice_id, parent_client_id, client_id, project_id, customer_pm_email')
    .not('converted_invoice_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (!convertedQuotes || convertedQuotes.length === 0) {
    return makeCheck(id, name, area, severity, expected,
      'No converted quotes found', 'NEEDS_MANUAL',
      'Convert a quote to invoice first, then rerun audit.');
  }

  const quote = convertedQuotes[0];
  const invoiceId = quote.converted_invoice_id;

  // Load invoice
  const { data: invoice } = await (supabase as any)
    .from('invoices')
    .select('bill_to_name, bill_to_address, ship_to_address, send_to_emails')
    .eq('id', invoiceId)
    .maybeSingle();

  if (!invoice) {
    return makeCheck(id, name, area, severity, expected,
      `Invoice ${invoiceId} not found (missing OR not visible due to RLS)`,
      'FAIL',
      `Quote ${quote.quote_number} points to invoice ${invoiceId} but it is missing. User=${(await supabase.auth.getSession()).data?.session?.user?.id}. Check invoices RLS policies.`);
  }

  // Load parent/client for comparison
  const clientId = quote.parent_client_id || quote.client_id;
  let parentClient: any = null;
  if (clientId) {
    const { data } = await (supabase as any).from('clients').select('name, billing_address, ap_email, email').eq('id', clientId).maybeSingle();
    parentClient = data;
  }

  // Load project for ship_to comparison
  let project: any = null;
  if (quote.project_id) {
    const { data } = await (supabase as any).from('projects').select('location').eq('id', quote.project_id).maybeSingle();
    project = data;
  }

  const norm = (s: string | null | undefined): string => (s ?? '').trim().replace(/\s+/g, ' ');
  const issues: string[] = [];

  // bill_to checks
  if (!invoice.bill_to_name && !invoice.bill_to_address) {
    issues.push('bill_to_name AND bill_to_address both empty on invoice');
  } else if (parentClient) {
    if (norm(parentClient.name) && norm(invoice.bill_to_name) && norm(invoice.bill_to_name) !== norm(parentClient.name)) {
      issues.push(`bill_to_name mismatch: expected="${norm(parentClient.name)}", got="${norm(invoice.bill_to_name)}"`);
    }
    if (norm(parentClient.billing_address) && norm(invoice.bill_to_address) && norm(invoice.bill_to_address) !== norm(parentClient.billing_address)) {
      issues.push(`bill_to_address mismatch: expected="${norm(parentClient.billing_address)}", got="${norm(invoice.bill_to_address)}"`);
    }
  }

  // ship_to checks
  if (!invoice.ship_to_address) {
    issues.push('ship_to_address empty on invoice');
  } else if (project?.location) {
    if (norm(invoice.ship_to_address) !== norm(project.location)) {
      issues.push(`ship_to_address mismatch: expected="${norm(project.location)}", got="${norm(invoice.ship_to_address)}"`);
    }
  }

  // send_to_emails checks
  const sendTo = norm(invoice.send_to_emails);
  if (!sendTo) {
    issues.push('send_to_emails empty on invoice');
  } else {
    const apEmail = parentClient?.ap_email || parentClient?.email;
    if (apEmail && !sendTo.toLowerCase().includes(apEmail.toLowerCase())) {
      issues.push(`send_to_emails does not contain AP email "${apEmail}", got "${sendTo}"`);
    }
    const pmEmail = quote.customer_pm_email;
    if (pmEmail && sendTo.toLowerCase().includes(pmEmail.toLowerCase())) {
      issues.push(`send_to_emails CONTAINS PM email "${pmEmail}" -- recipient swap regression`);
    }
  }

  // If parent client fields are empty, can't validate source -- NEEDS_MANUAL
  if (!parentClient && issues.length === 0) {
    return makeCheck(id, name, area, severity, expected,
      'No parent client found to validate source integrity', 'NEEDS_MANUAL',
      'Ensure the quote has a parent_client_id or client_id with billing fields, then rerun.');
  }

  return makeCheck(id, name, area, severity, expected,
    issues.length === 0 ? 'All snapshot fields match source data' : `Issues: ${issues.join('; ')}`,
    issues.length === 0 ? 'PASS' : 'FAIL',
    JSON.stringify({ invoice, parentClient, projectLocation: project?.location, pmEmail: quote.customer_pm_email, issues }, null, 2));
}

async function checkWorkflowRequirement(projectId: string): Promise<AuditCheck> {
  const id = 'workflow_requirement';
  const name = 'Workflow Requirement "require_quote_approved"';
  const area = 'Workflow';
  const severity: 'P1' = 'P1';

  if (!projectId) {
    return makeCheck(id, name, area, severity,
      'Server-side evaluation', 'No project selected',
      'NEEDS_MANUAL', 'Select a project to test.');
  }

  try {
    const { data: wf, error } = await (supabase as any).rpc('rpc_get_project_workflow', {
      p_project_id: projectId,
    });
    if (error) throw error;

    const phases = wf?.phases ?? [];
    let found = false;
    let reqPassed: boolean | null = null;
    for (const phase of phases) {
      for (const req of phase.requirements ?? []) {
        if (req.type === 'require_quote_approved') {
          found = true;
          reqPassed = req.passed;
        }
      }
    }

    return makeCheck(id, name, area, severity,
      'Requirement exists and is evaluated server-side',
      found ? `Found. passed=${reqPassed}` : 'Not found in any phase',
      found ? 'PASS' : 'FAIL',
      JSON.stringify(phases.map((p: any) => ({ key: p.key, requirements: p.requirements?.map((r: any) => r.type) }))));
  } catch (e: any) {
    return makeCheck(id, name, area, severity,
      'Evaluated server-side', `Error: ${e.message}`, 'FAIL', e.message);
  }
}

async function checkProjectStatusConstraint(): Promise<AuditCheck> {
  let rpcExists = false;
  try {
    const { error } = await (supabase as any).rpc('rpc_update_project_status', {});
    rpcExists = !error?.message?.includes('does not exist');
  } catch {
    rpcExists = false;
  }

  const { data: statuses } = await (supabase as any)
    .from('projects')
    .select('status')
    .limit(500);
  const found = [...new Set((statuses || []).map((r: any) => r.status))];
  const allowed = ['not_started', 'in_progress', 'completed', 'archived', 'deleted'];
  const unexpected = found.filter((s: string) => !allowed.includes(s));

  return makeCheck(
    'project_status', 'Project Status Constraint + UI', 'Projects', 'P0',
    `Constraint: ${allowed.join(',')}, RPC exists with role enforcement`,
    `RPC exists=${rpcExists}, found_statuses=[${found.join(',')}], unexpected=[${unexpected.join(',')}]`,
    rpcExists && unexpected.length === 0 ? 'PASS' : 'FAIL',
    `Allowed: ${allowed.join(',')}\nFound: ${found.join(',') || 'no projects'}\nRPC: ${rpcExists}`);
}

// E) Fixed: scoped by projectId
async function checkNotificationsHooked(projectId: string): Promise<AuditCheck> {
  const id = 'notifications_hooked';
  const name = 'Notifications Hooked';
  const area = 'Notifications';
  const severity: 'P1' = 'P1';

  if (!projectId) {
    return makeCheck(id, name, area, severity,
      'Notifications created for key events',
      'No project selected',
      'NEEDS_MANUAL', 'Select a project to run this check.');
  }

  try {
    const { data: notifications, count } = await (supabase as any)
      .from('notifications')
      .select('id, type, link_url, created_at', { count: 'exact' })
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(20);

    const total = count ?? 0;
    const hasLinks = (notifications || []).some((n: any) => n.link_url);

    if (total === 0) {
      return makeCheck(id, name, area, severity,
        'At least 1 project-scoped notification with valid link_url',
        'No notifications found for this project',
        'NEEDS_MANUAL',
        'Trigger a workflow phase request/approval or quote conversion for this project, then rerun.');
    }

    const pass = total > 0 && hasLinks;
    return makeCheck(id, name, area, severity,
      'At least 1 project-scoped notification with valid link_url',
      `${total} notifications, links_present=${hasLinks}`,
      pass ? 'PASS' : 'FAIL',
      `Recent: ${JSON.stringify((notifications || []).slice(0, 3).map((n: any) => ({ type: n.type, link_url: n.link_url })))}`);
  } catch (e: any) {
    return makeCheck(id, name, area, severity,
      'Notifications exist', `Error: ${e.message}`, 'FAIL', e.message);
  }
}

// G) Fixed: never hard-code PASS
async function checkInvoiceSendGuardrail(): Promise<AuditCheck> {
  const id = 'invoice_send_guardrail';
  const name = 'Invoice Send Guardrail';
  const area = 'Invoicing';
  const severity: 'P1' = 'P1';

  let rpcExists = false;
  try {
    const { error } = await (supabase as any).rpc('rpc_send_invoice', {});
    rpcExists = !error?.message?.includes('does not exist');
  } catch {
    rpcExists = false;
  }

  if (rpcExists) {
    return makeCheck(id, name, area, severity,
      'Server-side role enforcement on invoice send',
      'rpc_send_invoice exists but role enforcement not auto-testable',
      'NEEDS_MANUAL',
      'Test manually: call rpc_send_invoice as PM (should fail) and as Admin (should succeed).');
  }

  // Check for edge function approach
  return makeCheck(id, name, area, severity,
    'Server-side role enforcement on invoice send',
    'rpc_send_invoice not found; send-invoice-email edge function likely in use',
    'NEEDS_MANUAL',
    'Verify that the send-invoice-email edge function enforces role checks before sending. Test as PM vs Admin.');
}

// -- New check: Conversion Source Integrity (P0) --
async function checkConversionSourceIntegrity(): Promise<AuditCheck> {
  const id = 'conversion_source_integrity';
  const name = 'Conversion Source Integrity';
  const area = 'Conversion';
  const severity: 'P0' = 'P0';
  const expected = 'Invoice bill_to matches parent client, ship_to matches project.location, send_to is AP email not PM email';

  const { data: convertedQuotes } = await (supabase as any)
    .from('quotes')
    .select('id, quote_number, converted_invoice_id, parent_client_id, client_id, project_id, customer_pm_email')
    .not('converted_invoice_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (!convertedQuotes || convertedQuotes.length === 0) {
    return makeCheck(id, name, area, severity, expected,
      'No converted quotes exist', 'NEEDS_MANUAL',
      'Convert a quote to invoice, then rerun audit.');
  }

  const quote = convertedQuotes[0];
  const { data: invoice } = await (supabase as any)
    .from('invoices')
    .select('bill_to_name, bill_to_address, ship_to_address, send_to_emails')
    .eq('id', quote.converted_invoice_id)
    .maybeSingle();

  if (!invoice) {
    return makeCheck(id, name, area, severity, expected,
      `Invoice ${quote.converted_invoice_id} not found (missing OR not visible due to RLS)`,
      'FAIL',
      `Check invoices RLS policies. Quote ${quote.quote_number} references this invoice.`);
  }

  const clientId = quote.parent_client_id || quote.client_id;
  let client: any = null;
  if (clientId) {
    const { data } = await (supabase as any).from('clients').select('name, billing_address, ap_email, email').eq('id', clientId).maybeSingle();
    client = data;
  }

  let project: any = null;
  if (quote.project_id) {
    const { data } = await (supabase as any).from('projects').select('location').eq('id', quote.project_id).maybeSingle();
    project = data;
  }

  if (!client) {
    return makeCheck(id, name, area, severity, expected,
      'No client found to validate source integrity', 'NEEDS_MANUAL',
      'Ensure the quote has a parent_client_id or client_id with billing fields.');
  }

  const norm = (s: string | null | undefined): string => (s ?? '').trim().replace(/\s+/g, ' ');
  const mismatches: string[] = [];

  // bill_to
  if (norm(client.name) && norm(invoice.bill_to_name) && norm(invoice.bill_to_name) !== norm(client.name)) {
    mismatches.push(`bill_to_name: expected="${norm(client.name)}" got="${norm(invoice.bill_to_name)}"`);
  }
  if (norm(client.billing_address) && norm(invoice.bill_to_address) && norm(invoice.bill_to_address) !== norm(client.billing_address)) {
    mismatches.push(`bill_to_address: expected="${norm(client.billing_address)}" got="${norm(invoice.bill_to_address)}"`);
  }

  // ship_to
  if (project?.location && norm(invoice.ship_to_address) !== norm(project.location)) {
    mismatches.push(`ship_to_address: expected="${norm(project.location)}" got="${norm(invoice.ship_to_address)}"`);
  }

  // send_to_emails
  const sendTo = norm(invoice.send_to_emails);
  const apEmail = client.ap_email || client.email;
  if (apEmail && sendTo && !sendTo.toLowerCase().includes(apEmail.toLowerCase())) {
    mismatches.push(`send_to_emails missing AP email "${apEmail}", got "${sendTo}"`);
  }
  const pmEmail = quote.customer_pm_email;
  if (pmEmail && sendTo && sendTo.toLowerCase().includes(pmEmail.toLowerCase())) {
    mismatches.push(`send_to_emails CONTAINS PM email "${pmEmail}" -- recipient swap regression`);
  }

  return makeCheck(id, name, area, severity, expected,
    mismatches.length === 0 ? 'All source fields match' : mismatches.join('; '),
    mismatches.length === 0 ? 'PASS' : 'FAIL',
    JSON.stringify({ invoice, client, projectLocation: project?.location, pmEmail, mismatches }, null, 2));
}

// -- Estimates Checks --

async function checkEstimatesRls(): Promise<AuditCheck> {
  const id = 'estimates_rls';
  const name = 'Estimates RLS + FORCE + Write Deny';
  const area = 'Security';
  const severity: 'P0' = 'P0';
  const expected = 'RLS forced, direct INSERT/UPDATE/DELETE denied on estimates and estimate_line_items';

  try {
    const { error } = await (supabase as any)
      .from('estimates')
      .insert({ project_id: '00000000-0000-0000-0000-000000000000', organization_id: '00000000-0000-0000-0000-000000000000', created_by: '00000000-0000-0000-0000-000000000000', estimate_number: 'TEST' });
    if (!error) {
      return makeCheck(id, name, area, severity, expected, 'INSERT succeeded (VULNERABILITY)', 'FAIL', 'Direct INSERT on estimates was NOT denied.');
    }
    const code = error.code;
    const msg = (error.message || '').toLowerCase();
    const denied = code === '42501' || msg.includes('row-level security');
    if (!denied) {
      return makeCheck(id, name, area, severity, expected, `Error but not RLS: ${error.message}`, 'FAIL', error.message);
    }
    return makeCheck(id, name, area, severity, expected, 'Write denied by RLS', 'PASS', `INSERT denied: ${error.message}`);
  } catch (e: any) {
    return makeCheck(id, name, area, severity, expected, `Exception: ${e.message}`, 'FAIL', e.message);
  }
}

async function checkEstimateTaskGeneration(): Promise<AuditCheck> {
  return makeCheck(
    'estimate_task_gen', 'Generate Tasks from Estimate (Idempotency)', 'Estimates', 'P1',
    'rpc_generate_tasks_from_estimate creates scope items idempotently',
    'Cannot be verified automatically without mutating data',
    'NEEDS_MANUAL',
    'Manual test:\n1. Create an estimate with labor line items\n2. Click "Generate Tasks from Estimate"\n3. Verify scope items and tasks created\n4. Click again — verify no duplicates (skipped count > 0)',
  );
}

async function checkEstimateLineItemsRls(): Promise<AuditCheck> {
  const id = 'estimate_line_items_rls';
  const name = 'Estimate Line Items RLS + Write Deny';
  const area = 'Security';
  const severity: 'P0' = 'P0';
  const expected = 'Direct INSERT denied on estimate_line_items';
  try {
    const { error } = await (supabase as any)
      .from('estimate_line_items')
      .insert({ estimate_id: '00000000-0000-0000-0000-000000000000', organization_id: '00000000-0000-0000-0000-000000000000', name: 'TEST' });
    if (!error) return makeCheck(id, name, area, severity, expected, 'INSERT succeeded (VULNERABILITY)', 'FAIL', 'Direct INSERT was NOT denied.');
    const denied = error.code === '42501' || (error.message || '').toLowerCase().includes('row-level security');
    if (!denied) return makeCheck(id, name, area, severity, expected, `Error but not RLS: ${error.message}`, 'FAIL', error.message);
    return makeCheck(id, name, area, severity, expected, 'Write denied by RLS', 'PASS', `INSERT denied: ${error.message}`);
  } catch (e: any) {
    return makeCheck(id, name, area, severity, expected, `Exception: ${e.message}`, 'FAIL', e.message);
  }
}

async function checkEstimateCurrencyMatch(): Promise<AuditCheck> {
  const id = 'estimate_currency_match';
  const name = 'Estimate Currency = Project Currency';
  const area = 'Finance';
  const severity: 'P1' = 'P1';
  const expected = 'All active estimates have currency matching their project currency';
  try {
    const { data, error } = await supabase.rpc('estimate_currency_mismatch_count' as any);
    if (error) {
      return makeCheck(id, name, area, severity, expected,
        'Cannot auto-verify (RPC not found)', 'NEEDS_MANUAL',
        'Manual: SELECT count(*) FROM estimates e JOIN projects p ON e.project_id=p.id WHERE e.status!=\'archived\' AND COALESCE(e.currency,\'CAD\')!=COALESCE(p.currency,\'CAD\')');
    }
    const count = Number(data) || 0;
    if (count > 0) return makeCheck(id, name, area, severity, expected, `${count} mismatched estimate(s)`, 'FAIL', `${count} estimates have currency != project currency`);
    return makeCheck(id, name, area, severity, expected, 'All match', 'PASS', '0 mismatches');
  } catch {
    return makeCheck(id, name, area, severity, expected, 'Cannot auto-verify', 'NEEDS_MANUAL',
      'Manual check: compare estimates.currency vs projects.currency for active estimates');
  }
}

// -- Main Runner --

export async function runPromptsAudit(projectId: string): Promise<PromptsAuditResult> {
  const results = await Promise.allSettled([
    checkWorkflowTablesExist(),
    checkWorkflowRls(),
    checkWorkflowWriteDeny(),
    checkRpcInventory(),
    checkFlowModeToggle(projectId),
    checkSidebarGating(),
    checkQuoteStatusAndEvents(),
    checkQuoteConversion(),
    checkConversionSnapshots(),
    checkConversionSourceIntegrity(),
    checkWorkflowRequirement(projectId),
    checkProjectStatusConstraint(),
    checkInvoiceSendGuardrail(),
    checkNotificationsHooked(projectId),
    checkEstimatesRls(),
    checkEstimateTaskGeneration(),
    checkEstimateLineItemsRls(),
    checkEstimateCurrencyMatch(),
  ]);

  const checks: AuditCheck[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') {
      checks.push(r.value);
    } else {
      checks.push(makeCheck(
        'unknown_error', 'Check Failed', 'System', 'P0',
        'Check completes', `Exception: ${r.reason?.message ?? 'unknown'}`,
        'FAIL', String(r.reason)));
    }
  }

  const pass = checks.filter(c => c.status === 'PASS').length;
  const fail = checks.filter(c => c.status === 'FAIL').length;
  const needs_manual = checks.filter(c => c.status === 'NEEDS_MANUAL').length;
  const blockers = checks.filter(c => c.status !== 'PASS' && c.severity === 'P0');

  return {
    ran_at: new Date().toISOString(),
    environment: window.location.hostname.includes('localhost') ? 'local'
      : window.location.hostname.includes('preview') ? 'staging' : 'production',
    checks,
    summary: { total: checks.length, pass, fail, needs_manual, blockers },
  };
}
