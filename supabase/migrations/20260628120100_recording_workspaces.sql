-- Forward migration: recording workspaces + session scoping

create extension if not exists "pgcrypto";

create table if not exists recording_workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  platform_workspace_id uuid references worker_workspaces(id) on delete set null,
  name text not null default 'My Sessions',
  visitor_token text not null default ('vis_' || replace(gen_random_uuid()::text, '-', '')),
  recording_key text not null,
  settings jsonb not null default '{}',
  is_default boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists recording_workspaces_visitor_token_unique
  on recording_workspaces(visitor_token);

create unique index if not exists recording_workspaces_recording_key_unique
  on recording_workspaces(recording_key);

create index if not exists recording_workspaces_user_id_idx
  on recording_workspaces(user_id);

create unique index if not exists recording_workspaces_user_default_unique
  on recording_workspaces(user_id) where is_default = true and user_id is not null;

alter table recording_sessions
  add column if not exists workspace_id uuid references recording_workspaces(id) on delete set null,
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists recording_key text;

create index if not exists recording_sessions_workspace_id_idx
  on recording_sessions(workspace_id);

create index if not exists recording_sessions_recording_key_idx
  on recording_sessions(recording_key);

drop trigger if exists recording_workspaces_set_updated_at on recording_workspaces;
create trigger recording_workspaces_set_updated_at
  before update on recording_workspaces
  for each row execute function public.set_updated_at();
