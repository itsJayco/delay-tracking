/**
 * Intelligent Price Tracking Script
 * Uses Puppeteer to visit product pages and extract prices using extension adapters
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';
import { getProductsToTrack, updateLastTracked, TrackingPriority } from './utils/tracking-priority.js';
import { supabase, PriceSnapshotInsert } from './utils/db.js';
import * as fs from 'fs';
import * as path from 'path';

// Add stealth plugin to avoid bot detection
puppeteer.use(StealthPlugin());

// User agent rotation to avoid detection
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
];

function getRandomUserAgent(): string {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

interface TrackingResult {
    productId: string;
    success: boolean;
    price?: number;
    currency?: string;
    error?: string;
}

/**
 * Get adapter code for a specific merchant
 */
function getAdapterCode(merchant: string): string {
    const adapterPath = path.join(
        __dirname,
        '../apps/extension/src/content/stores',
        `${merchant}.adapter.ts`
    );

    if (!fs.existsSync(adapterPath)) {
        throw new Error(`Adapter not found for merchant: ${merchant}`);
    }

    // Read and transpile adapter code (simplified - in production use proper bundler)
    const adapterCode = fs.readFileSync(adapterPath, 'utf-8');

    // For now, we'll use a simplified approach
    // In production, you'd want to bundle the adapter properly
    return adapterCode;
}

/**
 * Extract product data from a page using the merchant's adapter
 */
async function extractProductData(
    page: Page,
    merchant: string
): Promise<{ price: number; currency: string; title: string } | null> {
    try {
        // Inject adapter and extract data
        const result = await page.evaluate((merchantName) => {
            // This is a simplified version - we'll need to inject the actual adapter
            // For now, let's use a direct extraction approach for MercadoLibre

            if (merchantName === 'mercadolibre') {
                // Try to find price in meta tags (most reliable)
                const metaPrice = document.querySelector<HTMLMetaElement>('meta[itemprop="price"]');
                if (metaPrice?.content) {
                    const price = parseFloat(metaPrice.content);

                    // Get currency from domain
                    const hostname = window.location.hostname;
                    let currency = 'COP';
                    if (hostname.includes('.com.br')) currency = 'BRL';
                    else if (hostname.includes('.com.mx')) currency = 'MXN';
                    else if (hostname.includes('.com.ar')) currency = 'ARS';
                    else if (hostname.includes('.cl')) currency = 'CLP';

                    // Get title
                    const titleMeta = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
                    const title = titleMeta?.content || document.title;

                    return { price, currency, title };
                }

                // Fallback: try to find price in DOM
                const priceElement = document.querySelector('.andes-money-amount__fraction');
                if (priceElement?.textContent) {
                    const priceText = priceElement.textContent.replace(/[^0-9]/g, '');
                    const price = parseFloat(priceText);

                    const titleMeta = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
                    const title = titleMeta?.content || document.title;

                    return { price, currency: 'COP', title };
                }

                // Debug: return what we found
                return {
                    price: 0,
                    currency: 'COP',
                    title: document.title || 'Unknown',
                    debug: {
                        hasPriceMeta: !!document.querySelector('meta[itemprop="price"]'),
                        hasPriceElement: !!document.querySelector('.andes-money-amount__fraction'),
                        url: window.location.href,
                    }
                };
            }

            return null;
        }, merchant);

        // Log debug info if price is 0
        if (result && result.price === 0 && (result as any).debug) {
            console.log(`     🐛 Debug info:`, (result as any).debug);
        }

        return result;
    } catch (error) {
        console.error(`Error extracting data:`, error);
        return null;
    }
}

/**
 * Track a single product
 */
async function trackProduct(
    browser: Browser,
    product: {
        id: string;
        merchant: string;
        original_url: string;
        title: string;
    }
): Promise<TrackingResult> {
    const page = await browser.newPage();

    try {
        console.log(`  📍 ${product.title.substring(0, 50)}...`);

        // Set viewport (important for headless)
        await page.setViewport({ width: 1920, height: 1080 });

        // Set random user agent to avoid detection
        await page.setUserAgent(getRandomUserAgent());

        // Set extra headers
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        });

        // Navigate to product page
        await page.goto(product.original_url, {
            waitUntil: 'domcontentloaded', // Changed from networkidle2 for faster loading
            timeout: 45000, // Increased timeout
        });

        // Wait longer for dynamic content to load
        await new Promise(resolve => setTimeout(resolve, 5000)); // Increased from 2s to 5s

        // Extract product data
        const data = await extractProductData(page, product.merchant);

        if (!data || !data.price) {
            return {
                productId: product.id,
                success: false,
                error: 'Could not extract price',
            };
        }

        console.log(`     💰 $${data.price.toLocaleString()} ${data.currency}`);

        // Get last price snapshot
        const { data: lastSnapshot } = await supabase
            .from('price_snapshots')
            .select('price, currency')
            .eq('product_id', product.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        // Only insert if price changed
        if (!lastSnapshot || lastSnapshot.price !== data.price) {
            const snapshot: PriceSnapshotInsert = {
                product_id: product.id,
                price: data.price,
                currency: data.currency,
                source: 'automated-tracking',
            };

            const { error } = await supabase
                .from('price_snapshots')
                .insert(snapshot);

            if (error) {
                console.error(`     ❌ Error inserting snapshot:`, error);
                return {
                    productId: product.id,
                    success: false,
                    error: error.message,
                };
            }

            const change = lastSnapshot
                ? ((data.price - lastSnapshot.price) / lastSnapshot.price * 100).toFixed(1)
                : 'new';

            console.log(`     ✅ Price ${change === 'new' ? 'recorded' : `changed ${change}%`}`);
        } else {
            console.log(`     ⏭️  No change`);
        }

        // Update last tracked timestamp
        await updateLastTracked(product.id);

        return {
            productId: product.id,
            success: true,
            price: data.price,
            currency: data.currency,
        };
    } catch (error: any) {
        console.error(`     ❌ Error:`, error.message);
        return {
            productId: product.id,
            success: false,
            error: error.message,
        };
    } finally {
        await page.close();
    }
}

/**
 * Utility to launch browser with retry logic for cloud environments
 */
async function launchBrowser() {
    const launchOptions = {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled',
        ],
    };

    try {
        return await puppeteer.launch(launchOptions);
    } catch (error) {
        const errorMsg = (error as Error).message;
        if (errorMsg.includes('Could not find Chrome') || errorMsg.includes('executablePath')) {
            console.log('⚠️  Chrome not found. Attempting self-installation...');
            
            try {
                const { execSync } = await import('child_process');
                console.log('📥 Downloading Chrome...');
                execSync('npx puppeteer browsers install chrome', { stdio: 'inherit' });
                
                console.log('🚀 Retrying browser launch...');
                return await puppeteer.launch(launchOptions);
            } catch (installError) {
                console.error('❌ Self-installation failed:', installError);
                throw error;
            }
        }
        throw error;
    }
}

/**
 * Main tracking function
 */
async function trackPrices(options: {
    limit?: number;
    merchant?: string;
    concurrency?: number;
    force?: boolean;
} = {}) {
    const { limit = 100, merchant, concurrency = 3, force = false } = options;

    console.log('🚀 === INTELLIGENT PRICE TRACKING ===\n');
    console.log(`⚙️  Configuration:`);
    console.log(`   Limit: ${limit} products`);
    console.log(`   Merchant: ${merchant || 'all'}`);
    console.log(`   Concurrency: ${concurrency} pages`);
    console.log(`   Force mode: ${force ? 'YES (ignoring time filters)' : 'NO'}\n`);

    // Get products to track (prioritized)
    const products = await getProductsToTrack({ limit, merchant, force });

    if (products.length === 0) {
        console.log('⚠️  No products to track');
        return;
    }

    // Launch browser
    console.log('🌐 Launching browser...\n');
    const browser = await launchBrowser();

    try {
        const results: TrackingResult[] = [];

        // Process products in batches
        for (let i = 0; i < products.length; i += concurrency) {
            const batch = products.slice(i, i + concurrency);
            const batchNum = Math.floor(i / concurrency) + 1;
            const totalBatches = Math.ceil(products.length / concurrency);

            console.log(`📦 Batch ${batchNum}/${totalBatches} (${batch.length} products):`);

            // Track batch concurrently
            const batchResults = await Promise.all(
                batch.map(product => trackProduct(browser, product))
            );

            results.push(...batchResults);

            // Wait between batches with random delay to avoid rate limiting
            if (i + concurrency < products.length) {
                const delay = 3000 + Math.random() * 4000; // 3-7 seconds
                console.log(`\n⏳ Waiting ${(delay / 1000).toFixed(1)} seconds before next batch...\n`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        // Print summary
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        console.log('\n📊 === TRACKING SUMMARY ===');
        console.log(`✅ Successful: ${successful}/${products.length}`);
        console.log(`❌ Failed: ${failed}/${products.length}`);

        if (failed > 0) {
            console.log('\n⚠️  Failed products:');
            results
                .filter(r => !r.success)
                .forEach(r => {
                    const product = products.find(p => p.id === r.productId);
                    console.log(`   - ${product?.title.substring(0, 50)}...`);
                    console.log(`     Error: ${r.error}`);
                });
        }

        console.log('\n🎉 Tracking completed!');
    } finally {
        await browser.close();
    }
}

// CLI execution
if (require.main === module) {
    const args = process.argv.slice(2);
    const options: any = {};

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--limit' && args[i + 1]) {
            options.limit = parseInt(args[i + 1]);
            i++;
        } else if (args[i] === '--merchant' && args[i + 1]) {
            options.merchant = args[i + 1];
            i++;
        } else if (args[i] === '--concurrency' && args[i + 1]) {
            options.concurrency = parseInt(args[i + 1]);
            i++;
        } else if (args[i] === '--force') {
            options.force = true;
        }
    }

    trackPrices(options)
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('❌ Fatal error:', error);
            process.exit(1);
        });
}

export { trackPrices };
