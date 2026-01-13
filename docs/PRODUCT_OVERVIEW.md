# Delay - Product Overview

## Tagline
**"Shop smarter, not faster"**

---

## What is Delay?

Delay is a browser extension that helps users make smarter purchasing decisions by encouraging them to think before buying. Instead of rushing into purchases, Delay helps users decide whether to buy now or wait for a better price.

### Core Philosophy
The extension is built on the principle that **waiting and being informed leads to better purchasing decisions** than impulse buying.

---

## Core Features

### 1. **Price Tracking & Smart Recommendations** 🎯
**The Foundation of Delay**

- Tracks product prices across multiple stores
- Provides intelligent buy/wait recommendations based on price history
- Notifies users when tracked products drop in price
- Helps users decide: "Buy now or wait for a better deal?"

**Status**: ✅ Core functionality implemented

---

### 2. **Multi-Store Support** 🏪

- Works across different e-commerce platforms
- Unified tracking experience regardless of the store
- Adapters for various stores (Amazon, eBay, MercadoLibre, etc.)

**Status**: ✅ Implemented (some adapters need refinement)

---

### 3. **Dual Notification System** 🔔

**Telegram Notifications**:
- Instant price drop alerts on mobile
- Link extension with Telegram bot using unique code
- Fast, private, works on any device

**Browser Notifications**:
- Native browser alerts for price changes
- Works without additional setup

**Status**: ✅ Telegram integration active, browser notifications active

---

### 4. **Dynamic View States** 📊

Different UI states based on available data:
- Product detected with full history
- Product detected with partial data
- Store homepage detected
- No product detected
- Loading states
- Error states

**Status**: ✅ Implemented with smooth transitions

---

### 5. **Anti-Impulse Shield Mode** 🛡️

- Injects an overlay message asking: "Do you really need this?"
- Blocks "Buy Now" buttons when activated
- Adds a moment of reflection before purchase
- Helps prevent impulse buying

**Status**: ✅ Implemented, toggle in Settings

---

### 6. **Watchlist / Product Tracking** 📋

- Users can track products they've viewed
- See price history for tracked items
- Get notifications when prices drop
- Manage tracked products from dashboard

**Status**: ✅ Active tracking system

---

### 7. **Hours of Life Calculator** ⏰💰

**The "True Cost" Feature**

Shows how many hours of work a product costs based on:
- User's monthly salary (after taxes)
- Work hours per week
- Automatic hourly rate calculation

**Example**: 
- User earns $4,000/month, works 40 hours/week
- Extension calculates: ~$25/hour
- $100 product = "4 hours of your life"

**Status**: 🚧 In progress (personalizable data being implemented)

---

### 8. **Background Price Tracking** 🔄

**Offscreen Document Implementation**

- Tracks product prices while browser is open
- Runs in background without user interaction
- Continuous monitoring for price changes
- No need to keep tabs open

**Status**: 🚧 Currently implementing

**Future**: Exploring free tracking solutions for when browser is closed

---

### 9. **Affiliate Integration** 💼

**Internal Monetization Strategy**

- Applies coupons and discounts from affiliate programs
- Redirects to affiliate URLs when available
- Helps users save money while generating revenue
- Works with platforms that have affiliate programs

**Status**: 🚧 In progress (needs refinement and optimization)

---

### 10. **Multi-Store Price Comparison** 🔍

- Compare the same product across different stores
- Find the best price available
- See which store has the best deal

**Status**: 🚧 Needs adjustment and proper definition

---

## Upcoming Features

### 11. **Internationalization (i18n)** 🌍

- Multi-language support
- Localized currency and formats
- Broader market reach

**Status**: 📅 Planned

---

## Technical Architecture

### Extension Components

1. **Popup** (400px width)
   - Main user interface
   - Settings configuration
   - Product information display
   - Watchlist management

2. **Content Scripts**
   - Store detection and product extraction
   - Price monitoring
   - Shield mode injection
   - Overlay rendering

3. **Background Service**
   - Price tracking coordination
   - Notification management
   - API communication
   - Offscreen document control

4. **Offscreen Document**
   - Background price tracking
   - Continuous monitoring
   - Resource-efficient tracking

### Store Adapters

Modular adapter system for different e-commerce platforms:
- Amazon
- eBay
- MercadoLibre
- And more...

**Status**: Some adapters need improvement and refinement

---

## User Journey

### First Time User
1. Installs extension
2. Navigates to a product page
3. Sees price analysis and recommendation
4. Optionally configures Settings (salary, shield mode, Telegram)
5. Starts tracking products

### Returning User
1. Gets notifications when tracked products drop in price
2. Checks dashboard for watchlist updates
3. Makes informed purchase decisions
4. Saves money by waiting for better deals

---

## Value Propositions

### For Users
- **Save Money**: Buy when prices are lowest
- **Avoid Impulse Purchases**: Shield mode adds reflection time
- **True Cost Awareness**: See purchases in "hours of life"
- **Stay Informed**: Get instant price drop alerts
- **Multi-Store Convenience**: Track across different platforms

### For the Business
- **Affiliate Revenue**: Monetization through affiliate links
- **User Engagement**: Continuous tracking keeps users engaged
- **Data Insights**: Understanding shopping patterns
- **Scalable**: Multi-store, multi-language potential

---

## Design Philosophy

### User Experience
- **Premium but approachable**: High-quality design that's easy to use
- **Data-driven but not overwhelming**: Show insights without complexity
- **Playful but trustworthy**: Engaging while maintaining credibility
- **Empowering**: Give users control over their purchases

### Visual Identity
- Modern, clean interface
- Smooth animations and transitions
- Consistent design system
- Mobile-first thinking (400px popup width)

---

## Current Development Status

### ✅ Completed
- Core price tracking
- Multi-store support
- Telegram notifications
- Browser notifications
- Dynamic view states
- Anti-Impulse Shield
- Watchlist system
- Basic affiliate integration

### 🚧 In Progress
- Hours of Life calculator (personalizable data)
- Offscreen background tracking
- Affiliate system refinement
- Multi-store price comparison

### 📅 Planned
- i18n multi-language support (ES/EN)
- Continuous refinement of Spanish copy and CTAs
- Store adapter improvements
- Enhanced tracking when browser is closed
- Advanced comparison features

---

## Success Metrics

### User Engagement
- Number of products tracked
- Notification open rate
- Settings configuration rate
- Shield mode activation rate

### Business Metrics
- Affiliate conversion rate
- User retention
- Average savings per user
- Daily active users

---

## Competitive Advantages

1. **Holistic Approach**: Not just price tracking, but decision-making support
2. **Hours of Life**: Unique perspective on product cost
3. **Anti-Impulse Shield**: Behavioral intervention feature
4. **Telegram Integration**: Modern, fast notifications
5. **Multi-Store**: Unified experience across platforms

---

## 🚀 Production Deployment Checklist

> **Current Status**: Development environment using local Supabase instance.  
> **Goal**: Deploy to production with automated price tracking.

### 1. Database Migration to Supabase Cloud

> **Status**: ✅ Supabase Cloud project already exists  
> **Action Required**: Sync local schema changes to production

- [x] **Supabase Cloud Project Exists**
  - Project URL and credentials available
  - Base schema already deployed

- [ ] **Sync Local Schema to Production**
  ```bash
  # Compare local schema with production
  supabase db diff --linked
  
  # Push any new migrations to production
  supabase db push
  ```
  
  **Recent local changes to sync:**
  - URL normalization improvements in `normalizeUrl()` function
  - Any schema changes from recent development

- [ ] **Verify Schema Sync**
  - Check Supabase Studio (cloud) for updated schema
  - Run test queries to ensure tables match local
  - Verify indexes and constraints are in place

- [ ] **Seed Production Database**
  - Re-run seeding scripts with production credentials:
    ```bash
    SUPABASE_URL=https://[PROJECT].supabase.co \
    SUPABASE_ANON_KEY=[PROD_KEY] \
    pnpm exec tsx scripts/seed-products.ts --csv [CSV_FILE]
    ```
  - Start with MercadoLibre products (already tested)
  - Verify data in Supabase Studio (cloud)

### 2. Environment Configuration

- [ ] **Update Extension for Production**
  - Update `apps/extension/.env` with production Supabase credentials
  - Test extension with cloud database
  - Verify all features work with remote data

- [ ] **GitHub Secrets Configuration**
  - Add `SUPABASE_URL` to repository secrets
  - Add `SUPABASE_ANON_KEY` to repository secrets
  - Add `SUPABASE_SERVICE_KEY` for admin operations (if needed)

### 3. GitHub Actions Setup (Price Tracking Cron)

- [ ] **Create Workflow File**
  - Path: `.github/workflows/price-tracker.yml`
  - Schedule: 2x daily (9 AM and 9 PM Colombia time)
  - Estimated runtime: 5-10 min per execution
  - Monthly usage: ~300-600 min (within free tier: 2,000 min/month)

- [ ] **Workflow Configuration**
  ```yaml
  name: Price Tracker
  on:
    schedule:
      - cron: '0 14,2 * * *'  # 9 AM and 9 PM COT (UTC-5)
    workflow_dispatch:  # Allow manual triggers
  
  jobs:
    track-prices:
      runs-on: ubuntu-latest
      env:
        SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
        SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
      steps:
        - uses: actions/checkout@v3
        - uses: pnpm/action-setup@v2
        - uses: actions/setup-node@v3
        - run: pnpm install
        - run: pnpm exec tsx scripts/track-prices.ts
  ```

- [ ] **Test Workflow**
  - Trigger manually via GitHub Actions UI
  - Verify price snapshots are created
  - Check logs for errors

### 4. Price Tracking Script

- [ ] **Create `scripts/track-prices.ts`**
  - Fetch all products from database
  - For each product:
    - Scrape current price from product URL
    - Compare with latest price snapshot
    - Insert new snapshot if price changed
  - Support for all MVP stores:
    - MercadoLibre
    - Éxito
    - Falabella
    - Zara
    - H&M
    - Nike
    - Adidas
    - Amazon

- [ ] **Implement Rate Limiting**
  - Add delays between requests to avoid being blocked
  - Batch processing for large product catalogs
  - Retry logic for failed requests

- [ ] **Implement Intelligent Tracking** (Priority-based)
  - **High Priority** (2x/day): Products with active watchlists or recently visited
  - **Medium Priority** (1x/day): Products with price changes in last 7 days
  - **Low Priority** (1x/week): Stable products with no recent changes
  - **Inactive** (1x/month): Products not visited in 30+ days
  - This optimization keeps tracking within GitHub Actions free tier (2,000 min/month)

### 4.1. Scaling Strategy & Costs

> **Technology Choice**: Puppeteer + Extension Adapters  
> **Rationale**: Reuses existing store adapters, more robust than HTML parsing, handles dynamic content

#### GitHub Actions Costs

| Plan | Minutes/Month | Storage | Cost | Supports Products |
|------|---------------|---------|------|-------------------|
| **Free** | 2,000 | 500 MB | $0 | 500-1,000 (with smart tracking) |
| **Pro** | 3,000 | 2 GB | $4/user/month | ~1,200 |
| **Team** | 3,000/user | 10 GB | $4/user/month (min 2) | Scalable |
| **Extra Minutes** | - | - | $0.008/min | As needed |

#### Scaling Phases

**Phase 1: MVP (0-1,000 products)** - **FREE**
- GitHub Actions free tier (2,000 min/month)
- Intelligent tracking enabled
- 2 runs/day for high-priority products
- Estimated usage: 1,500 min/month ✅

**Phase 2: Growth (1,000-5,000 products)** - **$0-25/month**
- Option A: Optimize tracking further (stay free)
  - Reduce high-priority to 1x/day
  - More aggressive prioritization
- Option B: Migrate to Railway/Render ($25/month)
  - Better for longer-running jobs
  - More control over execution

**Phase 3: Scale (5,000-50,000 products)** - **$50-100/month**
- Dedicated server (DigitalOcean, AWS EC2)
- Parallel processing with multiple workers
- Custom scheduling and retry logic

**Phase 4: Enterprise (50,000+ products)** - **$200+/month**
- Distributed system with queue (Redis/RabbitMQ)
- Multiple servers for parallel processing
- Advanced monitoring and alerting

#### Optimization Techniques

**1. Priority-Based Tracking** (50-70% cost reduction)
```typescript
// Only track products that matter:
// - Have active watchlists
// - Recently visited by users
// - Showing price volatility
```

**2. Variable Frequency** (40-60% cost reduction)
```typescript
// Adjust tracking frequency based on activity:
// - Popular products: 2x/day
// - Normal products: 1x/day
// - Stable products: 1x/week
// - Inactive products: 1x/month
```

**3. Batch Optimization** (30-40% time reduction)
```typescript
// Process multiple products concurrently
// Use Puppeteer browser pooling
// 5-10 concurrent pages per run
```

**4. Smart Caching** (20-30% request reduction)
```typescript
// Skip tracking if:
// - No price change in 14+ days
// - Product marked as discontinued
// - Store returns 404
```

#### Migration Checklist

When scaling beyond GitHub Actions free tier:

- [ ] **Evaluate Usage**
  - Monitor actual minutes used per month
  - Calculate cost of extra minutes vs. migration
  - Consider optimization opportunities first

- [ ] **Choose Platform**
  - Railway: Best for simple migration, $25/month base
  - Render: Similar to Railway, $7/month per service
  - DigitalOcean: More control, $50-100/month
  - AWS/GCP: Enterprise scale, complex pricing

- [ ] **Migrate Infrastructure**
  - Set up cron jobs on new platform
  - Configure environment variables
  - Test tracking script in new environment
  - Set up monitoring and alerts

- [ ] **Update Documentation**
  - Document new deployment process
  - Update runbook with new platform specifics
  - Train team on new infrastructure



### 5. Data Seeding for MVP

- [ ] **Collect Product Data**
  - Use Web Scraper Chrome extension
  - Target popular products from each store
  - Goal: 50-100 products per store (~500-800 total)

- [ ] **Categories to Cover**
  - Electronics (phones, laptops, accessories)
  - Fashion (clothing, shoes, accessories)
  - Home & Living (furniture, appliances)
  - Sports & Outdoors

- [ ] **Execute Seeding**
  - Run CSV import for each store
  - Verify products in production database
  - Test extension with seeded data

### 6. Monitoring & Maintenance

- [ ] **Set Up Monitoring**
  - GitHub Actions email notifications for failures
  - Supabase dashboard for database health
  - Extension error tracking (Sentry or similar)

- [ ] **Create Runbook**
  - Document how to add new products
  - Document how to fix failed tracking runs
  - Document how to update scrapers if store HTML changes

### 7. Pre-Launch Verification

- [ ] **End-to-End Testing**
  - Install extension from production build
  - Verify price tracking works
  - Test notifications (browser + Telegram)
  - Verify watchlist functionality
  - Test Shield mode on all supported stores

- [ ] **Performance Testing**
  - Measure extension load time
  - Verify database query performance
  - Test with 500+ products in watchlist

---

## Future Vision

Delay aims to become the **essential tool for smart online shopping**, helping millions of users:
- Save money through informed decisions
- Avoid impulse purchases
- Understand the true cost of their purchases
- Shop with confidence across any platform

**Mission**: Empower people to make better purchasing decisions by giving them time, information, and perspective.
