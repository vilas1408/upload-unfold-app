-- Add approval fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN mobile_number text,
ADD COLUMN date_of_birth date,
ADD COLUMN is_approved boolean DEFAULT false NOT NULL,
ADD COLUMN approved_at timestamp with time zone,
ADD COLUMN approved_by uuid;

-- Create index for faster approval queries
CREATE INDEX idx_profiles_is_approved ON public.profiles(is_approved);

-- Create a function to check if user is approved (for use in frontend)
CREATE OR REPLACE FUNCTION public.is_user_approved(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(is_approved, false)
  FROM public.profiles
  WHERE id = user_id;
$$;