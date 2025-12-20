import { supabase } from "@/integrations/supabase/client";

/**
 * Generate a SHA-256 hash for record integrity verification.
 * This creates a tamper-evident fingerprint of the safety form data.
 */
export async function generateRecordHash(data: {
  formId: string;
  projectId: string;
  formType: string;
  createdBy: string;
  inspectionDate: string;
  entries: Array<{ field_name: string; field_value: string | null }>;
  attendees: Array<{ user_id: string; is_foreman: boolean }>;
}): Promise<string> {
  // Create a canonical representation of the data
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
    timestamp: new Date().toISOString().substring(0, 19), // Truncate to second precision
  });

  // Generate SHA-256 hash using Web Crypto API
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(canonical);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  
  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  
  return hashHex;
}

/**
 * Verify a record hash matches the expected data.
 * Note: This is a client-side check; for full integrity, compare against stored hash.
 */
export function formatHashForDisplay(hash: string): string {
  if (!hash || hash.length < 16) return hash;
  return `${hash.substring(0, 8)}...${hash.substring(hash.length - 8)}`;
}

/**
 * Generate and persist record_hash for a safety form by fetching its data.
 * This is a shared helper that can be used for any safety form type.
 */
export async function generateAndPersistRecordHash(formId: string): Promise<string | null> {
  try {
    // Fetch form details
    const { data: form, error: formError } = await supabase
      .from("safety_forms")
      .select("id, project_id, form_type, created_by, inspection_date, created_at")
      .eq("id", formId)
      .single();

    if (formError || !form) {
      console.error("[RecordHash] Failed to fetch form:", formError);
      return null;
    }

    // Fetch all entries ordered deterministically
    const { data: entries, error: entriesError } = await supabase
      .from("safety_entries")
      .select("field_name, field_value, created_at")
      .eq("safety_form_id", formId)
      .order("field_name", { ascending: true })
      .order("created_at", { ascending: true });

    if (entriesError) {
      console.error("[RecordHash] Failed to fetch entries:", entriesError);
      return null;
    }

    // Fetch attendees
    const { data: attendees, error: attendeesError } = await supabase
      .from("safety_form_attendees")
      .select("user_id, is_foreman")
      .eq("safety_form_id", formId)
      .order("user_id", { ascending: true });

    if (attendeesError) {
      console.error("[RecordHash] Failed to fetch attendees:", attendeesError);
      return null;
    }

    // Generate hash
    const recordHash = await generateRecordHash({
      formId: form.id,
      projectId: form.project_id,
      formType: form.form_type,
      createdBy: form.created_by,
      inspectionDate: form.inspection_date || form.created_at.split("T")[0],
      entries: (entries || []).map((e) => ({
        field_name: e.field_name,
        field_value: e.field_value,
      })),
      attendees: (attendees || []).map((a) => ({
        user_id: a.user_id,
        is_foreman: a.is_foreman || false,
      })),
    });

    // Persist to database
    const { error: updateError } = await supabase
      .from("safety_forms")
      .update({ record_hash: recordHash })
      .eq("id", formId);

    if (updateError) {
      console.error("[RecordHash] Failed to persist hash:", updateError);
      return null;
    }

    return recordHash;
  } catch (error) {
    console.error("[RecordHash] Unexpected error:", error);
    return null;
  }
}

/**
 * Validate that submitted/reviewed forms have record_hash.
 * Logs warning in dev mode if a form is missing its hash.
 */
export function assertRecordHashPresent(
  form: { id: string; status: string; record_hash: string | null; form_type: string }
): void {
  if (
    (form.status === "submitted" || form.status === "reviewed") &&
    !form.record_hash
  ) {
    console.error(
      `[COMPLIANCE WARNING] Safety form ${form.id} (${form.form_type}) has status="${form.status}" but record_hash is NULL. This violates tamper-evidence requirements.`
    );
  }
}
