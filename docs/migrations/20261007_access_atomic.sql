-- Review and apply in a staging Supabase database before releasing this code.
-- No production migration has been performed by the repository change.
begin;

create table if not exists public.access_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.access_settings enable row level security;
revoke all on table public.access_settings from public, anon, authenticated;
grant select, insert, update, delete on table public.access_settings to service_role;

create or replace function public.be_good_put_if_absent(p_input jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare current_value jsonb; inserted_count integer;
begin
  insert into public.access_settings(key,value,updated_at)
    values(p_input->>'key',p_input->'value',now()) on conflict(key) do nothing;
  get diagnostics inserted_count = row_count;
  select value into current_value from public.access_settings where key=p_input->>'key';
  return jsonb_build_object('created',inserted_count=1,'value',current_value);
end $$;

create or replace function public.be_good_compare_and_set(p_input jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare current_value jsonb; updated_count integer;
begin
  update public.access_settings set value=p_input->'value',updated_at=now()
    where key=p_input->>'key' and value=p_input->'expected' returning value into current_value;
  get diagnostics updated_count = row_count;
  if updated_count=0 then select value into current_value from public.access_settings where key=p_input->>'key'; end if;
  return jsonb_build_object('updated',updated_count=1,'value',current_value);
end $$;

create or replace function public.be_good_append_workshop_feedback(p_input jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare workshop jsonb; entries jsonb; prior jsonb; entry jsonb;
begin
  select value into workshop from public.access_settings where key='wf:'||(p_input->>'workshopId') for update;
  if workshop is null then return jsonb_build_object('error','no such workshop','status',404); end if;
  entries=coalesce(workshop->'entries','[]'::jsonb);
  select value into prior from jsonb_array_elements(entries) where value->>'submissionId'=p_input->>'submissionId';
  if prior is not null then
    if prior->'entry' is distinct from p_input->'entry'->'entry' or prior->'role' is distinct from p_input->'entry'->'role' then
      return jsonb_build_object('error','submission_conflict','status',409);
    end if;
    return jsonb_build_object('ok',true,'duplicate',true);
  end if;
  if jsonb_array_length(entries)>=(p_input->>'maxEntries')::integer then return jsonb_build_object('error','full','status',429); end if;
  entry=(p_input->'entry')||jsonb_build_object('submissionId',p_input->>'submissionId');
  update public.access_settings set value=jsonb_set(workshop,'{entries}',entries||jsonb_build_array(entry)),updated_at=now()
    where key='wf:'||(p_input->>'workshopId');
  return jsonb_build_object('ok',true,'duplicate',false);
end $$;

create or replace function public.be_good_open_workshop(p_input jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare workshop jsonb; prior jsonb; code text; taken jsonb;
begin
  workshop=p_input->'workshop';code=p_input->>'code';
  if code<>'' then perform pg_advisory_xact_lock(hashtextextended('begood-workshop-code:'||code,0)); end if;
  perform pg_advisory_xact_lock(hashtextextended('begood-workshop:'||(workshop->>'w'),0));
  select value into prior from public.access_settings where key='wf:'||(workshop->>'w') for update;
  if prior is not null then
    if prior->>'ownerId' is distinct from workshop->>'ownerId' or prior->>'tenantId' is distinct from workshop->>'tenantId' then
      return jsonb_build_object('error','unauthorized','status',403);
    end if;
    return jsonb_build_object('existed',true);
  end if;
  if code<>'' then
    select value into taken from public.access_settings where key='wfc:'||code for update;
    if taken is not null and (taken->>'at')::timestamptz>(p_input->>'now')::timestamptz-interval '24 hours' then
      return jsonb_build_object('error','code taken','status',409);
    end if;
  end if;
  insert into public.access_settings(key,value,updated_at) values('wf:'||(workshop->>'w'),workshop,now());
  if code<>'' then
    insert into public.access_settings(key,value,updated_at) values('wfc:'||code,jsonb_build_object('w',workshop->>'w','at',p_input->>'now'),now())
      on conflict(key) do update set value=excluded.value,updated_at=excluded.updated_at;
  end if;
  return jsonb_build_object('existed',false);
end $$;

create or replace function public.be_good_reserve_ai_usage(p_input jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare prior jsonb; rec jsonb; quota jsonb; code_key text; budget integer;
  owner_active integer; tenant_active integer; owner_daily integer; tenant_daily integer;
  owner_tokens bigint; tenant_tokens bigint; code_pending integer; sid_pending integer; seats_taken integer;
begin
  -- Every owner in a tenant shares this database lock, including across workers.
  perform pg_advisory_xact_lock(hashtextextended('begood-tenant:'||(p_input->>'tenantId'),0));
  quota=p_input->'quota';code_key=quota->>'codeKey';budget=(p_input->>'tokenBudget')::integer;
  if code_key is not null then perform pg_advisory_xact_lock(hashtextextended('begood-code:'||code_key,0)); end if;
  -- Reclaim expired reservations under the same lock that protects capacity.
  update public.access_settings set value=value||jsonb_build_object('state','released','settledAt',p_input->>'now'),updated_at=now()
    where key like 'aiq:%' and value->>'tenantId'=p_input->>'tenantId' and value->>'state'='reserved'
      and (value->>'expiresAt')::timestamptz<=(p_input->>'now')::timestamptz;
  select value into prior from public.access_settings where key=p_input->>'reservationKey';
  if prior is not null then
    if prior->>'ownerId'<>p_input->>'ownerId' or prior->>'tenantId'<>p_input->>'tenantId'
      or prior->>'requestHash'<>p_input->>'requestHash' or prior->'maxTokens'<>p_input->'maxTokens' or prior->'tokenBudget'<>p_input->'tokenBudget' then
      return jsonb_build_object('error','idempotency_conflict','status',409);
    end if;
    return prior||jsonb_build_object('duplicate',true);
  end if;
  select count(*) filter(where value->>'ownerId'=p_input->>'ownerId' and value->>'state'='reserved'),
    count(*) filter(where value->>'state'='reserved'),
    count(*) filter(where value->>'ownerId'=p_input->>'ownerId' and left(value->>'createdAt',10)=left(p_input->>'now',10)),
    count(*) filter(where left(value->>'createdAt',10)=left(p_input->>'now',10)),
    coalesce(sum((value->>'tokenBudget')::bigint) filter(where value->>'ownerId'=p_input->>'ownerId' and left(value->>'createdAt',10)=left(p_input->>'now',10)),0),
    coalesce(sum((value->>'tokenBudget')::bigint) filter(where left(value->>'createdAt',10)=left(p_input->>'now',10)),0)
    into owner_active,tenant_active,owner_daily,tenant_daily,owner_tokens,tenant_tokens
    -- Released/expired attempts retain daily request and worst-case cost usage.
    -- Only the active counters above filter by reserved state.
    from public.access_settings where key like 'aiq:%' and value->>'tenantId'=p_input->>'tenantId';
  if owner_active >= (p_input->'limits'->>'concurrent')::integer or tenant_active >= (p_input->'limits'->>'tenantConcurrent')::integer
    or owner_daily >= (p_input->'limits'->>'dailyRequests')::integer or tenant_daily >= (p_input->'limits'->>'tenantDailyRequests')::integer
    or owner_tokens+budget > (p_input->'limits'->>'dailyTokens')::bigint or tenant_tokens+budget > (p_input->'limits'->>'tenantDailyTokens')::bigint then
    return jsonb_build_object('error','quota_exceeded','status',429);
  end if;
  if code_key is not null then
    select value into rec from public.access_settings where key=code_key for update;
    if rec is null or coalesce((rec->>'revoked')::boolean,false) or rec->>'inst'<>p_input->>'tenantId' then return jsonb_build_object('error','revoked','status',403); end if;
    select count(*),count(*) filter(where value->'quota'->>'sid'=quota->>'sid') into code_pending,sid_pending
      from public.access_settings where key like 'aiq:%' and value->'quota'->>'codeKey'=code_key and value->>'state'='reserved'
        and (value->>'expiresAt')::timestamptz>(p_input->>'now')::timestamptz;
    if quota->>'kind'='student' and coalesce((rec->>'uses')::integer,0)+code_pending >= (rec->>'maxUses')::integer then
      return jsonb_build_object('error','used-up','status',429);
    end if;
    if quota->>'kind'='course' then
      if coalesce((rec->'taken'->>(quota->>'sid'))::integer,0)+sid_pending >= (rec->>'usesPer')::integer then
        return jsonb_build_object('error','used-up','status',429);
      end if;
      select count(distinct sid) into seats_taken from (
        select jsonb_object_keys(coalesce(rec->'taken','{}'::jsonb)) as sid
        union all select value->'quota'->>'sid' from public.access_settings
          where key like 'aiq:%' and value->'quota'->>'codeKey'=code_key and value->>'state'='reserved'
            and (value->>'expiresAt')::timestamptz>(p_input->>'now')::timestamptz
      ) as occupied;
      if not (coalesce(rec->'taken','{}'::jsonb) ? (quota->>'sid')) and sid_pending=0 and seats_taken >= (rec->>'seats')::integer then
        return jsonb_build_object('error','full','status',429);
      end if;
    end if;
  end if;
  rec=jsonb_build_object('type','ai-usage','ownerId',p_input->>'ownerId','tenantId',p_input->>'tenantId','requestId',p_input->>'requestId',
    'requestHash',p_input->>'requestHash','maxTokens',p_input->'maxTokens','tokenBudget',budget,'quota',quota,'state','reserved','createdAt',p_input->>'now','expiresAt',p_input->>'expiresAt');
  insert into public.access_settings(key,value,updated_at) values(p_input->>'reservationKey',rec,now());
  return rec||jsonb_build_object('duplicate',false);
end $$;

create or replace function public.be_good_settle_ai_usage(p_input jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare reservation jsonb; rec jsonb; quota jsonb; code_key text; outcome text; uses integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('begood-tenant:'||(p_input->>'tenantId'),0));
  select value into reservation from public.access_settings where key=p_input->>'reservationKey' for update;
  if reservation is null or reservation->>'ownerId'<>p_input->>'ownerId' or reservation->>'tenantId'<>p_input->>'tenantId' then
    return jsonb_build_object('error','reservation_missing','status',409);
  end if;
  if reservation->>'state'<>'reserved' then
    if p_input->>'outcome'='commit' and reservation->>'state'<>'committed' then return jsonb_build_object('error','reservation_closed','status',409); end if;
    return reservation||jsonb_build_object('duplicate',true);
  end if;
  if (reservation->>'expiresAt')::timestamptz<=(p_input->>'now')::timestamptz then
    update public.access_settings set value=reservation||jsonb_build_object('state','released'),updated_at=now() where key=p_input->>'reservationKey';
    return jsonb_build_object('error','reservation_expired','status',409);
  end if;
  outcome=p_input->>'outcome';
  if outcome not in ('commit','release') then return jsonb_build_object('error','bad_settlement','status',400); end if;
  quota=reservation->'quota';code_key=quota->>'codeKey';
  if outcome='commit' and code_key is not null then
    perform pg_advisory_xact_lock(hashtextextended('begood-code:'||code_key,0));
    select value into rec from public.access_settings where key=code_key for update;
    if rec is null or coalesce((rec->>'revoked')::boolean,false) then return jsonb_build_object('error','revoked','status',403); end if;
    uses=coalesce((rec->>'uses')::integer,0);
    if quota->>'kind'='student' then
      if uses >= (rec->>'maxUses')::integer then return jsonb_build_object('error','used-up','status',429); end if;
      rec=jsonb_set(rec,'{uses}',to_jsonb(uses+1));
    elsif quota->>'kind'='course' then
      if coalesce((rec->'taken'->>(quota->>'sid'))::integer,0) >= (rec->>'usesPer')::integer then return jsonb_build_object('error','used-up','status',429); end if;
      rec=jsonb_set(rec,'{taken}',coalesce(rec->'taken','{}'::jsonb)||jsonb_build_object(quota->>'sid',coalesce((rec->'taken'->>(quota->>'sid'))::integer,0)+1));
      rec=jsonb_set(rec,'{uses}',to_jsonb(uses+1));
    end if;
    update public.access_settings set value=rec,updated_at=now() where key=code_key;
  end if;
  reservation=reservation||jsonb_build_object('state',case when outcome='commit' then 'committed' else 'released' end,'settledAt',p_input->>'now');
  update public.access_settings set value=reservation,updated_at=now() where key=p_input->>'reservationKey';
  return reservation||jsonb_build_object('duplicate',false);
end $$;

create or replace function public.be_good_finalize_ai_job(p_input jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare current_value jsonb; usage jsonb; principal jsonb;
begin
  -- Take the tenant lock first, matching reservation/settlement lock order.
  principal=p_input->'principal';
  perform pg_advisory_xact_lock(hashtextextended('begood-tenant:'||(principal->>'tenantId'),0));
  select value into current_value from public.access_settings where key=p_input->>'key' for update;
  if current_value is distinct from p_input->'expected' then return jsonb_build_object('updated',false,'value',current_value); end if;
  if current_value->>'ownerId' is distinct from principal->>'ownerId' or current_value->>'tenantId' is distinct from principal->>'tenantId'
    or p_input->'value'->>'ownerId' is distinct from principal->>'ownerId' or p_input->'value'->>'tenantId' is distinct from principal->>'tenantId' then
    return jsonb_build_object('error','unauthorized','status',403);
  end if;
  usage=public.be_good_settle_ai_usage(jsonb_build_object('ownerId',principal->>'ownerId','tenantId',principal->>'tenantId','requestId',p_input->>'requestId',
    'reservationKey',p_input->>'reservationKey','outcome',p_input->>'outcome','now',p_input->>'now'));
  if usage ? 'error' then return usage; end if;
  update public.access_settings set value=p_input->'value',updated_at=now() where key=p_input->>'key';
  return jsonb_build_object('updated',true,'value',p_input->'value','usage',usage);
end $$;

-- Definer RPCs are server-only. Never grant these functions to browser roles.
revoke all on function public.be_good_put_if_absent(jsonb) from public, anon, authenticated;
revoke all on function public.be_good_compare_and_set(jsonb) from public, anon, authenticated;
revoke all on function public.be_good_append_workshop_feedback(jsonb) from public, anon, authenticated;
revoke all on function public.be_good_open_workshop(jsonb) from public, anon, authenticated;
revoke all on function public.be_good_reserve_ai_usage(jsonb) from public, anon, authenticated;
revoke all on function public.be_good_settle_ai_usage(jsonb) from public, anon, authenticated;
revoke all on function public.be_good_finalize_ai_job(jsonb) from public, anon, authenticated;
grant execute on function public.be_good_put_if_absent(jsonb) to service_role;
grant execute on function public.be_good_compare_and_set(jsonb) to service_role;
grant execute on function public.be_good_append_workshop_feedback(jsonb) to service_role;
grant execute on function public.be_good_open_workshop(jsonb) to service_role;
grant execute on function public.be_good_reserve_ai_usage(jsonb) to service_role;
grant execute on function public.be_good_settle_ai_usage(jsonb) to service_role;
grant execute on function public.be_good_finalize_ai_job(jsonb) to service_role;

create index if not exists access_settings_ai_usage_tenant on public.access_settings ((value->>'tenantId'),(value->>'state')) where key like 'aiq:%';
commit;
