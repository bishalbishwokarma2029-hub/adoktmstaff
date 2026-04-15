-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');

-- Consignments table
CREATE TABLE public.consignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date TEXT DEFAULT '',
  consignment_no TEXT NOT NULL DEFAULT '',
  marka TEXT DEFAULT '',
  total_ctn NUMERIC DEFAULT 0,
  cbm NUMERIC DEFAULT 0,
  gw NUMERIC DEFAULT 0,
  destination TEXT DEFAULT 'TATOPANI',
  status TEXT DEFAULT '',
  client TEXT DEFAULT '',
  remarks TEXT DEFAULT '',
  created_by TEXT DEFAULT '' NOT NULL,
  updated_by TEXT DEFAULT '' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.consignments ENABLE ROW LEVEL SECURITY;

-- Loading list entries table
CREATE TABLE public.loading_list_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date TEXT DEFAULT '',
  consignment_no TEXT NOT NULL DEFAULT '',
  marka TEXT DEFAULT '',
  total_ctn NUMERIC DEFAULT 0,
  cbm NUMERIC DEFAULT 0,
  gw NUMERIC DEFAULT 0,
  destination TEXT DEFAULT 'TATOPANI',
  status TEXT DEFAULT '',
  client TEXT DEFAULT '',
  remarks TEXT DEFAULT '',
  lot_no TEXT DEFAULT '',
  dispatched_from TEXT DEFAULT '',
  container TEXT DEFAULT '',
  arrival_date_nylam TEXT DEFAULT '',
  arrival_at_lhasa TEXT DEFAULT '',
  lhasa_container TEXT DEFAULT '',
  dispatched_from_lhasa TEXT DEFAULT '',
  kerung JSONB DEFAULT '[]'::jsonb,
  tatopani JSONB DEFAULT '[]'::jsonb,
  on_the_way NUMERIC,
  missing_ctn NUMERIC,
  remaining_ctn_nylam NUMERIC,
  follow_up BOOLEAN DEFAULT false,
  origin TEXT NOT NULL DEFAULT 'guangzhou',
  created_by TEXT DEFAULT '' NOT NULL,
  updated_by TEXT DEFAULT '' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.loading_list_entries ENABLE ROW LEVEL SECURITY;

-- Old Nylam goods table
CREATE TABLE public.old_nylam_goods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date TEXT DEFAULT '',
  consignment_no TEXT NOT NULL DEFAULT '',
  marka TEXT DEFAULT '',
  total_ctn NUMERIC DEFAULT 0,
  ctn_remaining_nylam NUMERIC DEFAULT 0,
  loaded_ctn NUMERIC DEFAULT 0,
  cbm NUMERIC DEFAULT 0,
  gw NUMERIC DEFAULT 0,
  destination TEXT DEFAULT '',
  dispatched_from_nylam TEXT DEFAULT '',
  nylam_container TEXT DEFAULT '',
  arrival_location TEXT DEFAULT '',
  arrival_date TEXT DEFAULT '',
  client TEXT DEFAULT '',
  follow_up BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.old_nylam_goods ENABLE ROW LEVEL SECURITY;

-- Remaining CTNs table
CREATE TABLE public.remaining_ctns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date TEXT DEFAULT '',
  consignment_no TEXT NOT NULL DEFAULT '',
  marka TEXT DEFAULT '',
  total_ctn NUMERIC DEFAULT 0,
  cbm NUMERIC DEFAULT 0,
  gw NUMERIC DEFAULT 0,
  destination TEXT DEFAULT '',
  remaining_ctn NUMERIC DEFAULT 0,
  remaining_ctn_location TEXT DEFAULT '',
  client TEXT DEFAULT '',
  created_by TEXT DEFAULT '' NOT NULL,
  updated_by TEXT DEFAULT '' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.remaining_ctns ENABLE ROW LEVEL SECURITY;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles table
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(_user_id, 'admin') $$;

-- Auto-create profile and assign admin to first user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE user_count INTEGER;
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'staff');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Profiles RLS
CREATE POLICY "Authenticated users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- User roles RLS
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Data table RLS policies
CREATE POLICY "Auth read consignments" ON public.consignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert consignments" ON public.consignments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update consignments" ON public.consignments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin delete consignments" ON public.consignments FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Auth read loading_list_entries" ON public.loading_list_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert loading_list_entries" ON public.loading_list_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update loading_list_entries" ON public.loading_list_entries FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin delete loading_list_entries" ON public.loading_list_entries FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Auth read old_nylam_goods" ON public.old_nylam_goods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert old_nylam_goods" ON public.old_nylam_goods FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update old_nylam_goods" ON public.old_nylam_goods FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin delete old_nylam_goods" ON public.old_nylam_goods FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Auth read remaining_ctns" ON public.remaining_ctns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert remaining_ctns" ON public.remaining_ctns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update remaining_ctns" ON public.remaining_ctns FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin delete remaining_ctns" ON public.remaining_ctns FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.consignments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.loading_list_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.old_nylam_goods;
ALTER PUBLICATION supabase_realtime ADD TABLE public.remaining_ctns;