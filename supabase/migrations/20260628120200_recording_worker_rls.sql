-- Forward migration: RLS on recording worker tables (service role bypasses; blocks direct anon access)

alter table recording_workspaces enable row level security;
alter table recording_sessions enable row level security;
alter table session_attachments enable row level security;
alter table knowledge_objects enable row level security;
alter table voice_history_threads enable row level security;
alter table insights_snapshots enable row level security;

-- Authenticated users can read/write their workspace rows
create policy recording_workspaces_user_select on recording_workspaces
  for select to authenticated
  using (user_id = auth.uid());

create policy recording_workspaces_user_update on recording_workspaces
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy recording_workspaces_user_insert on recording_workspaces
  for insert to authenticated
  with check (user_id = auth.uid());

-- Sessions scoped to workspace owner
create policy recording_sessions_user_select on recording_sessions
  for select to authenticated
  using (
    user_id = auth.uid()
    or workspace_id in (
      select id from recording_workspaces where user_id = auth.uid()
    )
  );

create policy recording_sessions_user_insert on recording_sessions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    or workspace_id in (
      select id from recording_workspaces where user_id = auth.uid()
    )
  );

create policy recording_sessions_user_update on recording_sessions
  for update to authenticated
  using (
    user_id = auth.uid()
    or workspace_id in (
      select id from recording_workspaces where user_id = auth.uid()
    )
  );

-- Knowledge objects via session ownership
create policy knowledge_objects_user_select on knowledge_objects
  for select to authenticated
  using (
    source_recording_id in (
      select rs.id from recording_sessions rs
      where rs.user_id = auth.uid()
         or rs.workspace_id in (
           select id from recording_workspaces where user_id = auth.uid()
         )
    )
  );

create policy knowledge_objects_user_insert on knowledge_objects
  for insert to authenticated
  with check (
    source_recording_id in (
      select rs.id from recording_sessions rs
      where rs.user_id = auth.uid()
         or rs.workspace_id in (
           select id from recording_workspaces where user_id = auth.uid()
         )
    )
  );

create policy knowledge_objects_user_update on knowledge_objects
  for update to authenticated
  using (
    source_recording_id in (
      select rs.id from recording_sessions rs
      where rs.user_id = auth.uid()
         or rs.workspace_id in (
           select id from recording_workspaces where user_id = auth.uid()
         )
    )
  );

-- Attachments via session ownership
create policy session_attachments_user_select on session_attachments
  for select to authenticated
  using (
    session_id in (
      select rs.id from recording_sessions rs
      where rs.user_id = auth.uid()
         or rs.workspace_id in (
           select id from recording_workspaces where user_id = auth.uid()
         )
    )
  );

create policy session_attachments_user_insert on session_attachments
  for insert to authenticated
  with check (
    session_id in (
      select rs.id from recording_sessions rs
      where rs.user_id = auth.uid()
         or rs.workspace_id in (
           select id from recording_workspaces where user_id = auth.uid()
         )
    )
  );

-- Voice history + insights: authenticated read (worker uses service role for writes)
create policy voice_history_threads_user_select on voice_history_threads
  for select to authenticated
  using (true);

create policy insights_snapshots_user_select on insights_snapshots
  for select to authenticated
  using (true);
