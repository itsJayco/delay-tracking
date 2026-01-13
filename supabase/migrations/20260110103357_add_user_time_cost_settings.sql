-- Add time cost calculator settings to users table
-- Migration: Add monthly_salary, work_hours, and currency columns

-- Add columns
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC(10,2) DEFAULT 4000,
ADD COLUMN IF NOT EXISTS work_hours INTEGER DEFAULT 40,
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'USD';

-- Add comments for documentation
COMMENT ON COLUMN public.users.monthly_salary IS 'User monthly salary after taxes (for time cost calculation)';
COMMENT ON COLUMN public.users.work_hours IS 'User work hours per week (for time cost calculation)';
COMMENT ON COLUMN public.users.currency IS 'User preferred currency for display';

-- Add check constraints for data validation
ALTER TABLE public.users
ADD CONSTRAINT check_monthly_salary_positive CHECK (monthly_salary >= 0),
ADD CONSTRAINT check_work_hours_range CHECK (work_hours >= 1 AND work_hours <= 168);

-- Create index for faster queries (optional, but good practice)
CREATE INDEX IF NOT EXISTS idx_users_settings ON public.users(monthly_salary, work_hours) WHERE monthly_salary IS NOT NULL;
