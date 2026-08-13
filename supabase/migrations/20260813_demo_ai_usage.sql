-- Notelings demo-only AI budget.
-- This is intentionally separate from private-product quotas. The setup script
-- applies it only when NOTELINGS_DEMO_PROJECT_REF is present and matches the URL.

create table if not exists public.demo_ai_usage_daily (
  usage_date date not null default current_date,
  action text not null check (action in ('categorize', 'chat')),
  requests integer not null default 0 check (requests >= 0),
  primary key (usage_date, action)
);

create or replace function public.reserve_demo_ai_usage(
  p_action text,
  p_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  reserved boolean;
begin
  if p_action not in ('categorize', 'chat') or p_limit < 1 then
    raise exception 'Invalid demo AI usage reservation';
  end if;

  insert into public.demo_ai_usage_daily (usage_date, action, requests)
  values (current_date, p_action, 1)
  on conflict (usage_date, action) do update
    set requests = public.demo_ai_usage_daily.requests + 1
    where public.demo_ai_usage_daily.requests < p_limit
  returning true into reserved;

  return coalesce(reserved, false);
end;
$$;

revoke all on table public.demo_ai_usage_daily from anon, authenticated;
revoke all on function public.reserve_demo_ai_usage(text, integer) from public, anon, authenticated;
grant usage on schema public to service_role;
grant select, insert, update, delete on public.demo_ai_usage_daily to service_role;
grant execute on function public.reserve_demo_ai_usage(text, integer) to service_role;
