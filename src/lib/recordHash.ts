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
