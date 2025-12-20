import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BackfillParams {
  project_id?: string;
  limit?: number;
  dry_run?: boolean;
}

interface BackfillResult {
  total_scanned: number;
  total_updated: number;
  total_failed: number;
  dry_run: boolean;
  sample_updates: Array<{ id: string; hash_prefix: string }>;
  errors: Array<{ id: string; error: string }>;
}

/**
 * Generate SHA-256 hash using Web Crypto API (Deno)
 * Uses the SAME normalized snapshot logic as client-side generateRecordHash
 */
async function computeRecordHash(data: {
  formId: string;
  projectId: string;
  formType: string;
  createdBy: string;
  inspectionDate: string;
  createdAt: string; // Use form's created_at for determinism
  entries: Array<{ field_name: string; field_value: string | null }>;
  attendees: Array<{ user_id: string; is_foreman: boolean }>;
}): Promise<string> {
  // Build canonical representation - MUST match client-side logic
  const canonical = JSON.stringify({
    formId: data.formId,
    projectId: data.projectId,
    formType: data.formType,
    createdBy: data.createdBy,
    inspectionDate: data.inspectionDate,
    entries: data.entries
      .map((e) => `${e.field_name}:${e.field_value || ""}`)
      .sort()
      .join("|"),
    attendees: data.attendees
      .map((a) => `${a.user_id}:${a.is_foreman}`)
      .sort()
      .join("|"),
    // Use form's created_at timestamp (truncated to seconds) for determinism
    timestamp: data.createdAt.substring(0, 19),
  });

  // Compute SHA-256
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(canonical);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  
  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  
  return hashHex;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user's auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is admin
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: adminCheck } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .single();

    if (!adminCheck) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse parameters
    const params: BackfillParams = await req.json().catch(() => ({}));
    const projectId = params.project_id || null;
    const limit = Math.min(params.limit || 200, 500); // Cap at 500
    const dryRun = params.dry_run !== false; // Default true

    console.log(`[Backfill] Starting: dry_run=${dryRun}, limit=${limit}, project_id=${projectId}`);

    // Use service role for actual updates (bypasses RLS)
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Query forms missing record_hash
    let query = supabaseAdmin
      .from("safety_forms")
      .select("id, project_id, form_type, created_by, inspection_date, created_at, status")
      .is("record_hash", null)
      .in("status", ["submitted", "reviewed"])
      .eq("is_deleted", false)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (projectId) {
      query = query.eq("project_id", projectId);
    }

    const { data: forms, error: formsError } = await query;

    if (formsError) {
      console.error("[Backfill] Query error:", formsError);
      throw new Error(`Failed to query forms: ${formsError.message}`);
    }

    const result: BackfillResult = {
      total_scanned: forms?.length || 0,
      total_updated: 0,
      total_failed: 0,
      dry_run: dryRun,
      sample_updates: [],
      errors: [],
    };

    console.log(`[Backfill] Found ${result.total_scanned} forms to process`);

    // Process each form
    for (const form of forms || []) {
      try {
        // Fetch entries for this form (deterministic order)
        const { data: entries, error: entriesError } = await supabaseAdmin
          .from("safety_entries")
          .select("field_name, field_value, created_at, id")
          .eq("safety_form_id", form.id)
          .order("field_name", { ascending: true })
          .order("created_at", { ascending: true })
          .order("id", { ascending: true });

        if (entriesError) {
          throw new Error(`Failed to fetch entries: ${entriesError.message}`);
        }

        // Fetch attendees for this form (deterministic order)
        const { data: attendees, error: attendeesError } = await supabaseAdmin
          .from("safety_form_attendees")
          .select("user_id, is_foreman")
          .eq("safety_form_id", form.id)
          .order("user_id", { ascending: true });

        if (attendeesError) {
          throw new Error(`Failed to fetch attendees: ${attendeesError.message}`);
        }

        // Compute hash
        const recordHash = await computeRecordHash({
          formId: form.id,
          projectId: form.project_id,
          formType: form.form_type,
          createdBy: form.created_by,
          inspectionDate: form.inspection_date || form.created_at.split("T")[0],
          createdAt: form.created_at,
          entries: (entries || []).map((e) => ({
            field_name: e.field_name,
            field_value: e.field_value,
          })),
          attendees: (attendees || []).map((a) => ({
            user_id: a.user_id,
            is_foreman: a.is_foreman || false,
          })),
        });

        if (!dryRun) {
          // Update the form with computed hash
          const { error: updateError } = await supabaseAdmin
            .from("safety_forms")
            .update({ record_hash: recordHash })
            .eq("id", form.id);

          if (updateError) {
            throw new Error(`Failed to update: ${updateError.message}`);
          }
        }

        result.total_updated++;

        // Store sample (first 10)
        if (result.sample_updates.length < 10) {
          result.sample_updates.push({
            id: form.id,
            hash_prefix: recordHash.substring(0, 16) + "...",
          });
        }

        console.log(`[Backfill] ${dryRun ? "Would update" : "Updated"} ${form.id}: ${recordHash.substring(0, 12)}...`);

      } catch (err: any) {
        result.total_failed++;
        result.errors.push({
          id: form.id,
          error: err.message,
        });
        console.error(`[Backfill] Error processing ${form.id}:`, err.message);
      }
    }

    console.log(`[Backfill] Complete: scanned=${result.total_scanned}, updated=${result.total_updated}, failed=${result.total_failed}`);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[Backfill] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
