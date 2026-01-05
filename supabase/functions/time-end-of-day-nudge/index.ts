import { corsHeaders, json, validateCronSecret, serviceClient } from '../_shared/timeUtils.ts';

// Simple timezone offset mapping for common timezones
const timezoneOffsets: Record<string, number> = {
  'America/Vancouver': -8,
  'America/Los_Angeles': -8,
  'America/Denver': -7,
  'America/Chicago': -6,
  'America/New_York': -5,
  'America/Toronto': -5,
  'America/Edmonton': -7,
  'America/Winnipeg': -6,
  'America/Halifax': -4,
  'UTC': 0,
};

function getLocalHour(timezone: string): number {
  const now = new Date();
  const offset = timezoneOffsets[timezone] || 0;
  const utcHour = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  return (utcHour + offset + 24) % 24 + utcMinutes / 60;
}

function parseTimeToDecimal(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours + (minutes || 0) / 60;
}

interface RunStats {
  invocation_time: string;
  orgs_checked: number;
  orgs_in_window: number;
  orgs_with_errors: number;
  users_checked: number;
  nudges_sent: number;
  nudges_skipped_dedupe: number;
  errors: Array<{ org_id: string; error: string }>;
  duration_ms: number;
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  const stats: RunStats = {
    invocation_time: new Date().toISOString(),
    orgs_checked: 0,
    orgs_in_window: 0,
    orgs_with_errors: 0,
    users_checked: 0,
    nudges_sent: 0,
    nudges_skipped_dedupe: 0,
    errors: [],
    duration_ms: 0,
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate cron secret - reject if invalid
  const secretError = validateCronSecret(req);
  if (secretError) {
    console.error('[time-end-of-day-nudge] REJECTED: Invalid or missing cron secret');
    return secretError;
  }

  console.log(`[time-end-of-day-nudge] ========== JOB START: ${stats.invocation_time} ==========`);

  try {
    const supabase = serviceClient();

    // Get all organizations with end-of-day reminder enabled
    const { data: orgs, error: orgsError } = await supabase
      .from('organization_settings')
      .select('organization_id, default_timezone, time_end_of_day_reminder_time_local')
      .eq('time_tracking_enabled', true)
      .eq('time_end_of_day_reminder_enabled', true);

    if (orgsError) {
      console.error('[time-end-of-day-nudge] FATAL: Failed to fetch orgs', orgsError);
      throw orgsError;
    }

    console.log(`[time-end-of-day-nudge] Found ${orgs?.length || 0} orgs with end-of-day reminders enabled`);

    const WINDOW_MINUTES = 30; // 15 minutes before and after the target time
    const today = new Date().toISOString().split('T')[0];

    for (const org of orgs || []) {
      try {
        stats.orgs_checked++;
        const timezone = org.default_timezone || 'America/Vancouver';
        const targetTime = org.time_end_of_day_reminder_time_local || '17:00';
        
        const localHour = getLocalHour(timezone);
        const targetDecimal = parseTimeToDecimal(targetTime);
        const windowHours = WINDOW_MINUTES / 60;

        // Check if we're within the reminder window
        if (Math.abs(localHour - targetDecimal) > windowHours) {
          console.log(`[time-end-of-day-nudge] ORG ${org.organization_id.substring(0, 8)}...: Outside window (local: ${localHour.toFixed(2)}, target: ${targetDecimal}, tz: ${timezone})`);
          continue;
        }

        stats.orgs_in_window++;
        console.log(`[time-end-of-day-nudge] ORG ${org.organization_id.substring(0, 8)}...: WITHIN WINDOW (local: ${localHour.toFixed(2)}, target: ${targetDecimal})`);

        // Find users with open entries
        const { data: openEntries, error: entriesError } = await supabase
          .from('time_entries')
          .select('user_id, project_id, check_in_at')
          .eq('organization_id', org.organization_id)
          .is('check_out_at', null);

        if (entriesError) {
          const errMsg = `Failed to fetch entries: ${entriesError.message}`;
          console.error(`[time-end-of-day-nudge] ORG ${org.organization_id}: ${errMsg}`);
          stats.errors.push({ org_id: org.organization_id, error: errMsg });
          stats.orgs_with_errors++;
          continue; // Don't fail entire run for one org
        }

        stats.users_checked += openEntries?.length || 0;
        console.log(`[time-end-of-day-nudge] ORG ${org.organization_id.substring(0, 8)}...: ${openEntries?.length || 0} users with open entries`);

        for (const entry of openEntries || []) {
          // Check event dedupe - prevent duplicate events
          const eventDedupeKey = `eod:${entry.user_id}:${today}`;
          const { data: existingEventDedupe } = await supabase
            .from('event_dedupe')
            .select('id')
            .eq('dedupe_key', eventDedupeKey)
            .maybeSingle();

          // Check if already sent today via notification_dedupe
          const { data: recentDedupe } = await supabase
            .from('notification_dedupe')
            .select('last_sent_at')
            .eq('organization_id', org.organization_id)
            .eq('user_id', entry.user_id)
            .eq('notification_type', 'end_of_day_reminder')
            .gte('last_sent_at', `${today}T00:00:00Z`)
            .maybeSingle();

          if (recentDedupe || existingEventDedupe) {
            console.log(`[time-end-of-day-nudge] SKIP user ${entry.user_id.substring(0, 8)}... - already sent today (event: ${!!existingEventDedupe}, notification: ${!!recentDedupe})`);
            stats.nudges_skipped_dedupe++;
            continue;
          }

          const { data: project } = await supabase
            .from('projects')
            .select('name')
            .eq('id', entry.project_id)
            .single();

          // Create notification
          const { error: notifError } = await supabase.from('notifications').insert({
            user_id: entry.user_id,
            project_id: entry.project_id,
            type: 'general',
            title: 'End of Day Reminder',
            message: `It's end of day. You're still clocked in on ${project?.name || 'project'}. Don't forget to check out!`,
            link_url: '/time',
          });

          if (notifError) {
            console.error(`[time-end-of-day-nudge] Failed to create notification for user ${entry.user_id}:`, notifError);
            continue;
          }

          // Insert event dedupe to prevent duplicate events
          await supabase.from('event_dedupe').upsert({
            dedupe_key: eventDedupeKey,
            event_type: 'eod_nudge',
            last_occurred_at: new Date().toISOString(),
            metadata: { user_id: entry.user_id, date: today },
          }, { onConflict: 'dedupe_key' });

          // Update notification dedupe
          await supabase
            .from('notification_dedupe')
            .upsert({
              organization_id: org.organization_id,
              user_id: entry.user_id,
              notification_type: 'end_of_day_reminder',
              last_sent_at: new Date().toISOString(),
            }, {
              onConflict: 'organization_id,user_id,notification_type',
            });

          stats.nudges_sent++;
          console.log(`[time-end-of-day-nudge] SENT EOD nudge to user ${entry.user_id.substring(0, 8)}...`);
        }
      } catch (orgError) {
        const errMsg = orgError instanceof Error ? orgError.message : 'Unknown error';
        console.error(`[time-end-of-day-nudge] ORG ${org.organization_id}: EXCEPTION: ${errMsg}`);
        stats.errors.push({ org_id: org.organization_id, error: errMsg });
        stats.orgs_with_errors++;
        // Continue to next org - don't fail entire run
      }
    }

    stats.duration_ms = Date.now() - startTime;

    console.log(`[time-end-of-day-nudge] ========== JOB COMPLETE ==========`);
    console.log(`[time-end-of-day-nudge] Duration: ${stats.duration_ms}ms`);
    console.log(`[time-end-of-day-nudge] Orgs checked: ${stats.orgs_checked}, in window: ${stats.orgs_in_window}, with errors: ${stats.orgs_with_errors}`);
    console.log(`[time-end-of-day-nudge] Users checked: ${stats.users_checked}`);
    console.log(`[time-end-of-day-nudge] Nudges sent: ${stats.nudges_sent}, skipped (dedupe): ${stats.nudges_skipped_dedupe}`);
    
    if (stats.errors.length > 0) {
      console.warn(`[time-end-of-day-nudge] ERRORS:`, JSON.stringify(stats.errors));
    }

    return json({ 
      success: true, 
      stats: {
        invocation_time: stats.invocation_time,
        duration_ms: stats.duration_ms,
        orgs_checked: stats.orgs_checked,
        orgs_in_window: stats.orgs_in_window,
        orgs_with_errors: stats.orgs_with_errors,
        users_checked: stats.users_checked,
        nudges_sent: stats.nudges_sent,
        nudges_skipped_dedupe: stats.nudges_skipped_dedupe,
      }
    });
  } catch (error) {
    stats.duration_ms = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    console.error(`[time-end-of-day-nudge] ========== JOB FAILED ==========`);
    console.error(`[time-end-of-day-nudge] Duration: ${stats.duration_ms}ms`);
    console.error(`[time-end-of-day-nudge] Fatal error: ${errorMsg}`);
    console.error(`[time-end-of-day-nudge] Partial stats:`, JSON.stringify(stats));
    
    return json({ 
      error: errorMsg,
      partial_stats: stats,
    }, 500);
  }
});
