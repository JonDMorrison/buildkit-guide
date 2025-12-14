import { corsHeaders, json, validateCronSecret, serviceClient } from '../_shared/timeUtils.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate cron secret - reject if invalid
  const secretError = validateCronSecret(req);
  if (secretError) return secretError;

  try {
    const supabase = serviceClient();

    console.log('Starting time-auto-close job...');

    // Get all organizations with time tracking and auto-close enabled
    const { data: orgs, error: orgsError } = await supabase
      .from('organization_settings')
      .select('organization_id, time_auto_close_hours, default_timezone')
      .eq('time_tracking_enabled', true)
      .eq('time_auto_close_enabled', true);

    if (orgsError) {
      console.error('Error fetching org settings:', orgsError);
      throw orgsError;
    }

    console.log(`Found ${orgs?.length || 0} orgs with auto-close enabled`);

    let totalClosed = 0;

    for (const org of orgs || []) {
      const thresholdHours = org.time_auto_close_hours || 18;
      const thresholdTime = new Date(Date.now() - thresholdHours * 60 * 60 * 1000).toISOString();

      // Find stale open entries for this org
      const { data: staleEntries, error: entriesError } = await supabase
        .from('time_entries')
        .select('id, user_id, project_id, job_site_id, check_in_at, organization_id')
        .eq('organization_id', org.organization_id)
        .is('check_out_at', null)
        .lt('check_in_at', thresholdTime);

      if (entriesError) {
        console.error(`Error fetching stale entries for org ${org.organization_id}:`, entriesError);
        continue;
      }

      console.log(`Org ${org.organization_id}: Found ${staleEntries?.length || 0} stale entries`);

      for (const entry of staleEntries || []) {
        // Check event dedupe - prevent duplicate time_events on double-run
        const dedupeKey = `auto_close:${entry.id}`;
        const { data: existingDedupe } = await supabase
          .from('event_dedupe')
          .select('id')
          .eq('dedupe_key', dedupeKey)
          .maybeSingle();

        if (existingDedupe) {
          console.log(`Skipping entry ${entry.id} - already auto-closed (dedupe)`);
          continue;
        }

        const now = new Date();
        const checkInTime = new Date(entry.check_in_at);
        const durationMs = now.getTime() - checkInTime.getTime();
        const durationMinutes = Math.floor(durationMs / (1000 * 60));
        const durationHours = Math.round((durationMinutes / 60) * 100) / 100;

        // Store previous values for audit
        const previousValues = {
          check_out_at: null,
          status: 'open',
          closed_method: null,
          closed_by: null,
          duration_minutes: null,
          duration_hours: null,
          is_flagged: false,
          flag_reason: null,
        };

        // Close the entry
        const { error: updateError } = await supabase
          .from('time_entries')
          .update({
            check_out_at: now.toISOString(),
            status: 'closed',
            closed_method: 'system_auto_close',
            closed_by: null,
            duration_minutes: durationMinutes,
            duration_hours: durationHours,
            is_flagged: true,
            flag_reason: 'long_open_shift_auto_closed',
          })
          .eq('id', entry.id);

        if (updateError) {
          console.error(`Error closing entry ${entry.id}:`, updateError);
          continue;
        }

        // Insert event dedupe record first (prevents duplicates on double-run)
        await supabase.from('event_dedupe').upsert({
          dedupe_key: dedupeKey,
          event_type: 'auto_close',
          last_occurred_at: now.toISOString(),
          metadata: { time_entry_id: entry.id },
        }, { onConflict: 'dedupe_key' });

        // Log time_event
        await supabase.from('time_events').insert({
          organization_id: entry.organization_id,
          user_id: entry.user_id,
          project_id: entry.project_id,
          job_site_id: entry.job_site_id,
          event_type: 'check_out',
          occurred_at: now.toISOString(),
          actor_id: entry.user_id,
          source: 'system',
          metadata: {
            action: 'auto_close',
            prior_open_duration_hours: durationHours,
            threshold_hours: thresholdHours,
            time_entry_id: entry.id,
          },
        });

        // Log adjustment
        await supabase.from('time_entry_adjustments').insert({
          organization_id: entry.organization_id,
          time_entry_id: entry.id,
          adjusted_by: entry.user_id,
          adjustment_type: 'system_close',
          previous_values: previousValues,
          new_values: {
            check_out_at: now.toISOString(),
            status: 'closed',
            closed_method: 'system_auto_close',
            duration_minutes: durationMinutes,
            duration_hours: durationHours,
            is_flagged: true,
            flag_reason: 'long_open_shift_auto_closed',
          },
          reason: `Auto-close after ${thresholdHours} hours open`,
          affects_pay: true,
        });

        // Create flag
        await supabase.from('time_entry_flags').insert({
          organization_id: entry.organization_id,
          time_entry_id: entry.id,
          project_id: entry.project_id,
          user_id: entry.user_id,
          flag_code: 'auto_closed_long_open',
          severity: 'critical',
          metadata: {
            prior_open_duration_hours: durationHours,
            threshold_hours: thresholdHours,
            auto_closed_at: now.toISOString(),
          },
          created_source: 'system',
        });

        // Get project for notification
        const { data: project } = await supabase
          .from('projects')
          .select('name')
          .eq('id', entry.project_id)
          .single();

        // Create notification for the worker
        await supabase.from('notifications').insert({
          user_id: entry.user_id,
          project_id: entry.project_id,
          type: 'general',
          title: 'Time Entry Auto-Closed',
          message: `Your time entry from ${new Date(entry.check_in_at).toLocaleString()} on ${project?.name || 'Unknown Project'} was automatically closed after ${thresholdHours} hours. Please review and submit an adjustment request if needed.`,
          link_url: '/time',
        });

        totalClosed++;
        console.log(`Closed entry ${entry.id} for user ${entry.user_id}`);
      }
    }

    console.log(`Auto-close job complete. Closed ${totalClosed} entries.`);

    return json({ success: true, entriesClosed: totalClosed });
  } catch (error) {
    console.error('Auto-close error:', error);
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
