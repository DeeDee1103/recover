-- Add text_color column to merchants for personalization
ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS text_color text DEFAULT '#000000';
