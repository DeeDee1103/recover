-- Add branding columns to merchants
ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#112E2A',
  ADD COLUMN IF NOT EXISTS accent_color text DEFAULT '#C5862F',
  ADD COLUMN IF NOT EXISTS email_footer_text text;

-- Create storage bucket for merchant logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: merchants can upload/read their own logos (folder = merchant id)
CREATE POLICY "Merchants can upload logos" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = (
      SELECT id::text FROM public.merchants WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Merchants can update logos" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = (
      SELECT id::text FROM public.merchants WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can read logos" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'logos');

CREATE POLICY "Merchants can delete logos" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = (
      SELECT id::text FROM public.merchants WHERE auth_user_id = auth.uid()
    )
  );
