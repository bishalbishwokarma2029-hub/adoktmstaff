ALTER TABLE public.loading_list_entries
ADD COLUMN IF NOT EXISTS lhasa jsonb DEFAULT '[]'::jsonb;