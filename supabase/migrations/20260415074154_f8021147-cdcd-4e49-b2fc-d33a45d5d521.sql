
-- Add updated_by and file_url to recent_loading_lists
ALTER TABLE public.recent_loading_lists
  ADD COLUMN IF NOT EXISTS updated_by uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS file_url text DEFAULT NULL;

-- Add updated_by to important_notes
ALTER TABLE public.important_notes
  ADD COLUMN IF NOT EXISTS updated_by uuid DEFAULT NULL;

-- Create storage bucket for attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for attachments bucket
CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'attachments');

CREATE POLICY "Anyone can view attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'attachments');

CREATE POLICY "Authenticated users can delete attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'attachments');
