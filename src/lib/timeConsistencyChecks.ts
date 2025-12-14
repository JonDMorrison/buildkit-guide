/**
 * Time Tracking Consistency Checks
 * 
 * Lightweight checks to verify UI/DB consistency.
 * Run in diagnostics page and optionally in dev console.
 */

import { supabase } from '@/integrations/supabase/client';

export interface ConsistencyCheck {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN' | 'SKIP';
  message: string;
  details?: unknown;
}

/**
 * Verify edge function exists by invoking it (expects 4xx or 2xx, not 404)
 */
async function checkEdgeFunction(name: string): Promise<ConsistencyCheck> {
  try {
    // Invoke without auth to check if it exists (should get 401/403, not 404)
    const { error } = await supabase.functions.invoke(name, {
      body: {},
    });

    // If we get any response (including 401/403), the function exists
    if (error) {
      // Network error or function not found
      if (error.message?.includes('not found') || error.message?.includes('404')) {
        return {
          name: `Edge Function: ${name}`,
          status: 'FAIL',
          message: `Function ${name} not found`,
        };
      }
    }

    return {
      name: `Edge Function: ${name}`,
      status: 'PASS',
      message: `Function ${name} exists`,
    };
  } catch (e) {
    return {
      name: `Edge Function: ${name}`,
      status: 'WARN',
      message: `Could not verify ${name}`,
      details: e instanceof Error ? e.message : 'Unknown error',
    };
  }
}

/**
 * Check required edge functions exist
 */
export async function checkEdgeFunctions(): Promise<ConsistencyCheck[]> {
  const requiredFunctions = [
    'time-check-in',
    'time-check-out',
    'time-force-check-out',
    'time-request-create',
    'time-request-review',
    'time-diagnostics',
    'time-auto-close',
    'time-send-reminders',
  ];

  const checks = await Promise.all(requiredFunctions.map(checkEdgeFunction));
  return checks;
}

/**
 * Check v_time_entries_status view exists and is queryable
 */
export async function checkEnrichedView(): Promise<ConsistencyCheck> {
  try {
    const { data, error } = await supabase
      .from('v_time_entries_status')
      .select('id')
      .limit(1);

    if (error) {
      return {
        name: 'Enriched View',
        status: 'FAIL',
        message: 'v_time_entries_status view not accessible',
        details: error.message,
      };
    }

    return {
      name: 'Enriched View',
      status: 'PASS',
      message: 'v_time_entries_status view is accessible',
    };
  } catch (e) {
    return {
      name: 'Enriched View',
      status: 'FAIL',
      message: 'Failed to query v_time_entries_status',
      details: e instanceof Error ? e.message : 'Unknown error',
    };
  }
}

/**
 * Check time_flag_codes table has required codes
 */
export async function checkFlagCodes(): Promise<ConsistencyCheck> {
  const requiredCodes = [
    'location_unverified',
    'gps_accuracy_low',
    'offline_sync',
    'offline_replayed',
    'manual_time_added',
    'auto_closed',
    'edited_after_submission',
    'missing_job_site',
    'long_shift',
  ];

  try {
    const { data, error } = await supabase
      .from('time_flag_codes')
      .select('code')
      .eq('is_active', true);

    if (error) {
      return {
        name: 'Flag Codes',
        status: 'FAIL',
        message: 'Could not query time_flag_codes',
        details: error.message,
      };
    }

    const existingCodes = (data || []).map((d) => d.code);
    const missingCodes = requiredCodes.filter((c) => !existingCodes.includes(c));

    if (missingCodes.length > 0) {
      return {
        name: 'Flag Codes',
        status: 'WARN',
        message: `Missing flag codes: ${missingCodes.join(', ')}`,
        details: { missing: missingCodes, total: existingCodes.length },
      };
    }

    return {
      name: 'Flag Codes',
      status: 'PASS',
      message: `All ${requiredCodes.length} required flag codes present`,
      details: { total: existingCodes.length },
    };
  } catch (e) {
    return {
      name: 'Flag Codes',
      status: 'FAIL',
      message: 'Failed to check flag codes',
      details: e instanceof Error ? e.message : 'Unknown error',
    };
  }
}

/**
 * Check api_idempotency_keys table exists (admin only can query count)
 */
export async function checkIdempotencyTable(): Promise<ConsistencyCheck> {
  try {
    const { count, error } = await supabase
      .from('api_idempotency_keys')
      .select('*', { count: 'exact', head: true });

    // RLS should block this, but if it doesn't we know the table exists
    if (error) {
      // Expected: RLS blocks client access
      if (error.message?.includes('permission') || error.code === '42501') {
        return {
          name: 'Idempotency Table',
          status: 'PASS',
          message: 'api_idempotency_keys exists (client access blocked by RLS)',
        };
      }
      return {
        name: 'Idempotency Table',
        status: 'WARN',
        message: 'Could not verify api_idempotency_keys',
        details: error.message,
      };
    }

    return {
      name: 'Idempotency Table',
      status: 'PASS',
      message: `api_idempotency_keys accessible (${count || 0} keys)`,
    };
  } catch (e) {
    return {
      name: 'Idempotency Table',
      status: 'WARN',
      message: 'Could not verify api_idempotency_keys',
      details: e instanceof Error ? e.message : 'Unknown error',
    };
  }
}

/**
 * Run all consistency checks
 */
export async function runAllConsistencyChecks(): Promise<ConsistencyCheck[]> {
  const results: ConsistencyCheck[] = [];

  // Check enriched view
  results.push(await checkEnrichedView());

  // Check flag codes
  results.push(await checkFlagCodes());

  // Check idempotency table
  results.push(await checkIdempotencyTable());

  // Check edge functions (in parallel)
  const edgeFunctionChecks = await checkEdgeFunctions();
  results.push(...edgeFunctionChecks);

  return results;
}

/**
 * Badge derivation rules documentation
 * 
 * All badges shown in the UI must be derived from one of:
 * 1. A persisted flag_code in time_entry_flags table
 * 2. An explicit derived rule (only: is_stale from check_in_at age)
 * 
 * Valid badge → flag mappings:
 * - Manual → manual_time_added
 * - Auto-closed → auto_closed, long_open_shift_auto_closed
 * - Location Unverified → location_unverified, checkout_location_missing, geofence_not_verified
 * - Offline → offline_sync, offline_replayed
 * - GPS Low → gps_accuracy_low
 * - Missing Job Site → missing_job_site
 * - Edited After Submit → edited_after_submission
 * - Long Shift → long_shift
 * - Stale → DERIVED from check_in_at > 4 hours ago (not persisted)
 */
export const BADGE_DERIVATION_RULES = {
  manual: ['manual_time_added'],
  auto_closed: ['auto_closed', 'long_open_shift_auto_closed'],
  location_unverified: ['location_unverified', 'checkout_location_missing', 'geofence_not_verified'],
  offline: ['offline_sync', 'offline_replayed'],
  gps_accuracy_low: ['gps_accuracy_low'],
  missing_job_site: ['missing_job_site'],
  edited_after_submission: ['edited_after_submission'],
  long_shift: ['long_shift'],
  stale: 'DERIVED_FROM_CHECK_IN_AT',
} as const;
