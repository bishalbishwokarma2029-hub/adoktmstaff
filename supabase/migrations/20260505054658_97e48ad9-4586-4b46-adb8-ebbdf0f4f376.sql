ALTER TABLE public.loading_list_entries
  ADD COLUMN IF NOT EXISTS loaded_ctns numeric,
  ADD COLUMN IF NOT EXISTS received_ctn_lhasa numeric,
  ADD COLUMN IF NOT EXISTS received_ctn_nylam numeric;