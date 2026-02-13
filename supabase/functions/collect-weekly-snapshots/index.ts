import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate cron secret
  const cronSecret = req.headers.get("X-Cron-Secret");
  const expectedSecret = Deno.env.get("TIME_CRON_SECRET");

  if (!expectedSecret) {
    console.error("TIME_CRON_SECRET not configured");
    return new Response(
      JSON.stringify({ error: "Cron secret not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!cronSecret || cronSecret !== expectedSecret) {
    console.warn("Invalid or missing X-Cron-Secret header");
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const runStartedAt = new Date().toISOString();
  const snapshotDate = runStartedAt.split("T")[0]; // YYYY-MM-DD
  const results: Array<{ org_id: string; org_name: string; success: boolean; projects_count: number; error?: string }> = [];

  try {
    // Find all orgs with at least 1 active (non-deleted) project
    const { data: orgs, error: orgError } = await supabase
      .from("projects")
      .select("organization_id, organizations!inner(id, name)")
      .eq("is_deleted", false)
      .order("organization_id");

    if (orgError) {
      console.error("Error fetching orgs:", orgError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch organizations", details: orgError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deduplicate org IDs
    const orgMap = new Map<string, string>();
    for (const row of orgs || []) {
      const orgData = row.organizations as any;
      if (orgData?.id && !orgMap.has(orgData.id)) {
        orgMap.set(orgData.id, orgData.name || "Unknown");
      }
    }

    console.log(`Found ${orgMap.size} organizations with active projects`);

    // Process each org
    for (const [orgId, orgName] of orgMap) {
      try {
        // Call the RPC as service role — SECURITY DEFINER functions
        // need auth.uid(), so we call via raw SQL with service role
        const { data, error } = await supabase.rpc(
          "generate_weekly_snapshots_for_org",
          { p_org_id: orgId, p_snapshot_date: snapshotDate }
        );

        if (error) {
          console.error(`Snapshot error for org ${orgId} (${orgName}):`, error);
          
          // Log failure
          await supabase.from("snapshots_run_log").insert({
            organization_id: orgId,
            snapshot_date: snapshotDate,
            projects_count: 0,
            success: false,
            error: error.message,
            started_at: runStartedAt,
            finished_at: new Date().toISOString(),
          });

          results.push({ org_id: orgId, org_name: orgName, success: false, projects_count: 0, error: error.message });
        } else {
          const projectsCount = data?.projects_snapshotted ?? 0;
          console.log(`Snapshots generated for org ${orgId} (${orgName}): ${projectsCount} projects`);

          // Log success
          await supabase.from("snapshots_run_log").insert({
            organization_id: orgId,
            snapshot_date: snapshotDate,
            projects_count: projectsCount,
            success: true,
            error: null,
            started_at: runStartedAt,
            finished_at: new Date().toISOString(),
          });

          results.push({ org_id: orgId, org_name: orgName, success: true, projects_count: projectsCount });
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`Unexpected error for org ${orgId}:`, errorMsg);

        await supabase.from("snapshots_run_log").insert({
          organization_id: orgId,
          snapshot_date: snapshotDate,
          projects_count: 0,
          success: false,
          error: errorMsg,
          started_at: runStartedAt,
          finished_at: new Date().toISOString(),
        });

        results.push({ org_id: orgId, org_name: orgName, success: false, projects_count: 0, error: errorMsg });
      }
    }

    const summary = {
      snapshot_date: snapshotDate,
      orgs_processed: results.length,
      orgs_succeeded: results.filter((r) => r.success).length,
      orgs_failed: results.filter((r) => !r.success).length,
      total_projects: results.reduce((sum, r) => sum + r.projects_count, 0),
      details: results,
    };

    console.log("Weekly snapshot collection complete:", JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Fatal error in collect-weekly-snapshots:", errorMsg);
    return new Response(
      JSON.stringify({ error: "Fatal error", details: errorMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
