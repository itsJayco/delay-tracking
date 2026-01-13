-- Add language preference to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS language VARCHAR(2) DEFAULT 'en';

COMMENT ON COLUMN public.users.language IS 'User preferred language code (en, es)';
