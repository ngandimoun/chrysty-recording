-- Forward migration: register recording worker on chrysty.dev platform

insert into public.workers (slug, name, status)
values ('recording', 'Chrysty Recording', 'active')
on conflict (slug) do update
  set name = excluded.name,
      status = excluded.status;
