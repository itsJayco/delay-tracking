-- Initial schema creation for Delay extension
-- Creates base tables: users, products, user_products, price_snapshots

-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    email TEXT,
    is_anonymous BOOLEAN DEFAULT true
);

-- Create products table
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    merchant TEXT NOT NULL,
    original_url TEXT NOT NULL,
    normalized_url TEXT NOT NULL,
    product_hash TEXT NOT NULL UNIQUE,
    title TEXT,
    currency TEXT DEFAULT 'USD',
    is_active BOOLEAN DEFAULT true
);

-- Create user_products junction table
CREATE TABLE IF NOT EXISTS public.user_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'observing',
    last_viewed_at TIMESTAMP WITH TIME ZONE,
    notification_enabled BOOLEAN DEFAULT true,
    UNIQUE(user_id, product_id)
);

-- Create price_snapshots table
CREATE TABLE IF NOT EXISTS public.price_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    price NUMERIC NOT NULL,
    currency TEXT NOT NULL,
    source TEXT DEFAULT 'scrape'
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_hash ON public.products(product_hash);
CREATE INDEX IF NOT EXISTS idx_user_products_user ON public.user_products(user_id);
CREATE INDEX IF NOT EXISTS idx_user_products_product ON public.user_products(product_id);
CREATE INDEX IF NOT EXISTS idx_price_snapshots_product ON public.price_snapshots(product_id);
CREATE INDEX IF NOT EXISTS idx_price_snapshots_created ON public.price_snapshots(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_snapshots ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for now, can be restricted later)
CREATE POLICY "Allow all on users" ON public.users FOR ALL USING (true);
CREATE POLICY "Allow all on products" ON public.products FOR ALL USING (true);
CREATE POLICY "Allow all on user_products" ON public.user_products FOR ALL USING (true);
CREATE POLICY "Allow all on price_snapshots" ON public.price_snapshots FOR ALL USING (true);
