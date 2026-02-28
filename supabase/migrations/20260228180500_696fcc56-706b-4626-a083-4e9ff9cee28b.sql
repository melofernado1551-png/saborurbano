
-- Add cancellation columns to sales table
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS cancel_comment text,
  ADD COLUMN IF NOT EXISTS canceled_by text,
  ADD COLUMN IF NOT EXISTS canceled_at timestamp with time zone;
