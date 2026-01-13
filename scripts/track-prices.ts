/**
 * Intelligent Price Tracking Script
 * Uses Puppeteer to visit product pages and extract prices using extension adapters
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { getProductsToTrack, updateLastTracked, TrackingPriority } from './utils/tracking-priority.js';
import { supabase, PriceSnapshotInsert } from './utils/db.js';
import * as fs from 'fs';
import * as path from 'path';

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
            }

            return null;
        }, merchant);

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

        // Set user agent to avoid detection
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );

        // Navigate to product page
        await page.goto(product.original_url, {
            waitUntil: 'networkidle2',
            timeout: 30000,
        });


        // Wait a bit for dynamic content
        await new Promise(resolve => setTimeout(resolve, 2000));

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
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

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

            // Wait between batches to avoid rate limiting
            if (i + concurrency < products.length) {
                console.log(`\n⏳ Waiting 3 seconds before next batch...\n`);
                await new Promise(resolve => setTimeout(resolve, 3000));
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
