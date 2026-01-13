import { supabase } from './utils/db';

async function cleanup() {
    console.log('🧹 Cleaning up MercadoLibre products...\n');

    // First, get all MercadoLibre product IDs
    const { data: products, error: fetchError } = await supabase
        .from('products')
        .select('id')
        .eq('merchant', 'mercadolibre');

    if (fetchError) {
        console.error('❌ Error fetching products:', fetchError);
        process.exit(1);
    }

    const productIds = products?.map(p => p.id) || [];
    console.log(`Found ${productIds.length} MercadoLibre products`);

    if (productIds.length === 0) {
        console.log('✅ No products to delete');
        return;
    }

    // Delete price snapshots first
    const { error: snapshotsError } = await supabase
        .from('price_snapshots')
        .delete()
        .in('product_id', productIds);

    if (snapshotsError) {
        console.error('❌ Error deleting price snapshots:', snapshotsError);
        process.exit(1);
    }

    console.log(`✅ Deleted price snapshots for ${productIds.length} products`);

    // Then delete products
    const { error: productsError } = await supabase
        .from('products')
        .delete()
        .eq('merchant', 'mercadolibre');

    if (productsError) {
        console.error('❌ Error deleting products:', productsError);
        process.exit(1);
    }

    console.log(`✅ Deleted ${productIds.length} products`);
    console.log('\n🎉 Cleanup complete!');
}

cleanup();
