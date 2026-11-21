-- aplicado via MCP: coluna de agendamento do cron, gatilhos, índice de membros e retenção diária (07:10 UTC)
alter table public.peladas add column if not exists proximo_evento timestamptz;
create index if not exists peladas_proximo_evento_idx on public.peladas(proximo_evento);
create index if not exists pelada_members_user_idx on public.pelada_members(user_id);
-- op_version(): gravação sem mudança de doc não incrementa versão; só doc muda -> +1; versão explícita precisa ser +1
-- op_peladas_schedule() (op_01_schedule em peladas): mudança de doc por cliente zera proximo_evento
-- cron 'op_retencao': apaga job_run_details >7d, app_errors >30d, notifications >90d, ai_gen_log >90d
