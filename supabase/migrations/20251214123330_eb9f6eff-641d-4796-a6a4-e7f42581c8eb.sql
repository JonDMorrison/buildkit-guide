
create or replace function public.rpc_review_time_adjustment_request(
  p_request_id uuid,
  p_actor_id uuid,
  p_decision text,
  p_review_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.time_adjustment_requests;
  v_role text;
  v_entry public.time_entries;
  v_prev jsonb;
  v_new jsonb;
  v_adj_id uuid;
  v_flags text[] := array[]::text[];
  v_now timestamptz := now();
  v_period public.timesheet_periods;
  v_minutes int;
  v_hours numeric(10,2);
  v_candidate_start timestamptz;
  v_candidate_end timestamptz;
  v_overlap_exists boolean;
  v_entry_id_to_exclude uuid;
begin
  if p_decision not in ('approved','denied') then
    raise exception 'Invalid decision' using errcode = 'P0001';
  end if;

  select * into v_req
  from public.time_adjustment_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found' using errcode = 'P0001';
  end if;

  if v_req.status <> 'pending' then
    raise exception 'Request not pending' using errcode = 'P0001';
  end if;

  if not public.has_org_membership_for_user(v_req.organization_id, p_actor_id) then
    raise exception 'Not in org' using errcode = 'P0001';
  end if;

  v_role := public.org_role_for_user(v_req.organization_id, p_actor_id);

  if v_role in ('pm','foreman') then
    if not exists (
      select 1 from public.project_members pm
      where pm.project_id = v_req.project_id and pm.user_id = p_actor_id
    ) then
      raise exception 'PM/Foreman must be project member to review request' using errcode = 'P0001';
    end if;
  elsif v_role not in ('admin','hr') then
    raise exception 'Insufficient role to review request' using errcode = 'P0001';
  end if;

  -- ========================================
  -- Per-request-type required field validation
  -- ========================================
  if v_req.request_type = 'missed_check_in' then
    if v_req.proposed_check_in_at is null then
      raise exception 'missed_check_in requires proposed_check_in_at' using errcode = 'P0001';
    end if;
  elsif v_req.request_type = 'missed_check_out' then
    if v_req.time_entry_id is null then
      raise exception 'missed_check_out requires time_entry_id' using errcode = 'P0001';
    end if;
  elsif v_req.request_type = 'add_manual_entry' then
    if v_req.proposed_check_in_at is null or v_req.proposed_check_out_at is null then
      raise exception 'add_manual_entry requires both proposed_check_in_at and proposed_check_out_at' using errcode = 'P0001';
    end if;
  elsif v_req.request_type = 'change_times' then
    if v_req.time_entry_id is null then
      raise exception 'change_times requires time_entry_id' using errcode = 'P0001';
    end if;
  elsif v_req.request_type = 'change_job_site' then
    if v_req.time_entry_id is null then
      raise exception 'change_job_site requires time_entry_id' using errcode = 'P0001';
    end if;
    if v_req.proposed_job_site_id is null then
      raise exception 'change_job_site requires proposed_job_site_id' using errcode = 'P0001';
    end if;
  elsif v_req.request_type = 'add_note' then
    if v_req.time_entry_id is null then
      raise exception 'add_note requires time_entry_id' using errcode = 'P0001';
    end if;
  end if;

  -- Deny path
  if p_decision = 'denied' then
    update public.time_adjustment_requests
    set status = 'denied',
        reviewed_at = v_now,
        reviewed_by = p_actor_id,
        review_note = p_review_note
    where id = p_request_id
    returning * into v_req;

    insert into public.time_events (
      organization_id, user_id, project_id, job_site_id, event_type,
      occurred_at, actor_id, source, metadata
    ) values (
      v_req.organization_id, v_req.target_user_id, v_req.project_id, v_req.job_site_id, 'adjustment',
      v_now, p_actor_id, case when v_role in ('pm','foreman') then v_role else 'admin' end,
      jsonb_build_object('request_id', v_req.id, 'decision','denied', 'request_type', v_req.request_type, 'note', p_review_note)
    );

    return jsonb_build_object('request', to_jsonb(v_req), 'decision','denied');
  end if;

  -- ========================================
  -- Load existing entry if referenced
  -- ========================================
  if v_req.time_entry_id is not null then
    select * into v_entry
    from public.time_entries
    where id = v_req.time_entry_id
      and organization_id = v_req.organization_id
    for update;

    if not found then
      raise exception 'Referenced time entry not found' using errcode = 'P0001';
    end if;

    v_prev := to_jsonb(v_entry);
    v_entry_id_to_exclude := v_entry.id;
  end if;

  -- ========================================
  -- Determine candidate time range for overlap check
  -- ========================================
  if v_req.request_type = 'add_manual_entry' then
    v_candidate_start := v_req.proposed_check_in_at;
    v_candidate_end := v_req.proposed_check_out_at;
  else
    v_candidate_start := coalesce(v_req.proposed_check_in_at, v_entry.check_in_at);
    v_candidate_end := coalesce(v_req.proposed_check_out_at, v_entry.check_out_at);
  end if;

  -- ========================================
  -- Overlap prevention
  -- ========================================
  if v_candidate_end is null then
    select exists (
      select 1 from public.time_entries e
      where e.organization_id = v_req.organization_id
        and e.user_id = v_req.target_user_id
        and e.check_out_at is null
        and (v_entry_id_to_exclude is null or e.id <> v_entry_id_to_exclude)
    ) into v_overlap_exists;
  else
    select exists (
      select 1 from public.time_entries e
      where e.organization_id = v_req.organization_id
        and e.user_id = v_req.target_user_id
        and (v_entry_id_to_exclude is null or e.id <> v_entry_id_to_exclude)
        and (
          (e.check_out_at is null and e.check_in_at < v_candidate_end)
          OR
          (e.check_out_at is not null and 
           tstzrange(e.check_in_at, e.check_out_at, '[)') && tstzrange(v_candidate_start, v_candidate_end, '[)'))
        )
    ) into v_overlap_exists;
  end if;

  if v_overlap_exists then
    update public.time_adjustment_requests
    set status = 'denied',
        reviewed_at = v_now,
        reviewed_by = p_actor_id,
        review_note = coalesce(p_review_note || ' | ', '') || 'Denied: overlapping time entry detected'
    where id = p_request_id
    returning * into v_req;

    insert into public.time_events (
      organization_id, user_id, project_id, job_site_id, event_type,
      occurred_at, actor_id, source, metadata
    ) values (
      v_req.organization_id, v_req.target_user_id, v_req.project_id, v_req.job_site_id, 'adjustment',
      v_now, p_actor_id, case when v_role in ('pm','foreman') then v_role else 'admin' end,
      jsonb_build_object('request_id', v_req.id, 'decision','denied', 'request_type', v_req.request_type, 'reason', 'overlap')
    );

    if v_entry_id_to_exclude is not null then
      insert into public.time_entry_flags (
        organization_id, time_entry_id, project_id, user_id,
        flag_code, severity, metadata, created_by, created_source
      ) values (
        v_req.organization_id, v_entry_id_to_exclude, v_req.project_id, v_req.target_user_id,
        'overlapping_entry_attempt', 'warning',
        jsonb_build_object('request_id', v_req.id),
        p_actor_id,
        case when v_role in ('pm','foreman') then 'foreman' else 'admin' end
      ) on conflict do nothing;
    end if;

    return jsonb_build_object('request', to_jsonb(v_req), 'decision','denied', 'reason', 'overlap');
  end if;

  -- ========================================
  -- Period status gates (locked/approved)
  -- ========================================
  select * into v_period
  from public.timesheet_periods
  where organization_id = v_req.organization_id
    and user_id = v_req.target_user_id
    and v_candidate_start::date between period_start and period_end
  limit 1;

  if found then
    if v_period.status = 'locked' and v_role not in ('admin','hr') then
      update public.time_adjustment_requests
      set status = 'denied',
          reviewed_at = v_now,
          reviewed_by = p_actor_id,
          review_note = coalesce(p_review_note || ' | ', '') || 'Denied: period is locked'
      where id = p_request_id
      returning * into v_req;

      insert into public.time_events (
        organization_id, user_id, project_id, job_site_id, event_type,
        occurred_at, actor_id, source, metadata
      ) values (
        v_req.organization_id, v_req.target_user_id, v_req.project_id, v_req.job_site_id, 'adjustment',
        v_now, p_actor_id, case when v_role in ('pm','foreman') then v_role else 'admin' end,
        jsonb_build_object('request_id', v_req.id, 'decision','denied', 'request_type', v_req.request_type, 'reason', 'period_locked')
      );

      return jsonb_build_object('request', to_jsonb(v_req), 'decision','denied', 'reason', 'period_locked');
    end if;

    if v_period.status = 'approved' and v_role in ('pm','foreman') then
      update public.time_adjustment_requests
      set status = 'denied',
          reviewed_at = v_now,
          reviewed_by = p_actor_id,
          review_note = coalesce(p_review_note || ' | ', '') || 'Denied: period is approved, requires HR/Admin'
      where id = p_request_id
      returning * into v_req;

      insert into public.time_events (
        organization_id, user_id, project_id, job_site_id, event_type,
        occurred_at, actor_id, source, metadata
      ) values (
        v_req.organization_id, v_req.target_user_id, v_req.project_id, v_req.job_site_id, 'adjustment',
        v_now, p_actor_id, v_role,
        jsonb_build_object('request_id', v_req.id, 'decision','denied', 'request_type', v_req.request_type, 'reason', 'period_approved_requires_hr')
      );

      return jsonb_build_object('request', to_jsonb(v_req), 'decision','denied', 'reason', 'period_approved_requires_hr');
    end if;
  end if;

  -- ========================================
  -- Apply according to request_type
  -- ========================================
  if v_req.request_type = 'add_manual_entry' then
    v_minutes := floor(extract(epoch from (v_req.proposed_check_out_at - v_req.proposed_check_in_at)) / 60);
    v_hours := round((v_minutes::numeric / 60) * 100) / 100;

    insert into public.time_entries (
      organization_id, user_id, project_id, job_site_id, project_timezone,
      check_in_at, check_out_at, duration_minutes, duration_hours,
      status, closed_by, closed_method, source, notes, is_flagged, flag_reason
    ) values (
      v_req.organization_id, v_req.target_user_id, v_req.project_id, v_req.proposed_job_site_id,
      coalesce((select default_timezone from public.organization_settings where organization_id = v_req.organization_id), 'UTC'),
      v_req.proposed_check_in_at, v_req.proposed_check_out_at, v_minutes, v_hours,
      'closed', p_actor_id, 'self', 'manual_adjustment', v_req.proposed_notes, true, 'manual_time_added'
    ) returning * into v_entry;

    v_new := to_jsonb(v_entry);
    v_flags := array_append(v_flags, 'manual_time_added');

  else
    if v_req.time_entry_id is null then
      raise exception 'Request type requires time_entry_id' using errcode = 'P0001';
    end if;

    update public.time_entries
    set
      check_in_at = coalesce(v_req.proposed_check_in_at, check_in_at),
      check_out_at = coalesce(v_req.proposed_check_out_at, check_out_at),
      job_site_id = coalesce(v_req.proposed_job_site_id, job_site_id),
      notes = coalesce(v_req.proposed_notes, notes),
      source = case when v_req.request_type in ('change_times','missed_check_in','missed_check_out') then 'manual_adjustment' else source end,
      status = case when status = 'open' and v_req.proposed_check_out_at is not null then 'closed' else status end,
      closed_by = case when closed_by is null and v_req.proposed_check_out_at is not null then p_actor_id else closed_by end,
      closed_method = case when closed_method is null and v_req.proposed_check_out_at is not null then 'self' else closed_method end
    where id = v_entry.id
    returning * into v_entry;

    if v_entry.check_out_at is not null then
      v_minutes := floor(extract(epoch from (v_entry.check_out_at - v_entry.check_in_at)) / 60);
      v_hours := round((v_minutes::numeric / 60) * 100) / 100;

      update public.time_entries
      set duration_minutes = v_minutes,
          duration_hours = v_hours
      where id = v_entry.id
      returning * into v_entry;

      if v_minutes > 720 then
        v_flags := array_append(v_flags, 'long_shift');
      end if;
    end if;

    v_new := to_jsonb(v_entry);
  end if;

  select * into v_period
  from public.timesheet_periods
  where organization_id = v_entry.organization_id
    and user_id = v_entry.user_id
    and v_entry.check_in_at::date between period_start and period_end
  limit 1;

  if found and v_period.status in ('submitted','approved','locked') then
    v_flags := array_append(v_flags, 'edited_after_submission');
  end if;

  if v_entry.job_site_id is null then
    v_flags := array_append(v_flags, 'missing_job_site');
  end if;

  update public.time_adjustment_requests
  set status = 'approved',
      reviewed_at = v_now,
      reviewed_by = p_actor_id,
      review_note = p_review_note,
      time_entry_id = coalesce(time_entry_id, v_entry.id)
  where id = p_request_id
  returning * into v_req;

  insert into public.time_events (
    organization_id, user_id, project_id, job_site_id, event_type,
    occurred_at, actor_id, source, metadata
  ) values (
    v_req.organization_id, v_req.target_user_id, v_req.project_id, coalesce(v_entry.job_site_id, v_req.job_site_id),
    'adjustment', v_now, p_actor_id,
    case when v_role in ('pm','foreman') then v_role else 'admin' end,
    jsonb_build_object('request_id', v_req.id, 'decision','approved', 'request_type', v_req.request_type, 'note', p_review_note)
  );

  insert into public.time_entry_adjustments (
    organization_id, time_entry_id, adjusted_by, adjustment_type,
    previous_values, new_values, reason, affects_pay
  ) values (
    v_req.organization_id, v_entry.id, p_actor_id, 'time_change',
    coalesce(v_prev, '{}'::jsonb), v_new,
    coalesce(p_review_note, v_req.reason),
    true
  ) returning id into v_adj_id;

  if array_length(v_flags, 1) is not null then
    insert into public.time_entry_flags (
      organization_id, time_entry_id, project_id, user_id,
      flag_code, severity, metadata, created_by, created_source
    )
    select
      v_entry.organization_id, v_entry.id, v_entry.project_id, v_entry.user_id,
      f, case when f in ('edited_after_submission') then 'critical' else 'warning' end,
      jsonb_build_object('request_id', v_req.id),
      p_actor_id,
      case when v_role in ('pm','foreman') then 'foreman' else 'admin' end
    from unnest(v_flags) as f
    on conflict do nothing;
  end if;

  return jsonb_build_object(
    'request', to_jsonb(v_req),
    'decision','approved',
    'time_entry', to_jsonb(v_entry),
    'adjustment_id', v_adj_id,
    'flags_created', to_jsonb(v_flags)
  );
end;
$$;
