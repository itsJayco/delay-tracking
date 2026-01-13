# Delay Scripts

This directory contains scripts for database seeding and automated price tracking.

## 📦 Product Seeding

Populate the database with popular products before MVP launch.

### Quick Start

1. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your Supabase credentials
   ```

2. **Run dry-run** (test without inserting):
   ```bash
   pnpm seed:products -- --dry-run
   ```

3. **Seed from CSV file** (recommended):
   ```bash
   pnpm seed:products -- --csv path/to/products.csv --count 100
   ```

### CSV Import (Recommended)

If you have a CSV file with product URLs (e.g., from Web Scraper extension):

1. Export your scraped data as CSV
2. Ensure it has a column named `url`, `link`, or `permalink`
3. **Important**: URLs must be individual product pages, not category/listing pages
4. Run the import:
   ```bash
   pnpm seed:products -- --csv products.csv
   ```

### Valid URL Examples

✅ **Good** (individual products):
- `https://articulo.mercadolibre.com.co/MCO-123456789-product-name`
- `https://www.amazon.com/-/es/dp/B08N5WRWNW`
- `https://www.exito.com/producto-123456`

❌ **Bad** (category/listing pages):
- `https://www.mercadolibre.com.co/mas-vendidos/MCO1051`
- `https://listado.mercadolibre.com.co/electronics`
- `https://www.amazon.com/s?k=laptop`

## 🤖 Intelligent Price Tracking

Automatically track product prices with priority-based scheduling.

### How It Works

The tracking system uses **intelligent prioritization** to stay within GitHub Actions free tier (2,000 min/month):

- 🔴 **HIGH Priority** (2x/day): Products with watchlists or recently visited
- 🟡 **MEDIUM Priority** (1x/day): Products with price changes in last 7 days
- 🟢 **LOW Priority** (1x/week): Stable products with no recent changes
- ⚪ **INACTIVE** (1x/month): Products not visited in 30+ days

### Manual Tracking

Track prices locally:

```bash
# Track all high-priority products
pnpm track:prices

# Track specific merchant
pnpm track:prices -- --merchant mercadolibre

# Limit number of products
pnpm track:prices -- --limit 50

# Adjust concurrency (parallel pages)
pnpm track:prices -- --concurrency 5
```

### Automated Tracking (GitHub Actions)

The system runs automatically 2x daily via GitHub Actions:

1. **Set up secrets** in your GitHub repository:
   - `SUPABASE_URL`: Your production Supabase URL
   - `SUPABASE_ANON_KEY`: Your production anon key

2. **Workflow runs automatically**:
   - 9 AM Colombia Time (2 PM UTC)
   - 9 PM Colombia Time (2 AM UTC next day)

3. **Manual trigger** (optional):
   - Go to Actions → Intelligent Price Tracking
   - Click "Run workflow"
   - Set custom limit or merchant

### Monitoring

- **GitHub Actions**: View logs in Actions tab
- **Supabase Dashboard**: Check `price_snapshots` table
- **Extension**: Users see updated prices automatically

## 📊 Architecture

```
scripts/
├── seed-products.ts              # Product seeding orchestrator
├── track-prices.ts               # Intelligent price tracking
├── scrapers/
│   ├── mercadolibre.ts          # ML scraper
│   ├── webscraper-csv.ts        # Web Scraper CSV parser
│   ├── url-list-import.ts       # URL-only CSV parser
│   └── fetch-product-data.ts    # Product data fetcher
└── utils/
    ├── db.ts                     # Database utilities
    └── tracking-priority.ts      # Priority calculation logic
```

## 🚀 Scaling

See `docs/PRODUCT_OVERVIEW.md` → Production Deployment Checklist for:
- Cost projections for different product volumes
- Optimization techniques
- Migration paths when scaling beyond free tier
