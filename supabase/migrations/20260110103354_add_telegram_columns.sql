-- Add telegram_token column to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS telegram_token TEXT,
ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

-- Add index for faster telegram lookups
CREATE INDEX IF NOT EXISTS idx_users_telegram_token ON public.users(telegram_token) WHERE telegram_token IS NOT NULL;
