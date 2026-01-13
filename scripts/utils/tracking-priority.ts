import { supabase } from './db.js';

/**
 * Product Priority Levels for Intelligent Tracking
 */
export enum TrackingPriority {
    HIGH = 'high',       // 2x/day - Has watchlists or recently visited
    MEDIUM = 'medium',   // 1x/day - Price changed in last 7 days
    LOW = 'low',         // 1x/week - Stable, no recent changes
    INACTIVE = 'inactive' // 1x/month - Not visited in 30+ days
}

export interface ProductWithPriority {
    id: string;
    merchant: string;
    original_url: string;
    normalized_url: string;
    title: string;
    priority: TrackingPriority;
    last_tracked_at?: string;
    last_price_change_at?: string;
}

/**
 * Calculate tracking priority for a product
 */
function calculatePriority(product: any): TrackingPriority {
    const now = new Date();

    // High priority: Has active watchlists
    if (product.watchlist_count > 0) {
        return TrackingPriority.HIGH;
    }

    // High priority: Visited in last 7 days
    if (product.last_visited_at) {
        const lastVisit = new Date(product.last_visited_at);
        const daysSinceVisit = (now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceVisit <= 7) {
            return TrackingPriority.HIGH;
        }
    }

    // Medium priority: Price changed in last 7 days
    if (product.last_price_change_at) {
        const lastChange = new Date(product.last_price_change_at);
        const daysSinceChange = (now.getTime() - lastChange.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceChange <= 7) {
            return TrackingPriority.MEDIUM;
        }
    }

    // Low priority: Visited in last 30 days
    if (product.last_visited_at) {
        const lastVisit = new Date(product.last_visited_at);
        const daysSinceVisit = (now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceVisit <= 30) {
            return TrackingPriority.LOW;
        }
    }

    // Inactive: Everything else
    return TrackingPriority.INACTIVE;
}

/**
 * Check if a product should be tracked based on its priority and last tracking time
 */
function shouldTrackProduct(product: ProductWithPriority): boolean {
    if (!product.last_tracked_at) {
        return true; // Never tracked before
    }

    const now = new Date();
    const lastTracked = new Date(product.last_tracked_at);
    const hoursSinceTracking = (now.getTime() - lastTracked.getTime()) / (1000 * 60 * 60);

    switch (product.priority) {
        case TrackingPriority.HIGH:
            return hoursSinceTracking >= 12; // Track every 12 hours (2x/day)
        case TrackingPriority.MEDIUM:
            return hoursSinceTracking >= 24; // Track every 24 hours (1x/day)
        case TrackingPriority.LOW:
            return hoursSinceTracking >= 168; // Track every 7 days (1x/week)
        case TrackingPriority.INACTIVE:
            return hoursSinceTracking >= 720; // Track every 30 days (1x/month)
        default:
            return false;
    }
}

/**
 * Get products that need tracking, prioritized intelligently
 */
export async function getProductsToTrack(options: {
    limit?: number;
    merchant?: string;
    force?: boolean; // Bypass time filters for testing/manual runs
} = {}): Promise<ProductWithPriority[]> {
    const { limit = 100, merchant, force = false } = options;

    console.log('🎯 Fetching products for intelligent tracking...\n');

    // Query products (simplified - no joins)
    let query = supabase
        .from('products')
        .select('id, merchant, original_url, normalized_url, title, last_tracked_at');

    if (merchant) {
        query = query.eq('merchant', merchant);
    }

    const { data: products, error } = await query;

    if (error) {
        console.error('❌ Error fetching products:', error);
        throw error;
    }

    if (!products || products.length === 0) {
        console.log('⚠️  No products found');
        return [];
    }

    console.log(`📊 Found ${products.length} total products`);

    // Get last price change for each product
    const productsWithMetadata = await Promise.all(
        products.map(async (product) => {
            // Get watchlist count
            const { count: watchlistCount } = await supabase
                .from('watchlist_items')
                .select('*', { count: 'exact', head: true })
                .eq('product_id', product.id);

            // Get last price change
            const { data: priceChanges } = await supabase
                .from('price_snapshots')
                .select('created_at, price')
                .eq('product_id', product.id)
                .order('created_at', { ascending: false })
                .limit(2);

            let lastPriceChangeAt = null;
            if (priceChanges && priceChanges.length >= 2) {
                if (priceChanges[0].price !== priceChanges[1].price) {
                    lastPriceChangeAt = priceChanges[0].created_at;
                }
            }

            // Get last visited
            const { data: views } = await supabase
                .from('product_views')
                .select('viewed_at')
                .eq('product_id', product.id)
                .order('viewed_at', { ascending: false })
                .limit(1);

            return {
                ...product,
                watchlist_count: watchlistCount || 0,
                last_price_change_at: lastPriceChangeAt,
                last_visited_at: views?.[0]?.viewed_at || null,
            };
        })
    );

    // Calculate priorities
    const productsWithPriority: ProductWithPriority[] = productsWithMetadata.map(product => ({
        id: product.id,
        merchant: product.merchant,
        original_url: product.original_url,
        normalized_url: product.normalized_url,
        title: product.title,
        priority: calculatePriority(product),
        last_tracked_at: product.last_tracked_at,
        last_price_change_at: product.last_price_change_at,
    }));

    // Filter products that should be tracked
    const productsToTrack = force 
        ? productsWithPriority // Force mode: track all products
        : productsWithPriority.filter(shouldTrackProduct); // Normal mode: filter by time

    // Sort by priority (HIGH first, then MEDIUM, LOW, INACTIVE)
    const priorityOrder = {
        [TrackingPriority.HIGH]: 0,
        [TrackingPriority.MEDIUM]: 1,
        [TrackingPriority.LOW]: 2,
        [TrackingPriority.INACTIVE]: 3,
    };

    productsToTrack.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    // Limit results
    const limitedProducts = productsToTrack.slice(0, limit);

    // Print summary
    const priorityCounts = limitedProducts.reduce((acc, p) => {
        acc[p.priority] = (acc[p.priority] || 0) + 1;
        return acc;
    }, {} as Record<TrackingPriority, number>);

    console.log('\n📈 Tracking Priority Distribution:');
    console.log(`   🔴 HIGH (2x/day):     ${priorityCounts[TrackingPriority.HIGH] || 0} products`);
    console.log(`   🟡 MEDIUM (1x/day):   ${priorityCounts[TrackingPriority.MEDIUM] || 0} products`);
    console.log(`   🟢 LOW (1x/week):     ${priorityCounts[TrackingPriority.LOW] || 0} products`);
    console.log(`   ⚪ INACTIVE (1x/month): ${priorityCounts[TrackingPriority.INACTIVE] || 0} products`);
    console.log(`\n✅ Selected ${limitedProducts.length} products for tracking\n`);

    return limitedProducts;
}

/**
 * Update last tracked timestamp for a product
 */
export async function updateLastTracked(productId: string): Promise<void> {
    const { error } = await supabase
        .from('products')
        .update({ last_tracked_at: new Date().toISOString() })
        .eq('id', productId);

    if (error) {
        console.error(`❌ Error updating last_tracked_at for product ${productId}:`, error);
    }
}
