-- Add tracking metadata columns to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS last_tracked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS tracking_enabled BOOLEAN DEFAULT true;

-- Create product_views table for tracking when users view products
CREATE TABLE IF NOT EXISTS product_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  anonymous_user_id TEXT,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_product_views_product_id ON product_views(product_id);
CREATE INDEX IF NOT EXISTS idx_product_views_viewed_at ON product_views(viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_last_tracked ON products(last_tracked_at);
CREATE INDEX IF NOT EXISTS idx_products_tracking_enabled ON products(tracking_enabled) WHERE tracking_enabled = true;

-- Add comment
COMMENT ON COLUMN products.last_tracked_at IS 'Last time price was tracked by automated system';
COMMENT ON COLUMN products.tracking_enabled IS 'Whether this product should be included in automated tracking';
COMMENT ON TABLE product_views IS 'Tracks when users view products for intelligent tracking prioritization';
