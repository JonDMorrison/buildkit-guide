import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  json,
  forbidden,
  serverError,
  requireAuthUser,
  serviceClient,
  assertOrgMember,
} from "../_shared/timeUtils.ts";

interface DiagnosticCheck {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: unknown;
  fix?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[time-diagnostics] Processing request');

    const authResult = await requireAuthUser(req);
    if (authResult instanceof Response) return authResult;
    const { userId } = authResult;

    const body = await req.json();
    const { organization_id } = body;

    if (!organization_id) {
      return json({ error: 'organization_id required' }, 400);
    }

    // Check org membership and require admin role
    const orgResult = await assertOrgMember(organization_id, userId);
    if (orgResult instanceof Response) return orgResult;
    
    if (orgResult.role !== 'admin') {
      return forbidden('ADMIN_REQUIRED', 'Only admins can run diagnostics');
    }

    const supabase = serviceClient();
    const checks: DiagnosticCheck[] = [];

    // 1. Check organization_settings.time_tracking_enabled
    const { data: orgSettings, error: orgSettingsError } = await supabase
      .from('organization_settings')
      .select('time_tracking_enabled, time_gps_accuracy_warn_meters')
      .eq('organization_id', organization_id)
      .single();

    if (orgSettingsError || !orgSettings) {
      checks.push({
        name: 'Organization Settings',
        status: 'FAIL',
        message: 'Organization settings not found',
        fix: `INSERT INTO organization_settings (organization_id, time_tracking_enabled) VALUES ('${organization_id}', true);`,
      });
    } else {
      checks.push({
        name: 'Time Tracking Enabled',
        status: orgSettings.time_tracking_enabled ? 'PASS' : 'WARN',
        message: orgSettings.time_tracking_enabled 
          ? 'Time tracking is enabled' 
          : 'Time tracking is disabled for this organization',
        details: { time_tracking_enabled: orgSettings.time_tracking_enabled },
      });
      
      checks.push({
        name: 'GPS Accuracy Threshold',
        status: 'PASS',
        message: `GPS accuracy warning threshold: ${orgSettings.time_gps_accuracy_warn_meters || 100}m`,
        details: { time_gps_accuracy_warn_meters: orgSettings.time_gps_accuracy_warn_meters || 100 },
      });
    }

    // 2. Check cron secret exists
    const { data: cronSecret, error: cronSecretError } = await supabase
      .from('cron_secrets')
      .select('name')
      .eq('name', 'time_cron_secret')
      .single();

    checks.push({
      name: 'Cron Secret',
      status: cronSecret ? 'PASS' : 'FAIL',
      message: cronSecret ? 'time_cron_secret is configured' : 'time_cron_secret is missing',
      fix: cronSecret ? undefined : `INSERT INTO cron_secrets (name, secret) VALUES ('time_cron_secret', 'your-secure-secret');`,
    });

    // 3. Check time_flag_codes table
    const { data: flagCodes, error: flagCodesError } = await supabase
      .from('time_flag_codes')
      .select('code, severity, is_active');

    if (flagCodesError || !flagCodes || flagCodes.length === 0) {
      checks.push({
        name: 'Flag Codes Table',
        status: 'FAIL',
        message: 'time_flag_codes table is empty or missing',
        fix: 'Run migration to populate time_flag_codes',
      });
    } else {
      const requiredCodes = [
        'location_unverified', 'gps_accuracy_low', 'geofence_not_verified', 
        'offline_sync', 'duplicate_tap_prevented', 'manual_time_added',
        'auto_closed', 'edited_after_submission', 'missing_job_site', 'long_shift'
      ];
      const existingCodes = flagCodes.map(f => f.code);
      const missingCodes = requiredCodes.filter(c => !existingCodes.includes(c));
      
      checks.push({
        name: 'Flag Codes',
        status: missingCodes.length === 0 ? 'PASS' : 'WARN',
        message: missingCodes.length === 0 
          ? `All ${requiredCodes.length} required flag codes present` 
          : `Missing codes: ${missingCodes.join(', ')}`,
        details: { total: flagCodes.length, missing: missingCodes },
      });
    }

    // 4. Check api_idempotency_keys table exists
    const { count: idempotencyCount, error: idempotencyError } = await supabase
      .from('api_idempotency_keys')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organization_id);

    checks.push({
      name: 'Idempotency Keys Table',
      status: idempotencyError ? 'FAIL' : 'PASS',
      message: idempotencyError 
        ? 'api_idempotency_keys table not accessible' 
        : `Idempotency table accessible (${idempotencyCount || 0} keys for this org)`,
    });

    // 5. Check event_dedupe table
    const { count: dedupeCount, error: dedupeError } = await supabase
      .from('event_dedupe')
      .select('*', { count: 'exact', head: true });

    checks.push({
      name: 'Event Dedupe Table',
      status: dedupeError ? 'FAIL' : 'PASS',
      message: dedupeError 
        ? 'event_dedupe table not accessible' 
        : `Event dedupe table accessible (${dedupeCount || 0} entries)`,
    });

    // 6. Check for active job sites
    const { data: jobSites, error: jobSitesError } = await supabase
      .from('job_sites')
      .select('id, name, geofence_radius_meters, latitude, longitude')
      .eq('organization_id', organization_id)
      .eq('is_active', true);

    if (jobSitesError || !jobSites || jobSites.length === 0) {
      checks.push({
        name: 'Job Sites',
        status: 'WARN',
        message: 'No active job sites configured for this organization',
        fix: 'Create job sites with geofence coordinates',
      });
    } else {
      const sitesWithCoords = jobSites.filter(s => s.latitude && s.longitude);
      checks.push({
        name: 'Job Sites',
        status: sitesWithCoords.length === jobSites.length ? 'PASS' : 'WARN',
        message: `${jobSites.length} active job sites (${sitesWithCoords.length} with coordinates)`,
        details: { total: jobSites.length, with_coords: sitesWithCoords.length },
      });
    }

    // 7. Check time_entries table has entries
    const { count: entryCount, error: entryError } = await supabase
      .from('time_entries')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organization_id);

    checks.push({
      name: 'Time Entries',
      status: 'PASS',
      message: `${entryCount || 0} time entries for this organization`,
      details: { count: entryCount },
    });

    // 8. Check for open entries
    const { data: openEntries, error: openError } = await supabase
      .from('time_entries')
      .select('id, user_id, check_in_at')
      .eq('organization_id', organization_id)
      .is('check_out_at', null);

    checks.push({
      name: 'Open Entries',
      status: 'PASS',
      message: `${openEntries?.length || 0} currently open time entries`,
      details: { count: openEntries?.length || 0 },
    });

    // 9. Check time_entry_flags
    const { count: flagCount, error: flagError } = await supabase
      .from('time_entry_flags')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organization_id);

    checks.push({
      name: 'Entry Flags',
      status: 'PASS',
      message: `${flagCount || 0} flags recorded for this organization`,
      details: { count: flagCount },
    });

    // Summary
    const passCount = checks.filter(c => c.status === 'PASS').length;
    const failCount = checks.filter(c => c.status === 'FAIL').length;
    const warnCount = checks.filter(c => c.status === 'WARN').length;

    return json({
      summary: {
        total: checks.length,
        pass: passCount,
        fail: failCount,
        warn: warnCount,
        overall: failCount > 0 ? 'FAIL' : (warnCount > 0 ? 'WARN' : 'PASS'),
      },
      checks,
      timestamp: new Date().toISOString(),
    });

  } catch (error: unknown) {
    console.error('[time-diagnostics] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return serverError('INTERNAL_ERROR', message);
  }
});
