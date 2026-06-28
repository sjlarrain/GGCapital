-- Add country of origin field to companies (used primarily for funds)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS country text;
