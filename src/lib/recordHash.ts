import { supabase } from "@/integrations/supabase/client";

/**
 * Canonical snapshot format for tamper-evident hashing.
 * This structure is used consistently across all hash generation:
 * - Form submission (all types)
 * - Amendment approval regeneration
 * - Backfill job
 */
export interface CanonicalSnapshot {
  formId: string;
  projectId: string;
  formType: string;
  createdBy: string;
  createdAt: string; // Form's created_at timestamp - THE KEY FOR DETERMINISM
  inspectionDate: string;
  entries: string; // Sorted, normalized entry string
  attendees: string; // Sorted, normalized attendee string
}

/**
 * Build a canonical snapshot from raw data.
 * All fields are normalized for stable hashing.
 */
export function buildCanonicalSnapshot(data: {
  formId: string;
  projectId: string;
  formType: string;
  createdBy: string;
  createdAt: string;
  inspectionDate: string;
  entries: Array<{ field_name: string; field_value: string | null }>;
  attendees: Array<{ user_id: string; is_foreman: boolean }>;
}): CanonicalSnapshot {
  // Sort entries by field_name for deterministic ordering
  const sortedEntries = [...data.entries]
    .sort((a, b) => a.field_name.localeCompare(b.field_name));
  
  // Sort attendees by user_id for deterministic ordering
  const sortedAttendees = [...data.attendees]
    .sort((a, b) => a.user_id.localeCompare(b.user_id));

  return {
    formId: data.formId,
    projectId: data.projectId,
    formType: data.formType,
    createdBy: data.createdBy,
    // Truncate to second precision for consistency
    createdAt: data.createdAt.substring(0, 19),
    inspectionDate: data.inspectionDate,
    entries: sortedEntries
      .map((e) => `${e.field_name}:${e.field_value || ""}`)
      .join("|"),
    attendees: sortedAttendees
      .map((a) => `${a.user_id}:${a.is_foreman}`)
      .join("|"),
  };
}

/**
 * Generate SHA-256 hash from a canonical snapshot.
 * Uses stable JSON key ordering.
 */
export async function hashCanonicalSnapshot(snapshot: CanonicalSnapshot): Promise<string> {
  // Build canonical JSON with explicit key order for stability
  const canonical = JSON.stringify({
    formId: snapshot.formId,
    projectId: snapshot.projectId,
    formType: snapshot.formType,
    createdBy: snapshot.createdBy,
    createdAt: snapshot.createdAt,
    inspectionDate: snapshot.inspectionDate,
    entries: snapshot.entries,
    attendees: snapshot.attendees,
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
 * Generate a deterministic SHA-256 hash for a safety form.
 * 
 * CRITICAL: This function is DETERMINISTIC - calling it twice with
 * the same persisted data will produce the same hash.
 * 
 * The hash is derived ONLY from:
 * - Form metadata (id, project_id, form_type, created_by, created_at, inspection_date)
 * - Sorted safety_entries (field_name, field_value)
 * - Sorted attendees (user_id, is_foreman)
 * 
 * NO runtime values (new Date(), random IDs) are used.
 */
export async function generateRecordHash(data: {
  formId: string;
  projectId: string;
  formType: string;
  createdBy: string;
  createdAt: string; // REQUIRED: Use the form's created_at from DB
  inspectionDate: string;
  entries: Array<{ field_name: string; field_value: string | null }>;
  attendees: Array<{ user_id: string; is_foreman: boolean }>;
}): Promise<string> {
  const snapshot = buildCanonicalSnapshot(data);
  return hashCanonicalSnapshot(snapshot);
}

/**
 * Fetch form data and generate hash - the PRIMARY method for hash generation.
 * This fetches all data from the database to ensure consistency.
 * 
 * Use this method when:
 * - Persisting hash after form submission
 * - Regenerating hash after amendment approval
 * - Backfilling legacy forms
 */
export async function generateAndPersistRecordHash(formId: string): Promise<string | null> {
  try {
    // Fetch form details - including created_at for determinism
    const { data: form, error: formError } = await supabase
      .from("safety_forms")
      .select("id,project_id,form_type,created_by,inspection_date,created_at,status")
      .eq("id", formId)
      .single();

    if (formError || !form) {
      console.error("[RecordHash] Failed to fetch form:", formError);
      return null;
    }

    // Fetch all entries ordered deterministically
    const { data: entries, error: entriesError } = await supabase
      .from("safety_entries")
      .select("field_name,field_value")
      .eq("safety_form_id", formId)
      .order("field_name", { ascending: true });

    if (entriesError) {
      console.error("[RecordHash] Failed to fetch entries:", entriesError);
      return null;
    }

    // Fetch attendees ordered deterministically
    const { data: attendees, error: attendeesError } = await supabase
      .from("safety_form_attendees")
      .select("user_id,is_foreman")
      .eq("safety_form_id", formId)
      .order("user_id", { ascending: true });

    if (attendeesError) {
      console.error("[RecordHash] Failed to fetch attendees:", attendeesError);
      return null;
    }

    // Generate hash using the canonical snapshot
    const recordHash = await generateRecordHash({
      formId: form.id,
      projectId: form.project_id,
      formType: form.form_type,
      createdBy: form.created_by,
      createdAt: form.created_at, // Use DB timestamp for determinism
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

    console.log("[RecordHash] Generated and persisted hash:", {
      formId,
      hashPrefix: recordHash.substring(0, 8),
    });

    return recordHash;
  } catch (error) {
    console.error("[RecordHash] Unexpected error:", error);
    return null;
  }
}

/**
 * Verify hash determinism - call this twice and compare results.
 * Returns true if hash is stable, false if non-deterministic.
 */
export async function verifyHashDeterminism(formId: string): Promise<{
  isStable: boolean;
  hash1: string | null;
  hash2: string | null;
}> {
  // Fetch form data once
  const { data: form, error: formError } = await supabase
    .from("safety_forms")
    .select("id,project_id,form_type,created_by,inspection_date,created_at")
    .eq("id", formId)
    .single();

  if (formError || !form) {
    console.error("[HashVerify] Failed to fetch form:", formError);
    return { isStable: false, hash1: null, hash2: null };
  }

  const { data: entries } = await supabase
    .from("safety_entries")
    .select("field_name,field_value")
    .eq("safety_form_id", formId)
    .order("field_name", { ascending: true });

  const { data: attendees } = await supabase
    .from("safety_form_attendees")
    .select("user_id,is_foreman")
    .eq("safety_form_id", formId)
    .order("user_id", { ascending: true });

  const hashData = {
    formId: form.id,
    projectId: form.project_id,
    formType: form.form_type,
    createdBy: form.created_by,
    createdAt: form.created_at,
    inspectionDate: form.inspection_date || form.created_at.split("T")[0],
    entries: (entries || []).map((e) => ({
      field_name: e.field_name,
      field_value: e.field_value,
    })),
    attendees: (attendees || []).map((a) => ({
      user_id: a.user_id,
      is_foreman: a.is_foreman || false,
    })),
  };

  // Generate hash twice
  const hash1 = await generateRecordHash(hashData);
  const hash2 = await generateRecordHash(hashData);

  const isStable = hash1 === hash2;

  if (!isStable) {
    console.error("[HashVerify] NON-DETERMINISTIC HASH DETECTED!", {
      formId,
      hash1,
      hash2,
    });
  } else {
    console.log("[HashVerify] Hash is stable:", {
      formId,
      hash: hash1.substring(0, 16),
    });
  }

  return { isStable, hash1, hash2 };
}

/**
 * Format a hash for display (truncated).
 */
export function formatHashForDisplay(hash: string): string {
  if (!hash || hash.length < 16) return hash;
  return `${hash.substring(0, 8)}...${hash.substring(hash.length - 8)}`;
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
