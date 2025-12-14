import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  json,
  badRequest,
  forbidden,
  notFound,
  serverError,
  requireAuthUser,
  serviceClient,
  getProjectAndOrg,
  assertOrgMember,
  assertProjectMember,
  assertTimeTrackingEnabled,
  getOpenEntry,
  computeDuration,
} from "../_shared/timeUtils.ts";

const ALLOWED_ROLES = ['admin', 'hr', 'pm', 'foreman'];
const ORG_WIDE_ROLES = ['admin', 'hr']; // These don't need project membership

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[time-force-check-out] Processing request');

    // 1. Require authenticated user
    const authResult = await requireAuthUser(req);
    if (authResult instanceof Response) return authResult;
    const { userId: actorId } = authResult;
    console.log('[time-force-check-out] Actor authenticated:', actorId);

    // 2. Parse input
    const body = await req.json();
    const { project_id, target_user_id, reason, latitude, longitude } = body;

    if (!project_id) {
      return badRequest('MISSING_PROJECT_ID', 'project_id is required');
    }
    if (!target_user_id) {
      return badRequest('MISSING_TARGET_USER', 'target_user_id is required');
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return badRequest('MISSING_REASON', 'reason is required');
    }

    // 3. Load project and derive org_id
    const { project, error: projectError } = await getProjectAndOrg(project_id);
    if (projectError || !project) {
      return notFound('PROJECT_NOT_FOUND', projectError || 'Project not found');
    }
    const orgId = project.organization_id;
    console.log('[time-force-check-out] Project:', project.name, 'Org:', orgId);

    // 4. Assert actor org membership and get role
    const orgResult = await assertOrgMember(orgId, actorId);
    if (orgResult instanceof Response) return orgResult;
    const actorRole = orgResult.role;
    console.log('[time-force-check-out] Actor org role:', actorRole);

    // 5. Assert time tracking enabled
    const ttResult = await assertTimeTrackingEnabled(orgId);
    if (ttResult instanceof Response) return ttResult;

    // 6. Check actor role is allowed
    if (!ALLOWED_ROLES.includes(actorRole)) {
      return forbidden('INSUFFICIENT_ROLE', 'Only admin, hr, pm, or foreman can force check-out', {
        required_roles: ALLOWED_ROLES,
        actor_role: actorRole,
      });
    }

    // 7. If PM or Foreman, require project membership
    if (!ORG_WIDE_ROLES.includes(actorRole)) {
      const projResult = await assertProjectMember(project_id, actorId);
      if (projResult instanceof Response) return projResult;
    }

    // 8. Find target user's open entry in this org + project
    const { entry: openEntry, error: openError } = await getOpenEntry(orgId, target_user_id, project_id);
    if (openError === 'MULTIPLE_OPEN_ENTRIES') {
      return badRequest('MULTIPLE_OPEN_ENTRIES', 'Target user has multiple open entries. Contact admin.');
    }
    if (!openEntry) {
      return notFound('NO_OPEN_ENTRY', 'Target user has no open time entry for this project');
    }

    console.log('[time-force-check-out] Found open entry:', openEntry.id);

    // 9. Compute duration
    const now = new Date().toISOString();
    const { duration_minutes, duration_hours } = computeDuration(openEntry.check_in_at, now);

    // 10. Build previous values snapshot
    const previousValues = {
      check_out_at: openEntry.check_out_at,
      check_out_latitude: openEntry.check_out_latitude,
      check_out_longitude: openEntry.check_out_longitude,
      duration_minutes: openEntry.duration_minutes,
      duration_hours: openEntry.duration_hours,
      status: openEntry.status,
      closed_by: openEntry.closed_by,
      closed_method: openEntry.closed_method,
    };

    // 11. Update time_entry
    const supabase = serviceClient();

    const { data: updatedEntry, error: updateError } = await supabase
      .from('time_entries')
      .update({
        check_out_at: now,
        check_out_latitude: latitude || null,
        check_out_longitude: longitude || null,
        duration_minutes,
        duration_hours,
        status: 'force_closed',
        closed_by: actorId,
        closed_method: 'force',
      })
      .eq('id', openEntry.id)
      .select()
      .single();

    if (updateError) {
      console.error('[time-force-check-out] Failed to update time_entry:', updateError);
      return serverError('ENTRY_UPDATE_FAILED', 'Failed to update time entry');
    }

    // 12. Insert time_event
    const { error: eventError } = await supabase
      .from('time_events')
      .insert({
        organization_id: orgId,
        user_id: target_user_id,
        project_id: project_id,
        job_site_id: openEntry.job_site_id,
        event_type: 'force_check_out',
        occurred_at: now,
        latitude: latitude || null,
        longitude: longitude || null,
        actor_id: actorId,
        source: actorRole === 'admin' || actorRole === 'hr' ? 'admin' : 'foreman',
        metadata: { 
          reason: reason.trim(),
          duration_minutes,
          duration_hours,
        },
      });

    if (eventError) {
      console.error('[time-force-check-out] Failed to insert time_event:', eventError);
    }

    // 13. Insert time_entry_adjustment
    const newValues = {
      check_out_at: now,
      check_out_latitude: latitude || null,
      check_out_longitude: longitude || null,
      duration_minutes,
      duration_hours,
      status: 'force_closed',
      closed_by: actorId,
      closed_method: 'force',
    };

    const { data: adjustment, error: adjError } = await supabase
      .from('time_entry_adjustments')
      .insert({
        organization_id: orgId,
        time_entry_id: openEntry.id,
        adjusted_by: actorId,
        adjustment_type: 'system_close',
        previous_values: previousValues,
        new_values: newValues,
        reason: reason.trim(),
        affects_pay: true,
      })
      .select()
      .single();

    if (adjError) {
      console.error('[time-force-check-out] Failed to insert adjustment:', adjError);
    }

    console.log('[time-force-check-out] Successfully force checked out:', updatedEntry.id);

    return json({ 
      status: 'force_checked_out', 
      entry: updatedEntry,
      adjustment_id: adjustment?.id || null,
    });

  } catch (error: unknown) {
    console.error('[time-force-check-out] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return serverError('INTERNAL_ERROR', message);
  }
});
