import { corsHeaders, json, validateCronSecret, serviceClient } from '../_shared/timeUtils.ts';

interface RunStats {
  invocation_time: string;
  orgs_processed: number;
  orgs_with_errors: number;
  users_checked: number;
  reminders_sent: number;
  reminders_skipped_dedupe: number;
  errors: Array<{ org_id: string; error: string }>;
  duration_ms: number;
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  const stats: RunStats = {
    invocation_time: new Date().toISOString(),
    orgs_processed: 0,
    orgs_with_errors: 0,
    users_checked: 0,
    reminders_sent: 0,
    reminders_skipped_dedupe: 0,
    errors: [],
    duration_ms: 0,
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate cron secret - reject if invalid
  const secretError = validateCronSecret(req);
  if (secretError) {
    console.error('[time-send-reminders] REJECTED: Invalid or missing cron secret');
    return secretError;
  }

  console.log(`[time-send-reminders] ========== JOB START: ${stats.invocation_time} ==========`);

  try {
    const supabase = serviceClient();

    // Get all organizations with reminders enabled
    const { data: orgs, error: orgsError } = await supabase
      .from('organization_settings')
      .select('organization_id, time_reminder_after_minutes')
      .eq('time_tracking_enabled', true)
      .eq('time_reminders_enabled', true);

    if (orgsError) {
      console.error('[time-send-reminders] FATAL: Failed to fetch orgs', orgsError);
      throw orgsError;
    }

    console.log(`[time-send-reminders] Found ${orgs?.length || 0} orgs with reminders enabled`);

    const DEDUPE_HOURS = 2; // Don't send same reminder within 2 hours
    const dedupeThreshold = new Date(Date.now() - DEDUPE_HOURS * 60 * 60 * 1000).toISOString();

    for (const org of orgs || []) {
      try {
        stats.orgs_processed++;
        const reminderMinutes = org.time_reminder_after_minutes || 30;
        const thresholdTime = new Date(Date.now() - reminderMinutes * 60 * 1000).toISOString();

        // Find users with open entries past the reminder threshold
        const { data: openEntries, error: entriesError } = await supabase
          .from('time_entries')
          .select('id, user_id, project_id, check_in_at, job_site_id')
          .eq('organization_id', org.organization_id)
          .is('check_out_at', null)
          .lt('check_in_at', thresholdTime);

        if (entriesError) {
          const errMsg = `Failed to fetch entries: ${entriesError.message}`;
          console.error(`[time-send-reminders] ORG ${org.organization_id}: ${errMsg}`);
          stats.errors.push({ org_id: org.organization_id, error: errMsg });
          stats.orgs_with_errors++;
          continue; // Don't fail entire run for one org
        }

        // Get unique users
        const userIds = [...new Set(openEntries?.map(e => e.user_id) || [])];
        stats.users_checked += userIds.length;

        console.log(`[time-send-reminders] ORG ${org.organization_id}: ${userIds.length} users with open entries past ${reminderMinutes}min threshold`);

        for (const userId of userIds) {
          const userEntry = openEntries?.find(e => e.user_id === userId);
          if (!userEntry) continue;

          // Check event dedupe - prevent duplicate time_events on reminder
          const eventDedupeKey = `reminder:${userEntry.id}`;
          const { data: existingEventDedupe } = await supabase
            .from('event_dedupe')
            .select('id')
            .eq('dedupe_key', eventDedupeKey)
            .maybeSingle();

          // Check notification dedupe - was reminder sent recently?
          const { data: recentDedupe } = await supabase
            .from('notification_dedupe')
            .select('last_sent_at')
            .eq('organization_id', org.organization_id)
            .eq('user_id', userId)
            .eq('notification_type', 'check_out_reminder')
            .gt('last_sent_at', dedupeThreshold)
            .maybeSingle();

          if (recentDedupe || existingEventDedupe) {
            console.log(`[time-send-reminders] SKIP user ${userId.substring(0, 8)}... - dedupe (event: ${!!existingEventDedupe}, notification: ${!!recentDedupe})`);
            stats.reminders_skipped_dedupe++;
            continue;
          }

          const { data: project } = await supabase
            .from('projects')
            .select('name')
            .eq('id', userEntry.project_id)
            .single();

          const checkInTime = new Date(userEntry.check_in_at);
          const elapsedMinutes = Math.floor((Date.now() - checkInTime.getTime()) / (1000 * 60));
          const elapsedHours = Math.floor(elapsedMinutes / 60);
          const elapsedMins = elapsedMinutes % 60;

          // Create notification
          const { error: notifError } = await supabase.from('notifications').insert({
            user_id: userId,
            project_id: userEntry.project_id,
            type: 'general',
            title: 'Still Clocked In',
            message: `You've been clocked in for ${elapsedHours}h ${elapsedMins}m on ${project?.name || 'project'}. Did you forget to check out?`,
            link_url: '/time',
          });

          if (notifError) {
            console.error(`[time-send-reminders] Failed to create notification for user ${userId}:`, notifError);
            continue;
          }

          // Insert event dedupe to prevent duplicate events on double-run
          await supabase.from('event_dedupe').upsert({
            dedupe_key: eventDedupeKey,
            event_type: 'reminder',
            last_occurred_at: new Date().toISOString(),
            metadata: { time_entry_id: userEntry.id, user_id: userId },
          }, { onConflict: 'dedupe_key' });

          // Update or insert notification dedupe record
          await supabase
            .from('notification_dedupe')
            .upsert({
              organization_id: org.organization_id,
              user_id: userId,
              notification_type: 'check_out_reminder',
              last_sent_at: new Date().toISOString(),
              metadata: { entry_check_in: userEntry.check_in_at },
            }, {
              onConflict: 'organization_id,user_id,notification_type',
            });

          stats.reminders_sent++;
          console.log(`[time-send-reminders] SENT reminder to user ${userId.substring(0, 8)}... (entry: ${userEntry.id.substring(0, 8)}...)`);
        }
      } catch (orgError) {
        const errMsg = orgError instanceof Error ? orgError.message : 'Unknown error';
        console.error(`[time-send-reminders] ORG ${org.organization_id}: EXCEPTION: ${errMsg}`);
        stats.errors.push({ org_id: org.organization_id, error: errMsg });
        stats.orgs_with_errors++;
        // Continue to next org - don't fail entire run
      }
    }

    stats.duration_ms = Date.now() - startTime;

    console.log(`[time-send-reminders] ========== JOB COMPLETE ==========`);
    console.log(`[time-send-reminders] Duration: ${stats.duration_ms}ms`);
    console.log(`[time-send-reminders] Orgs processed: ${stats.orgs_processed} (${stats.orgs_with_errors} with errors)`);
    console.log(`[time-send-reminders] Users checked: ${stats.users_checked}`);
    console.log(`[time-send-reminders] Reminders sent: ${stats.reminders_sent}, skipped (dedupe): ${stats.reminders_skipped_dedupe}`);
    
    if (stats.errors.length > 0) {
      console.warn(`[time-send-reminders] ERRORS:`, JSON.stringify(stats.errors));
    }

    return json({ 
      success: true, 
      stats: {
        invocation_time: stats.invocation_time,
        duration_ms: stats.duration_ms,
        orgs_processed: stats.orgs_processed,
        orgs_with_errors: stats.orgs_with_errors,
        users_checked: stats.users_checked,
        reminders_sent: stats.reminders_sent,
        reminders_skipped_dedupe: stats.reminders_skipped_dedupe,
      }
    });
  } catch (error) {
    stats.duration_ms = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    console.error(`[time-send-reminders] ========== JOB FAILED ==========`);
    console.error(`[time-send-reminders] Duration: ${stats.duration_ms}ms`);
    console.error(`[time-send-reminders] Fatal error: ${errorMsg}`);
    console.error(`[time-send-reminders] Partial stats:`, JSON.stringify(stats));
    
    return json({ 
      error: errorMsg,
      partial_stats: stats,
    }, 500);
  }
});
