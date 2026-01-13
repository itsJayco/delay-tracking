/**
 * Product Seeding Script
 * Populates the database with popular products from various platforms
 * 
 * Usage:
 *   npm run seed:products -- --platform mercadolibre --count 100
 *   npm run seed:products -- --platform all --dry-run
 *   npm run seed:products -- --csv path/to/file.csv --count 100
 */

import {
    fetchMercadoLibreBestSellers,
    fetchMultipleCategories,
    POPULAR_CATEGORIES,
    type MLProduct
} from './scrapers/mercadolibre';
import {
    processCSVFile,
    detectMerchantFromUrl
} from './scrapers/csv-import';
import {
    batchInsertProducts,
    batchInsertPriceSnapshots,
    normalizeUrl,
    generateProductHash,
    type ProductInsert,
    type PriceSnapshotInsert
} from './utils/db';

interface SeedOptions {
    platform: 'mercadolibre' | 'amazon' | 'csv' | 'all';
    count: number;
    dryRun: boolean;
    categories?: string[];
    csvFile?: string;
}

/**
 * Parse command line arguments
 */
function parseArgs(): SeedOptions {
    const args = process.argv.slice(2);
    const options: SeedOptions = {
        platform: 'mercadolibre',
        count: 100,
        dryRun: false,
    };

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--platform':
                options.platform = args[++i] as SeedOptions['platform'];
                break;
            case '--count':
                options.count = parseInt(args[++i], 10);
                break;
            case '--dry-run':
                options.dryRun = true;
                break;
            case '--categories':
                options.categories = args[++i].split(',');
                break;
            case '--csv':
                options.platform = 'csv';
                options.csvFile = args[++i];
                break;
        }
    }

    return options;
}

/**
 * Convert MercadoLibre product to database format
 */
function mlProductToDbFormat(mlProduct: MLProduct): ProductInsert {
    const normalizedUrl = normalizeUrl(mlProduct.permalink);
    const productHash = generateProductHash('mercadolibre', normalizedUrl);

    return {
        merchant: 'mercadolibre',
        original_url: mlProduct.permalink,
        normalized_url: normalizedUrl,
        product_hash: productHash,
        title: mlProduct.title,
        currency: mlProduct.currency_id,
    };
}

/**
 * Seed MercadoLibre products
 */
async function seedMercadoLibre(options: SeedOptions) {
    console.log('\n🇨🇴 === SEEDING MERCADOLIBRE PRODUCTS ===\n');

    let mlProducts: MLProduct[];

    if (options.categories && options.categories.length > 0) {
        // Fetch from specific categories
        mlProducts = await fetchMultipleCategories(options.categories, Math.ceil(options.count / options.categories.length));
    } else {
        // Fetch from all popular categories
        const categories = Object.values(POPULAR_CATEGORIES);
        const productsPerCategory = Math.ceil(options.count / categories.length);
        mlProducts = await fetchMultipleCategories(categories, productsPerCategory);
    }

    // Limit to requested count
    mlProducts = mlProducts.slice(0, options.count);

    console.log(`\n📊 Processing ${mlProducts.length} products...`);

    // Convert to database format
    const dbProducts = mlProducts.map(mlProductToDbFormat);

    if (options.dryRun) {
        console.log('\n🔍 DRY RUN - Would insert:');
        console.log(`   ${dbProducts.length} products`);
        console.log('\nSample products:');
        dbProducts.slice(0, 3).forEach((p, i) => {
            console.log(`   ${i + 1}. ${p.title.substring(0, 60)}...`);
            console.log(`      URL: ${p.original_url}`);
            console.log(`      Hash: ${p.product_hash.substring(0, 16)}...`);
        });
        return;
    }

    // Insert products
    const insertedProducts = await batchInsertProducts(dbProducts);

    // Create initial price snapshots
    const priceSnapshots: PriceSnapshotInsert[] = insertedProducts.map((product, index) => {
        const mlProduct = mlProducts.find(ml => {
            const hash = generateProductHash('mercadolibre', normalizeUrl(ml.permalink));
            return hash === product.product_hash;
        });

        return {
            product_id: product.id,
            price: mlProduct?.price || 0,
            currency: mlProduct?.currency_id || 'COP',
            source: 'seed',
        };
    });

    await batchInsertPriceSnapshots(priceSnapshots);

    console.log('\n✅ MercadoLibre seeding complete!');
    console.log(`   Products: ${insertedProducts.length}`);
    console.log(`   Price snapshots: ${priceSnapshots.length}`);
}

/**
 * Seed from CSV file
 */
async function seedFromCSV(options: SeedOptions) {
    if (!options.csvFile) {
        throw new Error('CSV file path is required. Use --csv <path>');
    }

    console.log('\n📄 === SEEDING FROM CSV FILE ===\n');
    console.log(`File: ${options.csvFile}`);

    // Import URL parser and Puppeteer fetcher
    const { parseUrlListCSV } = await import('./scrapers/url-list-import');
    const { fetchMultipleProductsWithPuppeteer } = await import('./scrapers/puppeteer-fetch');

    // Extract URLs from CSV (ignoring all other data)
    const urls = parseUrlListCSV(options.csvFile);

    if (urls.length === 0) {
        console.log('⚠️  No URLs found in CSV');
        return;
    }

    // Limit to requested count
    const limitedUrls = urls.slice(0, options.count);
    console.log(`\n🎯 Will process ${limitedUrls.length} URLs`);

    if (options.dryRun) {
        console.log('\n🔍 DRY RUN - Would fetch and insert:');
        console.log(`   ${limitedUrls.length} products`);
        console.log('\nSample URLs:');
        limitedUrls.slice(0, 5).forEach((url, i) => {
            console.log(`   ${i + 1}. ${url.substring(0, 80)}...`);
        });
        return;
    }

    // Fetch real product data from URLs using Puppeteer
    const products = await fetchMultipleProductsWithPuppeteer(limitedUrls, {
        delay: 2000, // 2 seconds between batches
        maxConcurrent: 2, // 2 concurrent requests per batch (conservative for seeding)
    });

    if (products.length === 0) {
        console.log('⚠️  No products fetched successfully');
        return;
    }

    console.log(`\n📊 Processing ${products.length} products...`);

    // Convert to database format
    const dbProducts = products.map(p => {
        const normalizedUrl = normalizeUrl(p.url);
        const productHash = generateProductHash(p.merchant, normalizedUrl);

        return {
            merchant: p.merchant,
            original_url: p.url,
            normalized_url: normalizedUrl,
            product_hash: productHash,
            title: p.title,
            currency: p.currency,
        };
    });

    // Insert products
    const insertedProducts = await batchInsertProducts(dbProducts);

    // Create initial price snapshots
    const priceSnapshots: PriceSnapshotInsert[] = insertedProducts.map((product) => {
        const originalProduct = products.find(p => {
            const hash = generateProductHash(p.merchant, normalizeUrl(p.url));
            return hash === product.product_hash;
        });

        return {
            product_id: product.id,
            price: originalProduct?.price || 0,
            currency: originalProduct?.currency || 'COP',
            source: 'csv-import',
        };
    });

    await batchInsertPriceSnapshots(priceSnapshots);

    console.log('\n✅ CSV import seeding complete!');
    console.log(`   Products: ${insertedProducts.length}`);
    console.log(`   Price snapshots: ${priceSnapshots.length}`);
}

/**
 * Main execution
 */
async function main() {
    const options = parseArgs();

    console.log('🌱 === DELAY PRODUCT SEEDING SCRIPT ===');
    console.log(`Platform: ${options.platform}`);
    console.log(`Count: ${options.count}`);
    console.log(`Dry run: ${options.dryRun ? 'YES' : 'NO'}`);
    console.log('');

    try {
        switch (options.platform) {
            case 'mercadolibre':
                await seedMercadoLibre(options);
                break;
            case 'amazon':
                console.log('⚠️ Amazon seeding not yet implemented');
                break;
            case 'csv':
                await seedFromCSV(options);
                break;
            case 'all':
                await seedMercadoLibre(options);
                // await seedAmazon(options);
                break;
            default:
                console.error(`❌ Unknown platform: ${options.platform}`);
                process.exit(1);
        }

        console.log('\n🎉 Seeding completed successfully!');
    } catch (error) {
        console.error('\n❌ Seeding failed:', error);
        process.exit(1);
    }
}

// Run if executed directly
main();
