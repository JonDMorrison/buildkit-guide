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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate cron secret - reject if invalid
  const secretError = validateCronSecret(req);
  if (secretError) return secretError;

  try {
    const supabase = serviceClient();

    console.log('Starting time-end-of-day-nudge job...');

    // Get all organizations with end-of-day reminder enabled
    const { data: orgs, error: orgsError } = await supabase
      .from('organization_settings')
      .select('organization_id, default_timezone, time_end_of_day_reminder_time_local')
      .eq('time_tracking_enabled', true)
      .eq('time_end_of_day_reminder_enabled', true);

    if (orgsError) throw orgsError;

    console.log(`Found ${orgs?.length || 0} orgs with end-of-day reminders enabled`);

    const WINDOW_MINUTES = 30; // 15 minutes before and after the target time
    let nudgesSent = 0;

    for (const org of orgs || []) {
      const timezone = org.default_timezone || 'America/Vancouver';
      const targetTime = org.time_end_of_day_reminder_time_local || '17:00';
      
      const localHour = getLocalHour(timezone);
      const targetDecimal = parseTimeToDecimal(targetTime);
      const windowHours = WINDOW_MINUTES / 60;

      // Check if we're within the reminder window
      if (Math.abs(localHour - targetDecimal) > windowHours) {
        console.log(`Org ${org.organization_id}: Outside reminder window (local: ${localHour.toFixed(2)}, target: ${targetDecimal})`);
        continue;
      }

      console.log(`Org ${org.organization_id}: Within reminder window`);

      // Find users with open entries
      const { data: openEntries, error: entriesError } = await supabase
        .from('time_entries')
        .select('user_id, project_id, check_in_at')
        .eq('organization_id', org.organization_id)
        .is('check_out_at', null);

      if (entriesError) {
        console.error(`Error fetching entries for org ${org.organization_id}:`, entriesError);
        continue;
      }

      // Dedupe check - don't send twice in same day
      const today = new Date().toISOString().split('T')[0];

      for (const entry of openEntries || []) {
        // Check if already sent today
        const { data: recentDedupe } = await supabase
          .from('notification_dedupe')
          .select('last_sent_at')
          .eq('organization_id', org.organization_id)
          .eq('user_id', entry.user_id)
          .eq('notification_type', 'end_of_day_reminder')
          .gte('last_sent_at', `${today}T00:00:00Z`)
          .maybeSingle();

        if (recentDedupe) {
          console.log(`Skipping EOD nudge for user ${entry.user_id} - already sent today`);
          continue;
        }

        const { data: project } = await supabase
          .from('projects')
          .select('name')
          .eq('id', entry.project_id)
          .single();

        // Create notification
        await supabase.from('notifications').insert({
          user_id: entry.user_id,
          project_id: entry.project_id,
          type: 'general',
          title: 'End of Day Reminder',
          message: `It's end of day. You're still clocked in on ${project?.name || 'project'}. Don't forget to check out!`,
          link_url: '/time',
        });

        // Update dedupe
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

        nudgesSent++;
        console.log(`Sent EOD nudge to user ${entry.user_id}`);
      }
    }

    console.log(`EOD nudge job complete. Sent ${nudgesSent} nudges.`);

    return json({ success: true, nudgesSent });
  } catch (error) {
    console.error('EOD nudge error:', error);
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
