import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  json,
  badRequest,
  notFound,
  serverError,
  requireAuthUser,
  serviceClient,
  getProjectAndOrg,
  assertOrgMember,
  assertTimeTrackingEnabled,
  getOpenEntry,
  findOpenEntryAcrossOrgs,
  computeDuration,
  normalizeLocationPayload,
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
    console.log('[time-check-out] Processing request');

    // 1. Require authenticated user
    const authResult = await requireAuthUser(req);
    if (authResult instanceof Response) return authResult;
    const { userId } = authResult;
    console.log('[time-check-out] User authenticated:', userId);

    // 2. Parse input
    const body = await req.json();
    const { project_id } = body;
    
    // Get idempotency key and offline replay flag
    const idempotencyKey = getIdempotencyKey(req);
    const offlineReplay = isOfflineReplay(req);
    
    // Normalize location
    const location = normalizeLocationPayload(body);

    let orgId: string;
    let openEntry: any;

    // 3. Find open entry
    if (project_id) {
      // If project_id provided, derive org_id and search in that org
      const { project, error: projectError } = await getProjectAndOrg(project_id);
      if (projectError || !project) {
        return notFound('PROJECT_NOT_FOUND', projectError || 'Project not found');
      }
      orgId = project.organization_id;

      // Assert org membership
      const orgResult = await assertOrgMember(orgId, userId);
      if (orgResult instanceof Response) return orgResult;

      // Assert time tracking enabled
      const ttResult = await assertTimeTrackingEnabled(orgId);
      if (ttResult instanceof Response) return ttResult;

      const { entry, error: openError } = await getOpenEntry(orgId, userId, project_id);
      if (openError === 'MULTIPLE_OPEN_ENTRIES') {
        return badRequest('MULTIPLE_OPEN_ENTRIES', 'User has multiple open time entries. Contact admin.');
      }
      openEntry = entry;
    } else {
      // Search across all orgs user belongs to
      const { entry, orgId: foundOrgId, error: openError } = await findOpenEntryAcrossOrgs(userId);
      if (openError === 'MULTIPLE_OPEN_ENTRIES') {
        return badRequest('MULTIPLE_OPEN_ENTRIES', 'User has multiple open time entries. Contact admin.');
      }
      if (openError) {
        return badRequest('SEARCH_ERROR', openError);
      }
      if (!entry || !foundOrgId) {
        return notFound('NO_OPEN_ENTRY', 'No open time entry found');
      }
      openEntry = entry;
      orgId = foundOrgId;

      // Assert time tracking still enabled
      const ttResult = await assertTimeTrackingEnabled(orgId);
      if (ttResult instanceof Response) return ttResult;
    }

    if (!openEntry) {
      return notFound('NO_OPEN_ENTRY', 'No open time entry found');
    }

    // 4. Check idempotency - return cached response if exists
    if (idempotencyKey) {
      const idempotencyResult = await getIdempotentResponse('time-check-out', orgId!, userId, idempotencyKey, body);
      if (idempotencyResult.found && idempotencyResult.response) {
        console.log('[time-check-out] Returning idempotent response for key:', idempotencyKey);
        return idempotencyResult.response;
      }
    }

    console.log('[time-check-out] Found open entry:', openEntry.id);

    // 5. Compute duration
    const now = new Date().toISOString();
    const { duration_minutes, duration_hours } = computeDuration(openEntry.check_in_at, now);
    console.log('[time-check-out] Duration:', duration_minutes, 'minutes');

    // 6. Collect flags
    const flagsToAdd: string[] = [];
    
    // Check for location issues at checkout
    if (location.latitude === null || location.longitude === null) {
      flagsToAdd.push('checkout_location_missing');
    }
    
    // Check for offline replay
    if (offlineReplay) {
      flagsToAdd.push('offline_sync');
    }
    
    // Check for long shift (> 16 hours = 960 minutes)
    if (duration_minutes > 960) {
      flagsToAdd.push('long_shift');
    }

    // 7. Determine flag state - merge with existing flags
    let isFlagged = openEntry.is_flagged || flagsToAdd.length > 0;
    let flagReason = openEntry.flag_reason || '';
    if (flagsToAdd.length > 0) {
      const newFlags = flagsToAdd.join(', ');
      flagReason = flagReason ? `${flagReason}, ${newFlags}` : newFlags;
    }

    // 8. Update time_entry
    const supabase = serviceClient();

    const { data: updatedEntry, error: updateError } = await supabase
      .from('time_entries')
      .update({
        check_out_at: now,
        check_out_latitude: location.latitude,
        check_out_longitude: location.longitude,
        duration_minutes,
        duration_hours,
        status: 'closed',
        closed_by: userId,
        closed_method: 'self',
        is_flagged: isFlagged,
        flag_reason: flagReason || null,
      })
      .eq('id', openEntry.id)
      .select()
      .single();

    if (updateError) {
      console.error('[time-check-out] Failed to update time_entry:', updateError);
      return serverError('ENTRY_UPDATE_FAILED', 'Failed to update time entry');
    }

    // 9. Insert time_event
    const { error: eventError } = await supabase
      .from('time_events')
      .insert({
        organization_id: orgId!,
        user_id: userId,
        project_id: openEntry.project_id,
        job_site_id: openEntry.job_site_id,
        event_type: 'check_out',
        occurred_at: now,
        latitude: location.latitude,
        longitude: location.longitude,
        actor_id: userId,
        source: offlineReplay ? 'offline_sync' : 'user',
        metadata: { 
          duration_minutes,
          duration_hours,
          accuracy_meters: location.accuracy_meters,
          location_source: location.location_source,
          offline_replay: offlineReplay,
          idempotency_key: idempotencyKey,
        },
      });

    if (eventError) {
      console.error('[time-check-out] Failed to insert time_event:', eventError);
      // Don't fail the whole operation, entry is already updated
    }

    // 10. Insert detailed flags into time_entry_flags table
    const flagParams = flagsToAdd.map(flagCode => ({
      orgId: orgId!,
      timeEntryId: openEntry.id,
      projectId: openEntry.project_id,
      userId,
      flagCode,
      severity: (flagCode === 'offline_sync' ? 'info' : flagCode === 'long_shift' ? 'critical' : 'warning') as 'info' | 'warning' | 'critical',
      metadata: {
        created_at_check_out: true,
        duration_minutes,
        accuracy_meters: location.accuracy_meters,
        offline_replay: offlineReplay,
      },
      createdSource: 'system' as const,
    }));
    
    await addFlags(flagParams);

    console.log('[time-check-out] Successfully checked out:', updatedEntry.id, 'Flags:', flagsToAdd);

    const responseBody = { 
      status: 'checked_out', 
      entry: updatedEntry,
      flags: flagsToAdd,
    };

    // 11. Save idempotent response
    if (idempotencyKey) {
      await saveIdempotentResponse('time-check-out', orgId!, userId, idempotencyKey, body, responseBody);
    }

    return json(responseBody);

  } catch (error: unknown) {
    console.error('[time-check-out] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return serverError('INTERNAL_ERROR', message);
  }
});
