-- Create table to store Upstox OAuth tokens
CREATE TABLE IF NOT EXISTS public.upstox_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expiry TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE public.upstox_tokens ENABLE ROW LEVEL SECURITY;

-- Policies for upstox_tokens
CREATE POLICY "Users can view their own tokens"
  ON public.upstox_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tokens"
  ON public.upstox_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tokens"
  ON public.upstox_tokens
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_upstox_tokens_updated_at
  BEFORE UPDATE ON public.upstox_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();