import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AiAssistRequest {
  project_id: string;
  user_message?: string;
  quick_action?: 'initial_summary' | 'blocked_tasks' | 'due_today' | 'safety_summary' | 'receipts_summary' | 'gc_deficiencies';
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  confirm_action?: {
    confirmation_id: string;
    entity_type: 'task' | 'deficiency' | 'project' | 'manpower_request';
    entity_data: Record<string, unknown>;
  };
}

interface ActionSuggestion {
  label: string;
  type: 'navigate' | 'prefill' | 'confirm';
  route?: string;
  prefill_type?: string;
  prefill_content?: string;
  entity_type?: string;
  entity_data?: Record<string, unknown>;
  confirmation_id?: string;
}

interface AiAssistResponse {
  answer: string;
  actions: ActionSuggestion[];
  pressing_issues?: {
    blocked_count: number;
    overdue_count: number;
    due_today_count: number;
    safety_incidents_count: number;
    unmapped_gc_count: number;
    pending_manpower_count: number;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: AiAssistRequest = await req.json();
    const { project_id, user_message, quick_action, messages: conversationMessages, confirm_action } = body;

    if (!project_id) {
      throw new Error('project_id is required');
    }

    console.log('AI Assist request:', { project_id, quick_action, has_message: !!user_message });

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Initialize Supabase client with user context
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    console.log('User authenticated:', user.id);

    // Check user role for this project
    const { data: membership } = await supabaseClient
      .from('project_members')
      .select('role, trade_id')
      .eq('user_id', user.id)
      .eq('project_id', project_id)
      .single();

    const { data: globalAdmin } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    const isAdmin = !!globalAdmin;
    const userRole = membership?.role || (isAdmin ? 'admin' : null);
    const userTradeId = membership?.trade_id;

    console.log('User role:', userRole, 'Trade:', userTradeId, 'Is Admin:', isAdmin);

    if (!isAdmin && !userRole) {
      throw new Error('No access to this project');
    }

    // Create service client for data fetching
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // ─── Handle confirmed entity creation ───────────────────────────────────
    if (confirm_action) {
      const { entity_type, entity_data } = confirm_action;

      // Need org context for some inserts — get it quickly
      const { data: proj } = await serviceClient
        .from('projects')
        .select('organization_id')
        .eq('id', project_id)
        .single();

      switch (entity_type) {
        case 'task': {
          const { error: taskErr } = await serviceClient.from('tasks').insert({
            project_id,
            title: entity_data.title,
            description: entity_data.description || null,
            due_date: entity_data.due_date || null,
            location: entity_data.location || null,
            priority: Number(entity_data.priority) || 1,
            status: 'not_started',
            created_by: user.id,
            is_deleted: false,
            is_generated: false,
            playbook_collapsed: false,
          });
          if (taskErr) throw new Error(`Failed to create task: ${taskErr.message}`);
          return new Response(JSON.stringify({
            answer: '✅ Task created! Head to the Tasks page to view and assign it.',
            actions: [{ type: 'navigate', label: 'View Tasks', route: '/tasks' }],
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        case 'deficiency': {
          const { error: defErr } = await serviceClient.from('deficiencies').insert({
            project_id,
            title: entity_data.title,
            description: entity_data.description || '',
            location: entity_data.location || null,
            due_date: entity_data.due_date || null,
            priority: Number(entity_data.priority) || 1,
            status: 'open',
            created_by: user.id,
            is_deleted: false,
          });
          if (defErr) throw new Error(`Failed to log deficiency: ${defErr.message}`);
          return new Response(JSON.stringify({
            answer: '✅ Deficiency logged successfully.',
            actions: [{ type: 'navigate', label: 'View Deficiencies', route: '/deficiencies' }],
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        case 'project': {
          const { error: projErr } = await serviceClient.from('projects').insert({
            name: entity_data.name,
            location: entity_data.location || '',
            organization_id: proj?.organization_id,
            status: 'active',
            start_date: entity_data.start_date || null,
            end_date: entity_data.end_date || null,
            job_type: entity_data.job_type || null,
            created_by: user.id,
            is_deleted: false,
            currency: 'CAD',
          });
          if (projErr) throw new Error(`Failed to create project: ${projErr.message}`);
          return new Response(JSON.stringify({
            answer: `✅ Project "${entity_data.name}" created!`,
            actions: [],
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        case 'manpower_request': {
          // Look up trade by trade_type or name match
          const { data: tradeMatch } = await serviceClient
            .from('trades')
            .select('id, name')
            .eq('organization_id', proj?.organization_id)
            .eq('is_active', true)
            .ilike('trade_type', `%${entity_data.trade_name}%`)
            .limit(1)
            .maybeSingle();

          if (!tradeMatch) {
            return new Response(JSON.stringify({
              answer: `⚠️ Couldn't find a trade matching "${entity_data.trade_name}". Please go to the Manpower page to submit manually.`,
              actions: [{ type: 'navigate', label: 'Open Manpower', route: '/manpower' }],
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }

          const { error: mpErr } = await serviceClient.from('manpower_requests').insert({
            project_id,
            trade_id: tradeMatch.id,
            requested_count: Number(entity_data.requested_count),
            required_date: entity_data.required_date,
            reason: entity_data.reason,
            duration_days: entity_data.duration_days ? Number(entity_data.duration_days) : null,
            status: 'pending',
            created_by: user.id,
            is_deleted: false,
          });
          if (mpErr) throw new Error(`Failed to create manpower request: ${mpErr.message}`);
          return new Response(JSON.stringify({
            answer: `✅ Manpower request submitted for ${tradeMatch.name}!`,
            actions: [{ type: 'navigate', label: 'View Manpower', route: '/manpower' }],
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        default:
          throw new Error(`Unknown entity type: ${entity_type}`);
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    // Get project info (comprehensive)
    const { data: project } = await serviceClient
      .from('projects')
      .select('name, job_number, status, job_type, start_date, end_date, address, city, province, postal_code, budget, contract_value, organization_id, client_id, clients(name, contact_name, email, phone)')
      .eq('id', project_id)
      .single();

    const projectName = project?.name || 'Unknown Project';
    const jobNumber = project?.job_number;

    // Role-based data filtering
    const canSeeAll = isAdmin || userRole === 'project_manager' || userRole === 'foreman';
    const isWorker = userRole === 'internal_worker' || userRole === 'external_trade';

    // Calculate dates
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekAhead = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Fetch comprehensive context
    let tasks: any[] = [];
    let blockers: any[] = [];
    let safetyForms: any[] = [];
    let deficiencies: any[] = [];
    let manpowerRequests: any[] = [];
    let receipts: any[] = [];
    let gcImports: any[] = [];
    let dailyLogs: any[] = [];
    let estimates: any[] = [];
    let changeOrders: any[] = [];
    let timeEntries: any[] = [];
    let projectMembers: any[] = [];
    let trades: any[] = [];
    let comments: any[] = [];
    let taskComments: any[] = [];
    let attachments: any[] = [];

    // Base task query for project
    let taskQuery = serviceClient
      .from('tasks')
      .select(`
        id, title, description, status, priority, due_date, start_date, end_date, 
        location, assigned_trade_id, created_at,
        trades(name),
        task_assignments(user_id, profiles(full_name))
      `)
      .eq('project_id', project_id)
      .eq('is_deleted', false);

    // Filter based on role
    if (isWorker && userRole === 'external_trade' && userTradeId) {
      taskQuery = taskQuery.eq('assigned_trade_id', userTradeId);
    }

    const { data: tasksData } = await taskQuery.order('due_date', { ascending: true });
    tasks = tasksData || [];

    // For workers, filter to only their assigned tasks
    if (isWorker && userRole === 'internal_worker') {
      const { data: assignments } = await serviceClient
        .from('task_assignments')
        .select('task_id')
        .eq('user_id', user.id);
      const assignedTaskIds = (assignments || []).map(a => a.task_id);
      tasks = tasks.filter(t => assignedTaskIds.includes(t.id));
    }

    // Get blockers for these tasks
    const taskIds = tasks.map(t => t.id);
    if (taskIds.length > 0) {
      const { data: blockersData } = await serviceClient
        .from('blockers')
        .select(`
          id, reason, description, is_resolved, created_at,
          task_id, tasks(title, trades(name)),
          blocking_trade_id, trades:blocking_trade_id(name)
        `)
        .in('task_id', taskIds)
        .eq('is_resolved', false);
      blockers = blockersData || [];
    }

    // PM/Foreman/Admin: Get all blockers for project
    if (canSeeAll) {
      const { data: allBlockers } = await serviceClient
        .from('blockers')
        .select(`
          id, reason, description, is_resolved, created_at,
          task_id, tasks!inner(title, project_id, trades(name)),
          blocking_trade_id
        `)
        .eq('tasks.project_id', project_id)
        .eq('is_resolved', false);
      blockers = allBlockers || [];
    }

    if (canSeeAll) {
      // Safety forms
      const { data: safetyData } = await serviceClient
        .from('safety_forms')
        .select('id, title, form_type, status, inspection_date, created_at')
        .eq('project_id', project_id)
        .eq('is_deleted', false)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false });
      safetyForms = safetyData || [];

      // Deficiencies
      const { data: defData } = await serviceClient
        .from('deficiencies')
        .select('id, title, description, status, priority, location, due_date, created_at, trades(name)')
        .eq('project_id', project_id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(50);
      deficiencies = defData || [];

      // Manpower requests
      const { data: manpowerData } = await serviceClient
        .from('manpower_requests')
        .select('id, requested_count, reason, required_date, status, trades(name)')
        .eq('project_id', project_id)
        .eq('is_deleted', false)
        .order('required_date', { ascending: true });
      manpowerRequests = manpowerData || [];

      // Daily logs (last 7 days)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { data: logsData } = await serviceClient
        .from('daily_logs')
        .select('log_date, work_performed, issues, safety_notes, next_day_plan, weather, crew_count')
        .eq('project_id', project_id)
        .gte('log_date', weekAgo.toISOString().split('T')[0])
        .order('log_date', { ascending: false })
        .limit(14);
      dailyLogs = logsData || [];

      // GC deficiency imports
      const { data: gcData } = await serviceClient
        .from('gc_deficiency_imports')
        .select(`
          id, source_name, status, total_rows, imported_rows, horizon_rows,
          gc_deficiency_items(id, belongs_to_horizon, mapped_deficiency_id, parsed_description)
        `)
        .eq('project_id', project_id)
        .order('created_at', { ascending: false })
        .limit(5);
      gcImports = gcData || [];

      // Estimates
      const { data: estData } = await serviceClient
        .from('estimates')
        .select('id, estimate_number, status, contract_value, planned_total_cost, planned_profit, planned_margin_percent, planned_labor_hours, currency, client_id, clients(name)')
        .eq('project_id', project_id)
        .order('created_at', { ascending: false })
        .limit(10);
      estimates = estData || [];

      // Change Orders
      const { data: coData } = await serviceClient
        .from('change_orders')
        .select('id, title, reason, amount, status, currency, created_at')
        .eq('project_id', project_id)
        .order('created_at', { ascending: false })
        .limit(20);
      changeOrders = coData || [];

      // Time Entries (last 14 days)
      const fourteenDaysAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
      const { data: teData } = await serviceClient
        .from('time_entries')
        .select('id, hours, work_date, status, profiles(full_name), tasks(title)')
        .eq('project_id', project_id)
        .gte('work_date', fourteenDaysAgo.toISOString().split('T')[0])
        .order('work_date', { ascending: false })
        .limit(100);
      timeEntries = teData || [];

      // Project Members
      const { data: pmData } = await serviceClient
        .from('project_members')
        .select('id, role, user_id, trade_id, profiles(full_name, email), trades(name)')
        .eq('project_id', project_id);
      projectMembers = pmData || [];

      // Trades for this project's org
      const { data: trData } = await serviceClient
        .from('trades')
        .select('id, name, company_name, trade_type, is_active')
        .eq('organization_id', project?.organization_id)
        .eq('is_active', true);
      trades = trData || [];

      // Recent Comments (last 14 days)
      const defIds = (deficiencies || []).map((d: any) => d.id);
      if (taskIds.length > 0 || defIds.length > 0) {
        const orParts: string[] = [];
        if (taskIds.length > 0) orParts.push(`task_id.in.(${taskIds.join(',')})`);
        if (defIds.length > 0) orParts.push(`deficiency_id.in.(${defIds.join(',')})`);
        const { data: cmtData } = await serviceClient
          .from('comments')
          .select('id, content, created_at, task_id, deficiency_id, profiles(full_name)')
          .or(orParts.join(','))
          .gte('created_at', fourteenDaysAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(30);
        comments = cmtData || [];
      }

      // Comments on active tasks (last 20 with task titles)
      const activeTaskIds = tasks.filter((t: any) => t.status !== 'done').map((t: any) => t.id);
      if (activeTaskIds.length > 0) {
        const { data: tcData } = await serviceClient
          .from('comments')
          .select('content, created_at, task_id, tasks(title)')
          .in('task_id', activeTaskIds)
          .order('created_at', { ascending: false })
          .limit(20);
        taskComments = tcData || [];
      }

      // Attachments/Documents
      const { data: attData } = await serviceClient
        .from('attachments')
        .select('id, file_name, document_type, description, created_at, task_id, deficiency_id')
        .eq('project_id', project_id)
        .order('created_at', { ascending: false })
        .limit(30);
      attachments = attData || [];
    }

    // Receipts (visible to most roles)
    if (canSeeAll || userRole === 'internal_worker') {
      let receiptQuery = serviceClient
        .from('receipts')
        .select('id, amount, currency, vendor, category, uploaded_at, review_status')
        .eq('project_id', project_id)
        .gte('uploaded_at', weekAgo.toISOString());

      if (isWorker) {
        receiptQuery = receiptQuery.eq('uploaded_by', user.id);
      }

      const { data: receiptData } = await receiptQuery.order('uploaded_at', { ascending: false });
      receipts = receiptData || [];
    }

    // Calculate pressing issues
    const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
    const oldBlockers = blockers.filter(b => new Date(b.created_at) < threeDaysAgo);
    const overdueTasks = tasks.filter(t => t.due_date && new Date(t.due_date) < today && t.status !== 'done');
    const dueTodayTasks = tasks.filter(t => t.due_date?.startsWith(todayStr) && t.status !== 'done');
    const incidentForms = safetyForms.filter(f => f.form_type === 'incident' && new Date(f.created_at) > weekAgo);
    const unmappedGcItems = gcImports.flatMap(imp => 
      (imp.gc_deficiency_items || []).filter((item: any) => item.belongs_to_horizon && !item.mapped_deficiency_id)
    );
    const pendingManpower = manpowerRequests.filter(r => r.status === 'pending');

    const pressingIssues = {
      blocked_count: blockers.length,
      old_blockers_count: oldBlockers.length,
      overdue_count: overdueTasks.length,
      due_today_count: dueTodayTasks.length,
      safety_incidents_count: incidentForms.length,
      unmapped_gc_count: unmappedGcItems.length,
      pending_manpower_count: pendingManpower.length,
    };

    console.log('Pressing issues:', pressingIssues);

    // Build context string
    let contextString = `## Project: ${projectName}${jobNumber ? ` (${jobNumber})` : ''}\n`;
    contextString += `## User Role: ${userRole}\n`;
    contextString += `## Today: ${todayStr}\n\n`;

    // Task summary
    const statusCounts = {
      not_started: tasks.filter(t => t.status === 'not_started').length,
      in_progress: tasks.filter(t => t.status === 'in_progress').length,
      blocked: tasks.filter(t => t.status === 'blocked').length,
      done: tasks.filter(t => t.status === 'done').length,
    };
    contextString += `## Task Summary:\n`;
    contextString += `- Total: ${tasks.length} tasks\n`;
    contextString += `- Not Started: ${statusCounts.not_started}\n`;
    contextString += `- In Progress: ${statusCounts.in_progress}\n`;
    contextString += `- Blocked: ${statusCounts.blocked}\n`;
    contextString += `- Done: ${statusCounts.done}\n`;
    contextString += `- Overdue: ${overdueTasks.length}\n`;
    contextString += `- Due Today: ${dueTodayTasks.length}\n\n`;

    // Detailed tasks
    if (tasks.length > 0) {
      contextString += `## Tasks (showing first 30):\n`;
      tasks.slice(0, 30).forEach(task => {
        const trade = task.trades?.name || 'Unassigned';
        const dueInfo = task.due_date ? `Due: ${task.due_date}` : 'No due date';
        const isOverdue = task.due_date && new Date(task.due_date) < today && task.status !== 'done';
        contextString += `- [${task.status}${isOverdue ? ' OVERDUE' : ''}] "${task.title}" (${trade}, ${dueInfo})\n`;
      });
      contextString += '\n';
    }

    // Blockers
    if (blockers.length > 0) {
      contextString += `## Active Blockers (${blockers.length}):\n`;
      blockers.forEach(blocker => {
        const taskTitle = blocker.tasks?.title || 'Unknown task';
        const trade = blocker.tasks?.trades?.name || 'Unknown';
        const age = Math.floor((today.getTime() - new Date(blocker.created_at).getTime()) / (1000 * 60 * 60 * 24));
        contextString += `- "${blocker.reason}" on "${taskTitle}" (${trade}, ${age} days old)\n`;
      });
      contextString += '\n';
    }

    // Safety
    if (safetyForms.length > 0) {
      contextString += `## Safety Forms (last 30 days):\n`;
      const byType = safetyForms.reduce((acc: any, f) => {
        acc[f.form_type] = (acc[f.form_type] || 0) + 1;
        return acc;
      }, {});
      Object.entries(byType).forEach(([type, count]) => {
        contextString += `- ${type}: ${count}\n`;
      });
      contextString += '\n';
    }

    // Deficiencies
    if (deficiencies.length > 0) {
      const openDef = deficiencies.filter(d => d.status === 'open' || d.status === 'in_progress');
      contextString += `## Deficiencies:\n`;
      contextString += `- Open/In Progress: ${openDef.length}\n`;
      openDef.slice(0, 10).forEach(def => {
        contextString += `  - [${def.status}] "${def.title}" (${def.trades?.name || 'Unassigned'})\n`;
      });
      contextString += '\n';
    }

    // Manpower
    if (manpowerRequests.length > 0) {
      contextString += `## Manpower Requests:\n`;
      manpowerRequests.slice(0, 10).forEach(req => {
        contextString += `- [${req.status}] ${req.requested_count} workers for ${req.trades?.name} (${req.required_date})\n`;
      });
      contextString += '\n';
    }

    // Receipts
    if (receipts.length > 0) {
      const totalAmount = receipts.reduce((sum, r) => sum + (r.amount || 0), 0);
      contextString += `## Receipts (last 7 days):\n`;
      contextString += `- Count: ${receipts.length}\n`;
      contextString += `- Total: $${totalAmount.toFixed(2)}\n\n`;
    }

    // GC Deficiencies
    if (gcImports.length > 0) {
      contextString += `## GC Deficiency Imports:\n`;
      gcImports.forEach(imp => {
        const unmapped = (imp.gc_deficiency_items || []).filter((i: any) => i.belongs_to_horizon && !i.mapped_deficiency_id).length;
        contextString += `- ${imp.source_name}: ${imp.horizon_rows || 0} Horizon items, ${unmapped} unmapped\n`;
      });
      contextString += '\n';
    }

    // Daily Log History (last 7 days)
    if (dailyLogs.length > 0) {
      contextString += `## Daily Log History (last 7 days):\n`;
      dailyLogs.forEach(log => {
        contextString += `- ${log.log_date}: Crew ${log.crew_count || 0}, Weather: ${log.weather || 'Not recorded'}\n`;
        if (log.work_performed) contextString += `  Work: ${log.work_performed}\n`;
        if (log.issues) contextString += `  Issues: ${log.issues}\n`;
        if (log.safety_notes) contextString += `  Safety: ${log.safety_notes}\n`;
        if (log.next_day_plan) contextString += `  Next Day Plan: ${log.next_day_plan}\n`;
      });
      contextString += '\n';
    }

    // Recent Task Comments
    if (taskComments.length > 0) {
      contextString += `## Recent Task Comments:\n`;
      taskComments.forEach((cmt: any) => {
        const taskTitle = (Array.isArray(cmt.tasks) && cmt.tasks[0] ? cmt.tasks[0].title : cmt.tasks?.title) || 'Unknown task';
        contextString += `- [${taskTitle}] ${cmt.created_at}: "${(cmt.content || '').substring(0, 150)}"\n`;
      });
      contextString += '\n';
    }

    // Project details
    if (project) {
      contextString += `## Project Details:\n`;
      contextString += `- Status: ${project.status}\n`;
      if (project.job_type) contextString += `- Job Type: ${project.job_type}\n`;
      if (project.start_date) contextString += `- Start Date: ${project.start_date}\n`;
      if (project.end_date) contextString += `- End Date: ${project.end_date}\n`;
      if (project.address) contextString += `- Address: ${project.address}, ${project.city || ''} ${project.province || ''}\n`;
      if (project.budget) contextString += `- Budget: $${Number(project.budget).toLocaleString()}\n`;
      if (project.contract_value) contextString += `- Contract Value: $${Number(project.contract_value).toLocaleString()}\n`;
      if (project.clients?.name) contextString += `- Client: ${project.clients.name} (Contact: ${project.clients.contact_name || 'N/A'})\n`;
      contextString += '\n';
    }

    // Estimates / Financials
    if (estimates.length > 0) {
      contextString += `## Estimates:\n`;
      estimates.forEach(est => {
        contextString += `- ${est.estimate_number} [${est.status}]: Contract $${Number(est.contract_value).toLocaleString()}, Cost $${Number(est.planned_total_cost).toLocaleString()}, Margin ${est.planned_margin_percent}%, Labor ${est.planned_labor_hours}h\n`;
      });
      contextString += '\n';
    }

    // Change Orders
    if (changeOrders.length > 0) {
      const approvedCOs = changeOrders.filter(co => co.status === 'approved');
      const pendingCOs = changeOrders.filter(co => co.status === 'pending' || co.status === 'draft');
      const totalApproved = approvedCOs.reduce((s, co) => s + Number(co.amount || 0), 0);
      contextString += `## Change Orders (${changeOrders.length} total):\n`;
      contextString += `- Approved: ${approvedCOs.length} ($${totalApproved.toLocaleString()})\n`;
      contextString += `- Pending/Draft: ${pendingCOs.length}\n`;
      changeOrders.slice(0, 10).forEach(co => {
        contextString += `  - [${co.status}] "${co.title}" $${Number(co.amount).toLocaleString()} - ${co.reason || 'No reason'}\n`;
      });
      contextString += '\n';
    }

    // Time Entries
    if (timeEntries.length > 0) {
      const totalHours = timeEntries.reduce((s, te) => s + Number(te.hours || 0), 0);
      const uniqueWorkers = new Set(timeEntries.map(te => te.profiles?.full_name).filter(Boolean));
      contextString += `## Time Entries (last 14 days):\n`;
      contextString += `- Total Hours: ${totalHours.toFixed(1)}h\n`;
      contextString += `- Workers: ${uniqueWorkers.size}\n`;
      // Group by date
      const byDate: Record<string, number> = {};
      timeEntries.forEach(te => {
        byDate[te.work_date] = (byDate[te.work_date] || 0) + Number(te.hours || 0);
      });
      Object.entries(byDate).slice(0, 7).forEach(([date, hrs]) => {
        contextString += `  - ${date}: ${(hrs as number).toFixed(1)}h\n`;
      });
      contextString += '\n';
    }

    // Project Team
    if (projectMembers.length > 0) {
      contextString += `## Project Team (${projectMembers.length} members):\n`;
      projectMembers.forEach(pm => {
        contextString += `- ${pm.profiles?.full_name || 'Unknown'} (${pm.role}${pm.trades?.name ? ', ' + pm.trades.name : ''})\n`;
      });
      contextString += '\n';
    }

    // Trades
    if (trades.length > 0) {
      contextString += `## Active Trades (${trades.length}):\n`;
      trades.forEach(tr => {
        contextString += `- ${tr.name} (${tr.company_name || 'N/A'}, ${tr.trade_type})\n`;
      });
      contextString += '\n';
    }

    // Recent Comments
    if (comments.length > 0) {
      contextString += `## Recent Comments (last 14 days):\n`;
      comments.slice(0, 15).forEach(cmt => {
        contextString += `- ${cmt.profiles?.full_name || 'Unknown'}: "${cmt.content.substring(0, 100)}"\n`;
      });
      contextString += '\n';
    }

    // Attachments/Documents
    if (attachments.length > 0) {
      contextString += `## Recent Documents/Attachments (${attachments.length}):\n`;
      attachments.slice(0, 15).forEach(att => {
        contextString += `- ${att.file_name}${att.document_type ? ' (' + att.document_type + ')' : ''}${att.description ? ': ' + att.description.substring(0, 80) : ''}\n`;
      });
      contextString += '\n';
    }

    // Build the AI prompt
    let userPrompt = '';
    
    if (quick_action === 'initial_summary') {
      userPrompt = `Give me a brief summary of the current project status including:
1. Any pressing issues or risks (overdue tasks, old blockers, safety incidents)
2. What needs attention today
3. Overall project health assessment
Keep it concise and actionable for a field team.`;
    } else if (quick_action === 'blocked_tasks') {
      userPrompt = 'List all blocked tasks, what is blocking them, and which trades are affected. Suggest actions to resolve.';
    } else if (quick_action === 'due_today') {
      userPrompt = 'What tasks are due today and what is their current status? Prioritize by importance.';
    } else if (quick_action === 'safety_summary') {
      userPrompt = 'Summarize safety form submissions in the last 30 days. Highlight any incidents or recurring issues.';
    } else if (quick_action === 'receipts_summary') {
      userPrompt = 'Summarize receipt submissions for this week. Show totals by category.';
    } else if (quick_action === 'gc_deficiencies') {
      userPrompt = 'What deficiencies from the GC list are assigned to Horizon and still need to be addressed?';
    } else if (user_message) {
      userPrompt = user_message;
    } else {
      userPrompt = 'What should I know about this project right now?';
    }

    // Role-specific context
    const roleContext = isWorker 
      ? '\n\nIMPORTANT: The user is a field worker with limited access. Focus only on their assigned tasks and immediate concerns.'
      : userRole === 'foreman'
      ? '\n\nThe user is a Foreman. Focus on crew tasks, blockers affecting their trades, safety, and daily planning.'
      : '\n\nThe user is a Project Manager or Admin. Provide full project visibility including risks, coordination needs, and GC items.';

    const systemPrompt = `You are an AI assistant for a construction project coordination app called Project Path. You have comprehensive knowledge of the project including tasks, blockers, safety forms, deficiencies, manpower requests, receipts, estimates/financials, change orders, time entries, team members, trades, comments, documents, and daily logs.

Rules:
- Answer based ONLY on the provided project data
- Be concise, clear, and actionable
- Use specific names, dates, and numbers from the data
- If information is not available, say so
- Never make up project data
- Format responses using markdown (bold, bullet lists, headings where appropriate) for readability
- When suggesting actions, be specific about what to do
- You can answer questions about financials, team composition, labor hours, change orders, and any other aspect of the project

For your response, structure it as JSON with this format:
{
  "answer": "Your text response here with markdown formatting",
  "actions": [
    {
      "label": "Button text",
      "type": "navigate",
      "route": "/tasks?status=blocked"
    }
  ]
}

The actions array should contain relevant navigation suggestions based on the context. Valid action types:
- navigate: Opens a route in the app
- prefill: Opens a form with pre-filled content (use prefill_type and prefill_content)

Available routes:
- /tasks (query params: status=blocked, status=in_progress, taskId=<id>)
- /lookahead
- /deficiencies (query params: id=<id>)
- /safety (query params: formId=<id>)
- /manpower
- /receipts
- /daily-logs
- /projects/<project_id>/deficiency-import

${roleContext}`;

    // Tool definitions for entity creation
    const createTools = [
      {
        type: 'function',
        function: {
          name: 'create_task',
          description: 'Create a new task for the project. Only call this when the user explicitly wants to add a task and has provided enough details (at minimum a title).',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Task title' },
              description: { type: 'string', description: 'Task description or details' },
              due_date: { type: 'string', description: 'Due date in YYYY-MM-DD format' },
              location: { type: 'string', description: 'Location or area for the task' },
              priority: { type: 'number', description: 'Priority 1 (low) to 3 (high), default 1' },
            },
            required: ['title'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'log_deficiency',
          description: 'Log a deficiency for the project. Only call this when the user explicitly wants to log/record a deficiency and has provided enough details.',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Short deficiency title' },
              description: { type: 'string', description: 'Detailed description of the deficiency' },
              location: { type: 'string', description: 'Location or area where deficiency exists' },
              due_date: { type: 'string', description: 'Due date for resolution in YYYY-MM-DD format' },
              priority: { type: 'number', description: 'Priority 1 (low) to 3 (high), default 1' },
            },
            required: ['title', 'description'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'create_project',
          description: 'Create a new project. Only call this when the user explicitly wants to start/create a new project and has provided name and location.',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Project name' },
              location: { type: 'string', description: 'Project location or address' },
              start_date: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
              end_date: { type: 'string', description: 'End date in YYYY-MM-DD format' },
              job_type: { type: 'string', description: 'Type of job (e.g. renovation, new build)' },
            },
            required: ['name', 'location'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'request_manpower',
          description: 'Submit a manpower request. Only call this when the user explicitly wants to request workers and has provided the trade type, count, and required date.',
          parameters: {
            type: 'object',
            properties: {
              trade_name: { type: 'string', description: 'Type of trade needed (e.g. Electrician, Plumber, Framer)' },
              requested_count: { type: 'number', description: 'Number of workers needed' },
              required_date: { type: 'string', description: 'Date workers are needed in YYYY-MM-DD format' },
              reason: { type: 'string', description: 'Reason for the manpower request' },
              duration_days: { type: 'number', description: 'Number of days workers are needed' },
            },
            required: ['trade_name', 'requested_count', 'required_date', 'reason'],
          },
        },
      },
    ];

    // Build OpenAI messages — use conversation history when available
    const hasHistory = conversationMessages && conversationMessages.length > 0;
    const openaiMessages: Array<{ role: string; content: string }> = hasHistory
      ? conversationMessages.map(m => ({ role: m.role, content: m.content }))
      : [{ role: 'user', content: `Context:\n${contextString}\n\nQuestion: ${userPrompt}` }];

    const systemContent = hasHistory
      ? `${systemPrompt}\n\nProject Context:\n${contextString}`
      : systemPrompt;

    console.log('Calling OpenAI...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemContent },
          ...openaiMessages,
        ],
        tools: createTools,
        tool_choice: 'auto',
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limits exceeded, please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('OpenAI error:', response.status, errorText);
      throw new Error(`AI error: ${errorText}`);
    }

    const result = await response.json();
    const choice = result.choices?.[0];

    // Handle tool call — AI wants to create an entity
    if (choice?.finish_reason === 'tool_calls') {
      const toolCall = choice.message?.tool_calls?.[0];
      if (toolCall) {
        const toolName = toolCall.function.name;
        let toolArgs: Record<string, unknown> = {};
        try {
          toolArgs = JSON.parse(toolCall.function.arguments);
        } catch {
          throw new Error('Failed to parse tool arguments from AI');
        }

        const entityTypeMap: Record<string, string> = {
          create_task: 'task',
          log_deficiency: 'deficiency',
          create_project: 'project',
          request_manpower: 'manpower_request',
        };
        const entityType = entityTypeMap[toolName] || toolName;
        const confirmationId = crypto.randomUUID();

        console.log('AI called tool:', toolName, toolArgs);

        return new Response(JSON.stringify({
          answer: "Here's what I'll create — please review and confirm:",
          actions: [{
            type: 'confirm',
            label: 'Confirm & Create',
            entity_type: entityType,
            entity_data: toolArgs,
            confirmation_id: confirmationId,
          }],
          pressing_issues: pressingIssues,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const rawAnswer = choice?.message?.content || '';

    console.log('Raw AI response:', rawAnswer.substring(0, 200));

    // Parse the AI response
    let answer = rawAnswer;
    let actions: ActionSuggestion[] = [];

    try {
      // Try to extract JSON from the response
      const jsonMatch = rawAnswer.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        answer = parsed.answer || rawAnswer;
        actions = parsed.actions || [];
      }
    } catch (e) {
      console.log('Could not parse JSON from response, using raw text');
      // Add default actions based on context
      if (blockers.length > 0) {
        actions.push({ label: 'View blocked tasks', type: 'navigate', route: '/tasks?status=blocked' });
      }
      if (overdueTasks.length > 0) {
        actions.push({ label: 'View overdue tasks', type: 'navigate', route: '/tasks' });
      }
    }

    // Build response
    const aiResponse: AiAssistResponse = {
      answer,
      actions,
      pressing_issues: pressingIssues,
    };

    console.log('AI Assist response generated');

    return new Response(
      JSON.stringify(aiResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('AI Assist error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
