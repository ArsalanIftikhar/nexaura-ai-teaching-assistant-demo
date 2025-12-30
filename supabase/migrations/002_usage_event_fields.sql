alter table public.usage_events
  add column if not exists status text,
  add column if not exists repair_used boolean default false,
  add column if not exists topic_len integer,
  add column if not exists notes_len integer,
  add column if not exists student_text_len integer;
