-- Forward migration: allow Safari/iOS MediaRecorder MIME types in recording-uploads

update storage.buckets
set allowed_mime_types = (
  select array_agg(distinct mime order by mime)
  from unnest(
    coalesce(allowed_mime_types, array[]::text[]) ||
    array[
      'audio/mp4',
      'audio/m4a',
      'audio/x-m4a',
      'audio/aac'
    ]::text[]
  ) as mime
)
where id = 'recording-uploads';
