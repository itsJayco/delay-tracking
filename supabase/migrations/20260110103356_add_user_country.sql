-- Add country column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'CO';
