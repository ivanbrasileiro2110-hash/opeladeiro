-- políticas RLS reescritas para (select auth.uid()) e índices nas chaves estrangeiras (aplicado via migração)
create index if not exists camps_owner_idx on public.camps(owner);
create index if not exists images_owner_idx on public.images(owner);
create index if not exists peladas_owner_idx on public.peladas(owner);
create index if not exists reports_reporter_idx on public.reports(reporter);
