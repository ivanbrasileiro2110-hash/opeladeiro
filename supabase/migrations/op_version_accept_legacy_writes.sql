create or replace function public.op_version() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    if new.version is not distinct from old.version then
      new.version := old.version + 1;
    elsif new.version is distinct from old.version + 1 then
      raise exception 'version_conflict' using errcode = '40001';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
