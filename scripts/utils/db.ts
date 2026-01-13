import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Local Supabase defaults
const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface ProductInsert {
    merchant: string;
    original_url: string;
    normalized_url: string;
    product_hash: string;
    title: string;
    currency: string;
}

export interface PriceSnapshotInsert {
    product_id: string;
    price: number;
    currency: string;
    source: string;
}

/**
 * Normalize URL by removing tracking parameters and hash fragments
 * This ensures the same product with different tracking URLs gets the same hash
 */
export function normalizeUrl(url: string): string {
    try {
        const urlObj = new URL(url);

        // Remove ALL query parameters for MercadoLibre product URLs
        // MercadoLibre product URLs have the format: /product-name/p/PRODUCTID
        // Everything after that is tracking/session data
        if (urlObj.hostname.includes('mercadolibre')) {
            // Keep only the path (which includes the product ID)
            urlObj.search = '';
        } else {
            // For other merchants, remove common tracking parameters
            const paramsToRemove = [
                'utm_source', 'utm_medium', 'utm_campaign', 'ref', 'tag',
                'tracking_id', 'wid', 'sid', 'polycard_client', 'searchVariation',
                'search_layout', 'position', 'type', 'reco_item_pos', 'reco_backend',
                'reco_backend_type', 'reco_client', 'reco_id', 'reco_model',
                'c_id', 'c_uid', 'da_id', 'da_position', 'id_origin', 'da_sort_algorithm'
            ];
            paramsToRemove.forEach(param => urlObj.searchParams.delete(param));
        }

        // ALWAYS remove hash fragments (everything after #)
        urlObj.hash = '';

        return urlObj.toString();
    } catch {
        return url;
    }
}

/**
 * Generate product hash from merchant and normalized URL
 */
export function generateProductHash(merchant: string, normalizedUrl: string): string {
    const input = `${merchant}:${normalizedUrl}`;
    return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Insert products in batch with conflict handling
 */
export async function batchInsertProducts(products: ProductInsert[]) {
    console.log(`📦 Inserting ${products.length} products...`);

    const { data, error } = await supabase
        .from('products')
        .upsert(products, {
            onConflict: 'product_hash',
            ignoreDuplicates: true
        })
        .select('id, product_hash, title');

    if (error) {
        console.error('❌ Error inserting products:', error);
        throw error;
    }

    console.log(`✅ Inserted/updated ${data?.length || 0} products`);
    return data || [];
}

/**
 * Insert price snapshots for products
 */
export async function batchInsertPriceSnapshots(snapshots: PriceSnapshotInsert[]) {
    console.log(`💰 Inserting ${snapshots.length} price snapshots...`);

    const { data, error } = await supabase
        .from('price_snapshots')
        .insert(snapshots)
        .select();

    if (error) {
        console.error('❌ Error inserting price snapshots:', error);
        throw error;
    }

    console.log(`✅ Inserted ${data?.length || 0} price snapshots`);
    return data || [];
}

/**
 * Get product by hash
 */
export async function getProductByHash(productHash: string) {
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('product_hash', productHash)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        console.error('❌ Error fetching product:', error);
        throw error;
    }

    return data;
}
