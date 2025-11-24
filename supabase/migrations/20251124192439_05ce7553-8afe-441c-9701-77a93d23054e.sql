-- Part 1: Add user_id to prediction_tracking for quota enforcement
ALTER TABLE public.prediction_tracking
ADD COLUMN user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- Create index for faster quota queries
CREATE INDEX idx_prediction_tracking_user_date 
ON prediction_tracking(user_id, predicted_at);

-- Update RLS: Users can view their own predictions
CREATE POLICY "Users can view their own predictions"
ON public.prediction_tracking
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_admin());

-- Part 2: Create user plans system
CREATE TYPE public.subscription_plan AS ENUM ('free', 'premium');

CREATE TABLE public.user_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
    plan subscription_plan NOT NULL DEFAULT 'free',
    daily_prediction_limit INTEGER NOT NULL DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_plans ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own plan"
ON public.user_plans
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all plans"
ON public.user_plans
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Auto-create free plan on signup
CREATE OR REPLACE FUNCTION public.create_default_user_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_plans (user_id, plan, daily_prediction_limit)
  VALUES (NEW.id, 'free', 3);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created_create_plan
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_user_plan();

-- Backfill plans for existing users
INSERT INTO public.user_plans (user_id, plan, daily_prediction_limit)
SELECT id, 'free', 3
FROM public.profiles
WHERE id NOT IN (SELECT user_id FROM public.user_plans);

-- Update trigger for updated_at
CREATE TRIGGER update_user_plans_updated_at
  BEFORE UPDATE ON public.user_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();