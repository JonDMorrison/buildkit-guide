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
  getOrgSettings,
  getJobSite,
  getOpenEntry,
  distanceMeters,
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
    const { project_id, job_site_id, latitude, longitude, notes } = body;

    if (!project_id) {
      return badRequest('MISSING_PROJECT_ID', 'project_id is required');
    }
    if (latitude === undefined || longitude === undefined) {
      return badRequest('MISSING_LOCATION', 'latitude and longitude are required');
    }

    // 3. Load project and derive org_id
    const { project, error: projectError } = await getProjectAndOrg(project_id);
    if (projectError || !project) {
      return notFound('PROJECT_NOT_FOUND', projectError || 'Project not found');
    }
    const orgId = project.organization_id;
    console.log('[time-check-in] Project:', project.name, 'Org:', orgId);

    // 4. Assert org membership
    const orgResult = await assertOrgMember(orgId, userId);
    if (orgResult instanceof Response) return orgResult;
    console.log('[time-check-in] User org role:', orgResult.role);

    // 5. Assert time tracking enabled
    const ttResult = await assertTimeTrackingEnabled(orgId);
    if (ttResult instanceof Response) return ttResult;

    // 6. Assert project membership
    const projResult = await assertProjectMember(project_id, userId);
    if (projResult instanceof Response) return projResult;

    // 7. Check no open entry exists
    const { entry: existingEntry, error: openError } = await getOpenEntry(orgId, userId);
    if (openError === 'MULTIPLE_OPEN_ENTRIES') {
      return badRequest('MULTIPLE_OPEN_ENTRIES', 'User has multiple open time entries. Contact admin.');
    }
    if (existingEntry) {
      return badRequest('ALREADY_CHECKED_IN', 'User already has an open time entry', {
        existing_entry_id: existingEntry.id,
        checked_in_at: existingEntry.check_in_at,
      });
    }

    // 8. If job_site_id provided, validate and check geofence
    let isFlagged = false;
    let flagReason: string | null = null;
    let resolvedJobSiteId = job_site_id || null;

    if (job_site_id) {
      const { jobSite, error: siteError } = await getJobSite(job_site_id, orgId, project_id);
      if (siteError) {
        return badRequest('INVALID_JOB_SITE', siteError);
      }
      
      if (jobSite && jobSite.latitude != null && jobSite.longitude != null) {
        const distance = distanceMeters(latitude, longitude, jobSite.latitude, jobSite.longitude);
        console.log('[time-check-in] Distance from job site:', distance, 'Radius:', jobSite.geofence_radius_meters);
        
        if (distance > jobSite.geofence_radius_meters) {
          return forbidden('OUTSIDE_GEOFENCE', 'User is outside the job site geofence', {
            distance_meters: Math.round(distance),
            radius_meters: jobSite.geofence_radius_meters,
          });
        }
      }
    } else {
      // No job site provided - flag the entry
      isFlagged = true;
      flagReason = 'missing_job_site';
    }

    // 9. Get org settings for timezone
    const orgSettings = await getOrgSettings(orgId);
    const projectTimezone = orgSettings?.default_timezone || 'America/Vancouver';

    // 10. Insert time_event (service client)
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
        latitude,
        longitude,
        actor_id: userId,
        source: 'user',
        metadata: { notes: notes || null },
      });

    if (eventError) {
      console.error('[time-check-in] Failed to insert time_event:', eventError);
      return serverError('EVENT_INSERT_FAILED', 'Failed to record check-in event');
    }

    // 11. Insert time_entry (service client)
    const { data: newEntry, error: entryError } = await supabase
      .from('time_entries')
      .insert({
        organization_id: orgId,
        user_id: userId,
        project_id: project_id,
        job_site_id: resolvedJobSiteId,
        project_timezone: projectTimezone,
        check_in_at: now,
        check_in_latitude: latitude,
        check_in_longitude: longitude,
        status: 'open',
        is_flagged: isFlagged,
        flag_reason: flagReason,
        notes: notes || null,
        source: 'app',
      })
      .select()
      .single();

    if (entryError) {
      console.error('[time-check-in] Failed to insert time_entry:', entryError);
      return serverError('ENTRY_INSERT_FAILED', 'Failed to create time entry');
    }

    console.log('[time-check-in] Successfully created entry:', newEntry.id);

    return json({ status: 'checked_in', entry: newEntry });

  } catch (error: unknown) {
    console.error('[time-check-in] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return serverError('INTERNAL_ERROR', message);
  }
});
