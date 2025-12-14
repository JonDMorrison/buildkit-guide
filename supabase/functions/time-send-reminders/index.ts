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

    console.log('Starting time-send-reminders job...');

    // Get all organizations with reminders enabled
    const { data: orgs, error: orgsError } = await supabase
      .from('organization_settings')
      .select('organization_id, time_reminder_after_minutes')
      .eq('time_tracking_enabled', true)
      .eq('time_reminders_enabled', true);

    if (orgsError) throw orgsError;

    console.log(`Found ${orgs?.length || 0} orgs with reminders enabled`);

    const DEDUPE_HOURS = 2; // Don't send same reminder within 2 hours
    const dedupeThreshold = new Date(Date.now() - DEDUPE_HOURS * 60 * 60 * 1000).toISOString();
    let remindersSent = 0;

    for (const org of orgs || []) {
      const reminderMinutes = org.time_reminder_after_minutes || 30;
      const thresholdTime = new Date(Date.now() - reminderMinutes * 60 * 1000).toISOString();

      // Find users with open entries past the reminder threshold
      const { data: openEntries, error: entriesError } = await supabase
        .from('time_entries')
        .select('user_id, project_id, check_in_at, job_site_id')
        .eq('organization_id', org.organization_id)
        .is('check_out_at', null)
        .lt('check_in_at', thresholdTime);

      if (entriesError) {
        console.error(`Error fetching entries for org ${org.organization_id}:`, entriesError);
        continue;
      }

      // Get unique users
      const userIds = [...new Set(openEntries?.map(e => e.user_id) || [])];

      for (const userId of userIds) {
        // Check dedupe - was reminder sent recently?
        const { data: recentDedupe } = await supabase
          .from('notification_dedupe')
          .select('last_sent_at')
          .eq('organization_id', org.organization_id)
          .eq('user_id', userId)
          .eq('notification_type', 'check_out_reminder')
          .gt('last_sent_at', dedupeThreshold)
          .maybeSingle();

        if (recentDedupe) {
          console.log(`Skipping reminder for user ${userId} - sent recently`);
          continue;
        }

        // Get entry details for notification
        const entry = openEntries?.find(e => e.user_id === userId);
        if (!entry) continue;

        const { data: project } = await supabase
          .from('projects')
          .select('name')
          .eq('id', entry.project_id)
          .single();

        const checkInTime = new Date(entry.check_in_at);
        const elapsedMinutes = Math.floor((Date.now() - checkInTime.getTime()) / (1000 * 60));
        const elapsedHours = Math.floor(elapsedMinutes / 60);
        const elapsedMins = elapsedMinutes % 60;

        // Create notification
        await supabase.from('notifications').insert({
          user_id: userId,
          project_id: entry.project_id,
          type: 'general',
          title: 'Still Clocked In',
          message: `You've been clocked in for ${elapsedHours}h ${elapsedMins}m on ${project?.name || 'project'}. Did you forget to check out?`,
          link_url: '/time',
        });

        // Update or insert dedupe record
        await supabase
          .from('notification_dedupe')
          .upsert({
            organization_id: org.organization_id,
            user_id: userId,
            notification_type: 'check_out_reminder',
            last_sent_at: new Date().toISOString(),
            metadata: { entry_check_in: entry.check_in_at },
          }, {
            onConflict: 'organization_id,user_id,notification_type',
          });

        remindersSent++;
        console.log(`Sent reminder to user ${userId}`);
      }
    }

    console.log(`Reminder job complete. Sent ${remindersSent} reminders.`);

    return json({ success: true, remindersSent });
  } catch (error) {
    console.error('Reminder error:', error);
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
