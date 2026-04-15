
-- Recent loading lists table (for pasted/uploaded excel data)
CREATE TABLE public.recent_loading_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  data JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recent_loading_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view recent_loading_lists"
  ON public.recent_loading_lists FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert recent_loading_lists"
  ON public.recent_loading_lists FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update recent_loading_lists"
  ON public.recent_loading_lists FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete recent_loading_lists"
  ON public.recent_loading_lists FOR DELETE TO authenticated USING (true);

-- Important notes table
CREATE TABLE public.important_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  attachments JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.important_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view important_notes"
  ON public.important_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert important_notes"
  ON public.important_notes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update important_notes"
  ON public.important_notes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete important_notes"
  ON public.important_notes FOR DELETE TO authenticated USING (true);
