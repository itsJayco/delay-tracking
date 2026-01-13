# Delay Price Tracking System

Intelligent, priority-based price tracking system that stays within GitHub Actions free tier.

## Features

-  **Smart Prioritization**: Tracks products based on user activity
-  **Automated**: Runs 2x daily via GitHub Actions  
-  **Cost-Effective**: Optimized to stay within free tier (2,000 min/month)
-  **Scalable**: Handles 500-1,000 products efficiently

## Quick Start

1. **Install dependencies**:
   `ash
   pnpm install
   `

2. **Configure environment**:
   `ash
   cp .env.example .env
   # Edit .env with your Supabase credentials
   `

3. **Seed products**:
   `ash
   pnpm seed:products -- --csv your-products.csv --count 100
   `

4. **Track prices**:
   `ash
   pnpm track:prices -- --limit 50
   `

## Documentation

- [Tracking Guide](docs/TRACKING.md)
- [Production Deployment](docs/PRODUCT_OVERVIEW.md)

## GitHub Actions Setup

1. Add secrets to your repository:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

2. Workflow runs automatically 2x daily

## License

MIT
