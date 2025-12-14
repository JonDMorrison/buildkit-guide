import { corsHeaders, json, validateCronSecret, serviceClient } from '../_shared/timeUtils.ts';

function getWeekBounds(submissionDay: number): { start: Date; end: Date } {
  const now = new Date();
  const currentDay = now.getDay();
  
  // Calculate days until next submission day
  let daysUntilSubmission = submissionDay - currentDay;
  if (daysUntilSubmission < 0) daysUntilSubmission += 7;
  
  // Period end is the submission day
  const periodEnd = new Date(now);
  periodEnd.setDate(now.getDate() + daysUntilSubmission);
  periodEnd.setHours(23, 59, 59, 999);
  
  // Period start is 7 days before period end
  const periodStart = new Date(periodEnd);
  periodStart.setDate(periodEnd.getDate() - 6);
  periodStart.setHours(0, 0, 0, 0);
  
  return { start: periodStart, end: periodEnd };
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

    console.log('Starting timesheet-nudges job...');

    // Get all organizations with time tracking enabled
    const { data: orgs, error: orgsError } = await supabase
      .from('organization_settings')
      .select('organization_id, timesheet_submission_day, timesheet_escalation_enabled, timesheet_escalation_after_hours')
      .eq('time_tracking_enabled', true);

    if (orgsError) throw orgsError;

    console.log(`Found ${orgs?.length || 0} orgs with time tracking enabled`);

    let workerNudges = 0;
    let escalations = 0;

    for (const org of orgs || []) {
      const submissionDay = org.timesheet_submission_day ?? 5; // Friday default
      const { start: periodStart, end: periodEnd } = getWeekBounds(submissionDay);
      const now = new Date();
      const isSubmissionDay = now.getDay() === submissionDay;
      
      // Find workers with time entries in this period who haven't submitted
      const { data: entries, error: entriesError } = await supabase
        .from('time_entries')
        .select('user_id')
        .eq('organization_id', org.organization_id)
        .gte('check_in_at', periodStart.toISOString())
        .lte('check_in_at', periodEnd.toISOString());

      if (entriesError) {
        console.error(`Error fetching entries for org ${org.organization_id}:`, entriesError);
        continue;
      }

      const workerIds = [...new Set(entries?.map(e => e.user_id) || [])];

      for (const userId of workerIds) {
        // Check if period exists and is open
        const { data: period } = await supabase
          .from('timesheet_periods')
          .select('id, status, submitted_at')
          .eq('organization_id', org.organization_id)
          .eq('user_id', userId)
          .eq('period_start', periodStart.toISOString().split('T')[0])
          .eq('period_end', periodEnd.toISOString().split('T')[0])
          .maybeSingle();

        const isOpen = !period || period.status === 'open';
        
        if (isOpen && isSubmissionDay) {
          // Check dedupe - only nudge once per period
          const { data: recentDedupe } = await supabase
            .from('notification_dedupe')
            .select('last_sent_at')
            .eq('organization_id', org.organization_id)
            .eq('user_id', userId)
            .eq('notification_type', 'timesheet_submit_nudge')
            .gte('last_sent_at', periodStart.toISOString())
            .maybeSingle();

          if (!recentDedupe) {
            // Send nudge to worker
            await supabase.from('notifications').insert({
              user_id: userId,
              type: 'general',
              title: 'Submit Your Timesheet',
              message: 'Today is timesheet submission day. Please review and submit your hours for this week.',
              link_url: '/time',
            });

            await supabase.from('notification_dedupe').upsert({
              organization_id: org.organization_id,
              user_id: userId,
              notification_type: 'timesheet_submit_nudge',
              last_sent_at: new Date().toISOString(),
            }, { onConflict: 'organization_id,user_id,notification_type' });

            workerNudges++;
          }
        }

        // Handle escalation for overdue submissions
        if (org.timesheet_escalation_enabled && isOpen) {
          const escalationHours = org.timesheet_escalation_after_hours || 24;
          const escalationThreshold = new Date(periodEnd.getTime() + escalationHours * 60 * 60 * 1000);
          
          if (now > escalationThreshold) {
            // Check dedupe for escalation
            const { data: escalationDedupe } = await supabase
              .from('notification_dedupe')
              .select('last_sent_at')
              .eq('organization_id', org.organization_id)
              .eq('user_id', userId)
              .eq('notification_type', 'timesheet_overdue_escalation')
              .gte('last_sent_at', periodStart.toISOString())
              .maybeSingle();

            if (!escalationDedupe) {
              // Get user name
              const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, email')
                .eq('id', userId)
                .single();

              const userName = profile?.full_name || profile?.email || 'A worker';

              // Find PM/Foreman who share a project with this worker and HR/Admin
              const { data: workerProjects } = await supabase
                .from('project_members')
                .select('project_id')
                .eq('user_id', userId);

              const projectIds = workerProjects?.map(p => p.project_id) || [];

              // Get supervisors for these projects
              const { data: supervisors } = await supabase
                .from('project_members')
                .select('user_id, role')
                .in('project_id', projectIds)
                .in('role', ['project_manager', 'foreman']);

              const supervisorIds = [...new Set(supervisors?.map(s => s.user_id) || [])];

              // Get HR/Admin in org
              const { data: orgAdmins } = await supabase
                .from('organization_memberships')
                .select('user_id')
                .eq('organization_id', org.organization_id)
                .in('role', ['admin', 'hr'])
                .eq('is_active', true);

              const adminIds = orgAdmins?.map(a => a.user_id) || [];
              const escalateToIds = [...new Set([...supervisorIds, ...adminIds])];

              for (const recipientId of escalateToIds) {
                if (recipientId === userId) continue; // Don't escalate to the worker themselves

                await supabase.from('notifications').insert({
                  user_id: recipientId,
                  type: 'general',
                  title: 'Overdue Timesheet',
                  message: `${userName} has not submitted their timesheet for the period ending ${periodEnd.toLocaleDateString()}. Please follow up.`,
                  link_url: '/time/periods',
                });
              }

              await supabase.from('notification_dedupe').upsert({
                organization_id: org.organization_id,
                user_id: userId,
                notification_type: 'timesheet_overdue_escalation',
                last_sent_at: new Date().toISOString(),
              }, { onConflict: 'organization_id,user_id,notification_type' });

              escalations++;
              console.log(`Escalated overdue timesheet for user ${userId} to ${escalateToIds.length} recipients`);
            }
          }
        }
      }
    }

    console.log(`Timesheet nudge job complete. Worker nudges: ${workerNudges}, Escalations: ${escalations}`);

    return json({ success: true, workerNudges, escalations });
  } catch (error) {
    console.error('Timesheet nudge error:', error);
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
