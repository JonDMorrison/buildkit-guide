import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const QA_PREFIX = "[QA-SEED]";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // ── Auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !user) throw new Error("Unauthorized");

    // ── Body ──
    const { organizationId, action } = await req.json();
    if (!organizationId) throw new Error("organizationId is required");

    // Verify membership
    const { data: membership } = await admin
      .from("organization_memberships")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();
    if (!membership) throw new Error("Not a member of this organization");

    // ── RESET action ──
    if (action === "reset") {
      // Delete seeded project (cascades tasks, etc. via FK)
      const { data: existing } = await admin
        .from("projects")
        .select("id")
        .eq("organization_id", organizationId)
        .ilike("name", `${QA_PREFIX}%`);

      let deletedCount = 0;
      for (const p of (existing || [])) {
        // Delete task_assignments for tasks in this project
        const { data: taskIds } = await admin
          .from("tasks")
          .select("id")
          .eq("project_id", p.id);
        if (taskIds && taskIds.length > 0) {
          await admin.from("task_assignments").delete().in("task_id", taskIds.map(t => t.id));
        }
        // Delete manpower requests
        await admin.from("manpower_requests").delete().eq("project_id", p.id);
        // Delete daily logs
        await admin.from("daily_logs").delete().eq("project_id", p.id);
        // Delete deficiencies
        await admin.from("deficiencies").delete().eq("project_id", p.id);
        // Delete tasks
        await admin.from("tasks").delete().eq("project_id", p.id);
        // Delete project members
        await admin.from("project_members").delete().eq("project_id", p.id);
        // Delete project
        await admin.from("projects").delete().eq("id", p.id);
        deletedCount++;
      }

      return new Response(
        JSON.stringify({ success: true, action: "reset", deleted_projects: deletedCount }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── SEED action (default) ──

    // Idempotency: check for existing seed project
    const SEED_PROJECT_NAME = `${QA_PREFIX} Smart Memory Test`;
    const { data: existing } = await admin
      .from("projects")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("name", SEED_PROJECT_NAME)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ success: true, already_existed: true, project_id: existing.id, message: "QA seed project already exists." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Get or create trades for the org
    const tradeNames = [`${QA_PREFIX} Electrical`, `${QA_PREFIX} Plumbing`, `${QA_PREFIX} Framing`, `${QA_PREFIX} HVAC`];
    const tradeIds: string[] = [];
    for (const name of tradeNames) {
      const { data: existingTrade } = await admin
        .from("trades")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("name", name)
        .maybeSingle();
      if (existingTrade) {
        tradeIds.push(existingTrade.id);
      } else {
        const { data: newTrade, error: tradeErr } = await admin
          .from("trades")
          .insert({ name, organization_id: organizationId, is_active: true, company_name: name })
          .select("id")
          .single();
        if (tradeErr) throw new Error(`Trade insert: ${tradeErr.message}`);
        tradeIds.push(newTrade.id);
      }
    }

    // 2. Create project
    const { data: project, error: projErr } = await admin
      .from("projects")
      .insert({
        name: SEED_PROJECT_NAME,
        status: "in_progress",
        organization_id: organizationId,
        created_by: user.id,
        location: `${QA_PREFIX} 123 Test St, Vancouver`,
        description: "Disposable QA project for Smart Memory validation.",
        job_number: "QA-SM-001",
      })
      .select("id")
      .single();
    if (projErr) throw new Error(`Project insert: ${projErr.message}`);

    // 3. Add user as project member
    await admin.from("project_members").insert({
      project_id: project.id,
      user_id: user.id,
      role: "project_manager",
    });

    // 4. Create tasks with trade assignments and locations
    const locations = [`${QA_PREFIX} Floor 2 West`, `${QA_PREFIX} Basement B1`, `${QA_PREFIX} Roof Level`];
    const taskInserts = [];
    for (let i = 0; i < 6; i++) {
      taskInserts.push({
        title: `${QA_PREFIX} Task ${i + 1}`,
        project_id: project.id,
        assigned_trade_id: tradeIds[i % tradeIds.length],
        location: locations[i % locations.length],
        status: "in_progress",
        created_by: user.id,
        is_deleted: false,
      });
    }
    const { data: tasks, error: taskErr } = await admin
      .from("tasks")
      .insert(taskInserts)
      .select("id");
    if (taskErr) throw new Error(`Tasks insert: ${taskErr.message}`);

    // 5. Create task_assignments (assign current user to tasks for worker chip suggestions)
    const assignInserts = (tasks || []).map((t) => ({
      task_id: t.id,
      user_id: user.id,
      assigned_at: new Date().toISOString(),
    }));
    if (assignInserts.length > 0) {
      const { error: assignErr } = await admin.from("task_assignments").insert(assignInserts);
      if (assignErr) console.warn("task_assignments insert:", assignErr.message);
    }

    // 6. Create deficiencies with trade + location
    const defInserts = [
      {
        title: `${QA_PREFIX} Missing fire stop`,
        description: "QA seed deficiency",
        project_id: project.id,
        assigned_trade_id: tradeIds[0],
        location: locations[0],
        created_by: user.id,
        priority: 2,
      },
      {
        title: `${QA_PREFIX} Drywall crack`,
        description: "QA seed deficiency",
        project_id: project.id,
        assigned_trade_id: tradeIds[1],
        location: locations[1],
        created_by: user.id,
        priority: 1,
      },
    ];
    const { error: defErr } = await admin.from("deficiencies").insert(defInserts);
    if (defErr) console.warn("deficiencies insert:", defErr.message);

    // 7. Create manpower requests
    const mpInserts = [
      { project_id: project.id, trade_id: tradeIds[0], requested_count: 4, status: "pending", requested_by: user.id, date_needed: new Date().toISOString().split("T")[0] },
      { project_id: project.id, trade_id: tradeIds[2], requested_count: 6, status: "pending", requested_by: user.id, date_needed: new Date().toISOString().split("T")[0] },
    ];
    const { error: mpErr } = await admin.from("manpower_requests").insert(mpInserts);
    if (mpErr) console.warn("manpower_requests insert:", mpErr.message);

    // 8. Create daily logs with crew count + weather
    const dlInserts = [
      {
        project_id: project.id,
        created_by: user.id,
        log_date: new Date().toISOString().split("T")[0],
        work_performed: `${QA_PREFIX} Foundation pour complete`,
        crew_count: 12,
        weather: "Sunny",
      },
    ];
    const { error: dlErr } = await admin.from("daily_logs").insert(dlInserts);
    if (dlErr) console.warn("daily_logs insert:", dlErr.message);

    return new Response(
      JSON.stringify({
        success: true,
        already_existed: false,
        project_id: project.id,
        trades_created: tradeIds.length,
        tasks_created: tasks?.length ?? 0,
        message: `QA seed complete. Project: ${project.id}. Navigate to /tasks?projectId=${project.id} to verify Smart Memory chips.`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("seed-qa-smart-memory error:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
