import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  json,
  badRequest,
  conflict,
  notFound,
  serverError,
  requireAuthUser,
  serviceClient,
  getProjectAndOrg,
  assertOrgMember,
  assertProjectMember,
  assertTimeTrackingEnabled,
  getOrgSettings,
  getJobSite,
  getOpenEntry,
  normalizeLocationPayload,
  makeGeofenceDecision,
  addFlag,
  addFlags,
  getIdempotentResponse,
  saveIdempotentResponse,
  isOfflineReplay,
  getIdempotencyKey,
} from "../_shared/timeUtils.ts";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[time-check-in] Processing request');

    // 1. Require authenticated user
    const authResult = await requireAuthUser(req);
    if (authResult instanceof Response) return authResult;
    const { userId } = authResult;
    console.log('[time-check-in] User authenticated:', userId);

    // 2. Parse input
    const body = await req.json();
    const { project_id, job_site_id, notes, task_id } = body;
    
    // Get idempotency key and offline replay flag
    const idempotencyKey = getIdempotencyKey(req);
    const offlineReplay = isOfflineReplay(req);

    if (!project_id) {
      return badRequest('MISSING_PROJECT_ID', 'project_id is required');
    }

    // 3. Load project and derive org_id
    const { project, error: projectError } = await getProjectAndOrg(project_id);
    if (projectError || !project) {
      return notFound('PROJECT_NOT_FOUND', projectError || 'Project not found');
    }
    const orgId = project.organization_id;
    console.log('[time-check-in] Project:', project.name, 'Org:', orgId);

    // 4. Check idempotency - return cached response if exists
    if (idempotencyKey) {
      const idempotencyResult = await getIdempotentResponse('time-check-in', orgId, userId, idempotencyKey, body);
      if (idempotencyResult.found && idempotencyResult.response) {
        console.log('[time-check-in] Returning idempotent response for key:', idempotencyKey);
        return idempotencyResult.response;
      }
    }

    // 5. Assert org membership
    const orgResult = await assertOrgMember(orgId, userId);
    if (orgResult instanceof Response) return orgResult;
    console.log('[time-check-in] User org role:', orgResult.role);

    // 6. Assert time tracking enabled
    const ttResult = await assertTimeTrackingEnabled(orgId);
    if (ttResult instanceof Response) return ttResult;

    // 6b. Guardrail: block_time_before_estimate
    const guardrailResult = await checkEstimateGuardrail(orgId, project_id, userId);
    if (guardrailResult instanceof Response) return guardrailResult;

    // 7. Assert project membership
    const projResult = await assertProjectMember(project_id, userId);
    if (projResult instanceof Response) return projResult;

    // 8. Check no open entry exists
    const { entry: existingEntry, error: openError } = await getOpenEntry(orgId, userId);
    if (openError === 'MULTIPLE_OPEN_ENTRIES') {
      return badRequest('MULTIPLE_OPEN_ENTRIES', 'User has multiple open time entries. Contact admin.');
    }
    if (existingEntry) {
      // Add duplicate tap flag to existing entry
      await addFlag({
        orgId,
        timeEntryId: existingEntry.id,
        projectId: existingEntry.project_id,
        userId,
        flagCode: 'duplicate_tap_prevented',
        severity: 'warning',
        metadata: { 
          attempted_at: new Date().toISOString(),
          attempted_project_id: project_id,
        },
        createdSource: 'system',
      });
      
      return conflict('ALREADY_CHECKED_IN', 'User already has an open time entry', {
        existing_entry_id: existingEntry.id,
        checked_in_at: existingEntry.check_in_at,
      });
    }

    // 9. Normalize location payload
    const location = normalizeLocationPayload(body);
    console.log('[time-check-in] Location:', location);

    // 10. Get org settings for GPS accuracy threshold
    const orgSettings = await getOrgSettings(orgId);
    const gpsAccuracyThreshold = orgSettings?.time_gps_accuracy_warn_meters || 100;
    const projectTimezone = orgSettings?.default_timezone || 'America/Vancouver';

    // 11. Validate job site and check geofence
    let resolvedJobSiteId = job_site_id || null;
    const flagsToAdd: string[] = [];
    
    if (job_site_id) {
      const { jobSite, error: siteError } = await getJobSite(job_site_id, orgId, project_id);
      if (siteError) {
        return badRequest('INVALID_JOB_SITE', siteError);
      }
      
      // Make geofence decision
      const geofenceResult = makeGeofenceDecision(location, jobSite, gpsAccuracyThreshold);
      
      if (!geofenceResult.allowed && geofenceResult.errorResponse) {
        return geofenceResult.errorResponse;
      }
      
      // Collect flags from geofence check
      flagsToAdd.push(...geofenceResult.flags);
    } else {
      // No job site provided - flag the entry
      flagsToAdd.push('missing_job_site');
    }
    
    // Add location flags based on payload
    if (location.latitude === null || location.longitude === null) {
      if (!flagsToAdd.includes('location_unverified')) {
        flagsToAdd.push('location_unverified');
      }
    }
    
    // Add offline sync flag if this is a replay
    if (offlineReplay) {
      flagsToAdd.push('offline_sync');
    }

    // 12. Determine initial flag state
    const isFlagged = flagsToAdd.length > 0;
    const flagReason = flagsToAdd.join(', ') || null;

    // 13. Insert time_event (service client)
    const supabase = serviceClient();
    const now = new Date().toISOString();

    const { error: eventError } = await supabase
      .from('time_events')
      .insert({
        organization_id: orgId,
        user_id: userId,
        project_id: project_id,
        job_site_id: resolvedJobSiteId,
        event_type: 'check_in',
        occurred_at: now,
        latitude: location.latitude,
        longitude: location.longitude,
        actor_id: userId,
        source: offlineReplay ? 'offline_sync' : 'user',
        metadata: { 
          notes: notes || null,
          accuracy_meters: location.accuracy_meters,
          location_source: location.location_source,
          offline_replay: offlineReplay,
          idempotency_key: idempotencyKey,
        },
      });

    if (eventError) {
      console.error('[time-check-in] Failed to insert time_event:', eventError);
      return serverError('EVENT_INSERT_FAILED', 'Failed to record check-in event');
    }

    // 14. Insert time_entry (service client)
    const { data: newEntry, error: entryError } = await supabase
      .from('time_entries')
      .insert({
        organization_id: orgId,
        user_id: userId,
        project_id: project_id,
        job_site_id: resolvedJobSiteId,
        task_id: task_id || null,
        project_timezone: projectTimezone,
        check_in_at: now,
        check_in_latitude: location.latitude,
        check_in_longitude: location.longitude,
        status: 'open',
        is_flagged: isFlagged,
        flag_reason: flagReason,
        notes: notes || null,
        source: offlineReplay ? 'offline_sync' : 'app',
      })
      .select()
      .single();

    if (entryError) {
      console.error('[time-check-in] Failed to insert time_entry:', entryError);
      return serverError('ENTRY_INSERT_FAILED', 'Failed to create time entry');
    }

    // 15. Insert detailed flags into time_entry_flags table
    const flagParams = flagsToAdd.map(flagCode => ({
      orgId,
      timeEntryId: newEntry.id,
      projectId: project_id,
      userId,
      flagCode,
      severity: flagCode === 'offline_sync' ? 'info' as const : 'warning' as const,
      metadata: {
        created_at_check_in: true,
        accuracy_meters: location.accuracy_meters,
        offline_replay: offlineReplay,
      },
      createdSource: 'system' as const,
    }));
    
    await addFlags(flagParams);

    console.log('[time-check-in] Successfully created entry:', newEntry.id, 'Flags:', flagsToAdd);

    const responseBody = { 
      status: 'checked_in', 
      entry: newEntry,
      flags: flagsToAdd,
    };

    // 16. Save idempotent response
    if (idempotencyKey) {
      await saveIdempotentResponse('time-check-in', orgId, userId, idempotencyKey, body, responseBody);
    }

    return json(responseBody);

  } catch (error: unknown) {
    console.error('[time-check-in] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return serverError('INTERNAL_ERROR', message);
  }
});

// ============================================
// Guardrail: block_time_before_estimate
// Checks org guardrail and enforces warn/block
// ============================================
async function checkEstimateGuardrail(
  orgId: string,
  projectId: string,
  userId: string,
): Promise<Response | null> {
  const supabase = serviceClient();

  // 1. Read guardrail setting
  const { data: guardrail } = await supabase
    .from('organization_guardrails')
    .select('mode')
    .eq('organization_id', orgId)
    .eq('key', 'block_time_before_estimate')
    .maybeSingle();

  const mode = guardrail?.mode ?? 'off';
  if (mode === 'off') return null;

  // 2. Check for approved estimate on this project
  const { data: estimate } = await supabase
    .from('estimates')
    .select('id')
    .eq('project_id', projectId)
    .eq('status', 'approved')
    .limit(1)
    .maybeSingle();

  if (estimate) return null; // Has approved estimate — allow

  console.log(`[time-check-in] Guardrail block_time_before_estimate triggered (mode=${mode}) for project ${projectId}`);

  if (mode === 'block') {
    return forbidden(
      'ESTIMATE_REQUIRED',
      'Estimate required before logging time. An approved estimate must exist for this project.',
      { guardrail_key: 'block_time_before_estimate' },
    );
  }

  // mode === 'warn': allow but create notification + flag
  // Create notification for project admins/PMs
  const { data: projectMembers } = await supabase
    .from('project_members')
    .select('user_id, role')
    .eq('project_id', projectId)
    .in('role', ['admin', 'pm']);

  const notifyUserIds = [
    ...new Set([
      userId,
      ...(projectMembers || []).map((m: { user_id: string }) => m.user_id),
    ]),
  ];

  // Batch insert notifications (best-effort, don't block check-in)
  const notifications = notifyUserIds.map((uid: string) => ({
    user_id: uid,
    title: 'Time logged without approved estimate',
    message: `Time was logged on a project without an approved estimate. Review estimates to ensure cost tracking accuracy.`,
    type: 'guardrail_warning' as const,
    project_id: projectId,
    link_url: `/estimates?projectId=${projectId}`,
  }));

  await supabase.from('notifications').insert(notifications).throwOnError().catch((err: unknown) => {
    console.error('[time-check-in] Failed to create guardrail notifications:', err);
  });

  return null; // Allow check-in to proceed
}
