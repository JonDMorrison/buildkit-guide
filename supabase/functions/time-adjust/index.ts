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
  assertOrgMember,
  assertTimeTrackingEnabled,
  computeDuration,
} from "../_shared/timeUtils.ts";

const ALLOWED_ROLES = ['admin', 'hr'];

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[time-adjust] Processing request');

    // 1. Require authenticated user
    const authResult = await requireAuthUser(req);
    if (authResult instanceof Response) return authResult;
    const { userId: actorId } = authResult;
    console.log('[time-adjust] Actor authenticated:', actorId);

    // 2. Parse input
    const body = await req.json();
    const { 
      time_entry_id, 
      new_check_in_at, 
      new_check_out_at, 
      new_job_site_id, 
      new_notes, 
      reason,
      affects_pay = true 
    } = body;

    if (!time_entry_id) {
      return badRequest('MISSING_ENTRY_ID', 'time_entry_id is required');
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return badRequest('MISSING_REASON', 'reason is required');
    }

    // 3. Load time entry (service client)
    const supabase = serviceClient();
    
    const { data: entry, error: fetchError } = await supabase
      .from('time_entries')
      .select('*')
      .eq('id', time_entry_id)
      .maybeSingle();

    if (fetchError) {
      console.error('[time-adjust] Failed to fetch time entry:', fetchError);
      return serverError('DB_ERROR', 'Failed to fetch time entry');
    }
    if (!entry) {
      return notFound('ENTRY_NOT_FOUND', 'Time entry not found');
    }

    const orgId = entry.organization_id;
    console.log('[time-adjust] Entry found, org:', orgId);

    // 4. Assert org membership and role
    const orgResult = await assertOrgMember(orgId, actorId);
    if (orgResult instanceof Response) return orgResult;
    const actorRole = orgResult.role;
    console.log('[time-adjust] Actor role:', actorRole);

    // 5. Assert time tracking enabled
    const ttResult = await assertTimeTrackingEnabled(orgId);
    if (ttResult instanceof Response) return ttResult;

    // 6. Check actor role is admin or hr
    if (!ALLOWED_ROLES.includes(actorRole)) {
      return forbidden('INSUFFICIENT_ROLE', 'Only admin or hr can adjust time entries', {
        required_roles: ALLOWED_ROLES,
        actor_role: actorRole,
      });
    }

    // 7. Build changeset and validate
    const updates: Record<string, any> = {};
    const changedFields: string[] = [];

    if (new_check_in_at !== undefined) {
      const checkInDate = new Date(new_check_in_at);
      if (isNaN(checkInDate.getTime())) {
        return badRequest('INVALID_CHECK_IN', 'new_check_in_at is not a valid date');
      }
      updates.check_in_at = checkInDate.toISOString();
      changedFields.push('check_in_at');
    }

    if (new_check_out_at !== undefined) {
      if (new_check_out_at === null) {
        // Reopening the entry
        updates.check_out_at = null;
        updates.duration_minutes = null;
        updates.duration_hours = null;
        updates.status = 'open';
        changedFields.push('check_out_at', 'status');
      } else {
        const checkOutDate = new Date(new_check_out_at);
        if (isNaN(checkOutDate.getTime())) {
          return badRequest('INVALID_CHECK_OUT', 'new_check_out_at is not a valid date');
        }
        updates.check_out_at = checkOutDate.toISOString();
        changedFields.push('check_out_at');
      }
    }

    if (new_job_site_id !== undefined) {
      if (new_job_site_id === null) {
        updates.job_site_id = null;
      } else {
        // Validate job site belongs to same org and project
        const { data: jobSite, error: jsError } = await supabase
          .from('job_sites')
          .select('id')
          .eq('id', new_job_site_id)
          .eq('organization_id', orgId)
          .eq('project_id', entry.project_id)
          .maybeSingle();
        
        if (jsError || !jobSite) {
          return badRequest('INVALID_JOB_SITE', 'Job site not found or does not belong to this project');
        }
        updates.job_site_id = new_job_site_id;
      }
      changedFields.push('job_site_id');
    }

    if (new_notes !== undefined) {
      updates.notes = new_notes;
      changedFields.push('notes');
    }

    // 8. Validate time range if both check_in and check_out are present
    const finalCheckIn = updates.check_in_at || entry.check_in_at;
    const finalCheckOut = updates.check_out_at !== undefined ? updates.check_out_at : entry.check_out_at;

    if (finalCheckIn && finalCheckOut && finalCheckOut !== null) {
      const checkInTime = new Date(finalCheckIn).getTime();
      const checkOutTime = new Date(finalCheckOut).getTime();
      
      if (checkOutTime <= checkInTime) {
        return badRequest('INVALID_TIME_RANGE', 'check_out_at must be after check_in_at');
      }

      // Recompute duration
      const { duration_minutes, duration_hours } = computeDuration(finalCheckIn, finalCheckOut);
      updates.duration_minutes = duration_minutes;
      updates.duration_hours = duration_hours;
    }

    // 9. If no changes, return early
    if (changedFields.length === 0) {
      return badRequest('NO_CHANGES', 'No fields to update');
    }

    // Update status if we're making changes to a closed entry
    if (entry.status === 'closed' || entry.status === 'force_closed') {
      updates.status = 'adjusted';
    }

    // 10. Snapshot previous values
    const previousValues: Record<string, any> = {};
    for (const field of changedFields) {
      previousValues[field] = entry[field];
    }
    if (updates.duration_minutes !== undefined) {
      previousValues.duration_minutes = entry.duration_minutes;
      previousValues.duration_hours = entry.duration_hours;
    }
    if (updates.status) {
      previousValues.status = entry.status;
    }

    // 11. Apply update
    const { data: updatedEntry, error: updateError } = await supabase
      .from('time_entries')
      .update(updates)
      .eq('id', time_entry_id)
      .select()
      .single();

    if (updateError) {
      console.error('[time-adjust] Failed to update time entry:', updateError);
      return serverError('UPDATE_FAILED', 'Failed to update time entry');
    }

    // 12. Insert time_event
    const { error: eventError } = await supabase
      .from('time_events')
      .insert({
        organization_id: orgId,
        user_id: entry.user_id,
        project_id: entry.project_id,
        job_site_id: updatedEntry.job_site_id,
        event_type: 'adjustment',
        occurred_at: new Date().toISOString(),
        latitude: null,
        longitude: null,
        actor_id: actorId,
        source: 'admin',
        metadata: { 
          changed_fields: changedFields,
          reason: reason.trim(),
          affects_pay,
        },
      });

    if (eventError) {
      console.error('[time-adjust] Failed to insert time_event:', eventError);
    }

    // 13. Insert time_entry_adjustment
    const newValues: Record<string, any> = {};
    for (const field of changedFields) {
      newValues[field] = updatedEntry[field];
    }
    if (updates.duration_minutes !== undefined) {
      newValues.duration_minutes = updatedEntry.duration_minutes;
      newValues.duration_hours = updatedEntry.duration_hours;
    }
    if (updates.status) {
      newValues.status = updatedEntry.status;
    }

    const { data: adjustment, error: adjError } = await supabase
      .from('time_entry_adjustments')
      .insert({
        organization_id: orgId,
        time_entry_id: time_entry_id,
        adjusted_by: actorId,
        adjustment_type: changedFields.includes('check_in_at') || changedFields.includes('check_out_at') 
          ? 'time_change' 
          : changedFields.includes('job_site_id') 
            ? 'job_site_change'
            : 'note_change',
        previous_values: previousValues,
        new_values: newValues,
        reason: reason.trim(),
        affects_pay,
      })
      .select()
      .single();

    if (adjError) {
      console.error('[time-adjust] Failed to insert adjustment:', adjError);
    }

    console.log('[time-adjust] Successfully adjusted entry:', updatedEntry.id);

    return json({ 
      status: 'adjusted', 
      entry: updatedEntry,
      adjustment_id: adjustment?.id || null,
    });

  } catch (error: unknown) {
    console.error('[time-adjust] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return serverError('INTERNAL_ERROR', message);
  }
});
