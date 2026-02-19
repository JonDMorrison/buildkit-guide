import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // ---------- Auth ----------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await admin.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    // ---------- Body ----------
    const { organizationId } = await req.json();
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

    // ---------- Guard: idempotency — delete prior seed if exists ----------
    const SEED_NAME = "Margin Stress Test Project";
    const { data: existing } = await admin
      .from("projects")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("name", SEED_NAME)
      .maybeSingle();

    if (existing) {
      console.log("Seed project already exists:", existing.id);
      return new Response(
        JSON.stringify({
          success: true,
          already_existed: true,
          project_id: existing.id,
          message: "Seed project already exists — returning existing id.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---------- 1. Project ----------
    const { data: project, error: projErr } = await admin
      .from("projects")
      .insert({
        name: SEED_NAME,
        status: "active",
        organization_id: organizationId,
        created_by: user.id,
        description:
          "Deterministic margin stress project — burn exceeds estimate to verify intervention flags.",
        job_number: "STRESS-001",
      })
      .select()
      .single();

    if (projErr) throw new Error(`Project insert: ${projErr.message}`);
    console.log("Created project:", project.id);

    // ---------- 2. Add user as project_manager with a known cost_rate ----------
    // cost_rate = 85.00 so 100 h × 85 = $8,500 actual labor cost
    const COST_RATE = 85.0;

    const { error: memberErr } = await admin
      .from("project_members")
      .insert({
        project_id: project.id,
        user_id: user.id,
        role: "project_manager",
        cost_rate: COST_RATE,
      });

    if (memberErr) console.warn("project_members insert:", memberErr.message);

    // ---------- 3. Estimate — contract_value 10 000, total cost 7 000 ----------
    const { data: estimate, error: estErr } = await admin
      .from("estimates")
      .insert({
        project_id: project.id,
        organization_id: organizationId,
        created_by: user.id,
        estimate_number: `EST-STRESS-${Date.now()}`,
        status: "approved",
        contract_value: 10000,
        planned_labor_bill_rate: 100,
        planned_labor_hours: 70,
        planned_labor_bill_amount: 7000,
        planned_material_cost: 0,
        planned_machine_cost: 0,
        planned_other_cost: 0,
        planned_total_cost: 7000,
        planned_profit: 3000,
        planned_margin_percent: 30,
        currency: "CAD",
        approved_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (estErr) throw new Error(`Estimate insert: ${estErr.message}`);
    console.log("Created estimate:", estimate.id);

    // ---------- 4. Time entries — 100 h @ $85/h = $8 500 actual labor ----------
    // Split into 10 × 10-hour entries spread over the past 10 days for realism.
    const now = new Date();
    const entries: object[] = [];

    for (let i = 0; i < 10; i++) {
      const checkIn = new Date(now);
      checkIn.setDate(checkIn.getDate() - (10 - i));
      checkIn.setHours(7, 0, 0, 0);

      const checkOut = new Date(checkIn);
      checkOut.setHours(17, 0, 0, 0); // 10-hour shift

      entries.push({
        project_id: project.id,
        organization_id: organizationId,
        user_id: user.id,
        check_in_at: checkIn.toISOString(),
        check_out_at: checkOut.toISOString(),
        duration_hours: 10,
        status: "closed",
        cost_rate: COST_RATE,
        currency: "CAD",
        notes: `Stress seed entry ${i + 1}/10`,
      });
    }

    const { error: teErr } = await admin.from("time_entries").insert(entries);
    if (teErr) throw new Error(`Time entries insert: ${teErr.message}`);

    console.log("Inserted 10 time entries (100 h total @ $85/h = $8 500)");

    return new Response(
      JSON.stringify({
        success: true,
        already_existed: false,
        project_id: project.id,
        estimate_id: estimate.id,
        time_entries_count: 10,
        total_labor_hours: 100,
        total_labor_cost: 8500,
        planned_total_cost: 7000,
        contract_value: 10000,
        message: "Margin stress project seeded — burn ($8 500) exceeds estimate ($7 000). Run Quick Probe to confirm flags.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Seed error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
