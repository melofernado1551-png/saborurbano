
-- Add delivery confirmation fields to sales
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS delivery_code TEXT,
ADD COLUMN IF NOT EXISTS delivered_confirmed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS delivered_confirmed_by TEXT;

-- Function to generate a unique 6-digit delivery code
CREATE OR REPLACE FUNCTION public.generate_delivery_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _code TEXT;
  _exists BOOLEAN;
BEGIN
  -- Only generate code when transitioning TO 'delivering'
  IF NEW.operational_status = 'delivering' AND (OLD.operational_status IS DISTINCT FROM 'delivering') AND NEW.delivery_code IS NULL THEN
    LOOP
      _code := LPAD(FLOOR(RANDOM() * 999999 + 1)::TEXT, 6, '0');
      SELECT EXISTS(
        SELECT 1 FROM public.sales 
        WHERE delivery_code = _code 
        AND active = true 
        AND operational_status NOT IN ('finished', 'cancelled')
      ) INTO _exists;
      EXIT WHEN NOT _exists;
    END LOOP;
    NEW.delivery_code := _code;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for delivery code generation
DROP TRIGGER IF EXISTS trg_generate_delivery_code ON public.sales;
CREATE TRIGGER trg_generate_delivery_code
BEFORE UPDATE ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.generate_delivery_code();
