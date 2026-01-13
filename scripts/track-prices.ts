/**
 * Intelligent Price Tracking Script (Clean Architecture)
 * Uses Strategy Pattern to route products to the best tracking method
 */

import { getProductsToTrack, updateLastTracked } from './utils/tracking-priority.js';
import { supabase, PriceSnapshotInsert } from './utils/db.js';
import { StrategyManager } from './tracking/manager.js';
import { ProductToTrack } from './tracking/types.js';

/**
 * Main tracking function
 */
async function trackPrices(options: {
    limit?: number;
    merchant?: string;
    concurrency?: number;
    force?: boolean;
} = {}) {
    const { limit = 100, merchant, concurrency = 5, force = false } = options;

    console.log('🚀 === INTELLIGENT PRICE TRACKING (Multi-Strategy) ===\n');
    console.log(`⚙️  Configuration:`);
    console.log(`   Limit: ${limit} products`);
    console.log(`   Concurrency: ${concurrency}`);
    console.log(`   Force mode: ${force ? 'YES' : 'NO'}\n`);

    // 1. Fetch products
    const products = await getProductsToTrack({ limit, merchant, force });
    if (products.length === 0) {
        console.log('⚠️  No products to track');
        return;
    }
    console.log(`✅ Selected ${products.length} products for tracking\n`);

    // 2. Initialize Strategy Manager
    const manager = new StrategyManager();

    try {
        const results: any[] = [];

        // 3. Process in batches
        for (let i = 0; i < products.length; i += concurrency) {
            const batch = products.slice(i, i + concurrency);
            const batchNum = Math.floor(i / concurrency) + 1;
            const totalBatches = Math.ceil(products.length / concurrency);

            console.log(`📦 Batch ${batchNum}/${totalBatches} (${batch.length} products):`);

            // Track batch concurrently
            const batchResults = await Promise.all(
                batch.map(async (p) => {
                    const productToTrack: ProductToTrack = {
                        id: p.id,
                        merchant: p.merchant,
                        original_url: p.original_url,
                        title: p.title
                    };

                    // Execute Tracking via Manager
                    const result = await manager.trackProduct(productToTrack);

                    if (result.success && result.price) {
                        console.log(`     💰 $${result.price.toLocaleString()} ${result.currency} [${result.strategyUsed}]`);
                        
                        // DB Logic (Keep it here or move to manager? Keep here for now)
                        await handleDatabaseUpdate(p, result.price, result.currency || 'COP');
                    } else {
                        console.log(`     ❌ Failed [${result.strategyUsed}]: ${result.error?.substring(0, 50)}`);
                    }

                    return result;
                })
            );

            results.push(...batchResults);

            // Small delay between batches
            if (i + concurrency < products.length) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        // Summary
        const successful = results.filter(r => r.success).length;
        console.log('\n📊 === TRACKING SUMMARY ===');
        console.log(`✅ Successful: ${successful}/${products.length}`);
        console.log(`❌ Failed: ${results.length - successful}/${products.length}`);

    } finally {
        // 4. Cleanup
        await manager.closeAll();
    }
}

/**
 * Handle DB updates (Insert snapshot if price changed)
 */
async function handleDatabaseUpdate(product: any, newPrice: number, currency: string) {
    // Get last snapshot
    const { data: lastSnapshot } = await supabase
        .from('price_snapshots')
        .select('price')
        .eq('product_id', product.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    // Insert if changed
    if (!lastSnapshot || lastSnapshot.price !== newPrice) {
        const snapshot: PriceSnapshotInsert = {
            product_id: product.id,
            price: newPrice,
            currency: currency,
            source: 'automated-tracking',
        };
        await supabase.from('price_snapshots').insert(snapshot);
        
        const change = lastSnapshot 
            ? ((newPrice - lastSnapshot.price) / lastSnapshot.price * 100).toFixed(1) + '%' 
            : 'new';
        console.log(`     ✅ Price recorded (${change})`);
    } else {
        console.log(`     ⏭️  No change`);
    }

    await updateLastTracked(product.id);
}

// CLI execution
if (require.main === module) {
    const args = process.argv.slice(2);
    const options: any = {};
    if (args.includes('--force')) options.force = true;
    
    trackPrices(options)
        .then(() => process.exit(0))
        .catch((e) => { console.error(e); process.exit(1); });
}

export { trackPrices };
