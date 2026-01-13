/**
 * Simple CSV Seed Script
 * Imports products from CSV by adding them to DB, then runs track-prices to get real data
 */

import { parseUrlListCSV } from './scrapers/url-list-import';
import {
    batchInsertProducts,
    normalizeUrl,
    generateProductHash,
    type ProductInsert,
} from './utils/db';

interface SeedOptions {
    csvFile: string;
    count: number;
    dryRun: boolean;
}

/**
 * Parse command line arguments
 */
function parseArgs(): SeedOptions {
    const args = process.argv.slice(2);
    const options: SeedOptions = {
        csvFile: '',
        count: 100,
        dryRun: false,
    };

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--csv':
                options.csvFile = args[++i];
                break;
            case '--count':
                options.count = parseInt(args[++i], 10);
                break;
            case '--dry-run':
                options.dryRun = true;
                break;
        }
    }

    return options;
}

/**
 * Detect merchant from URL
 */
function detectMerchant(url: string): string {
    const hostname = new URL(url).hostname.toLowerCase();

    if (hostname.includes('mercadolibre')) return 'mercadolibre';
    if (hostname.includes('amazon')) return 'amazon';
    if (hostname.includes('exito')) return 'exito';
    if (hostname.includes('falabella')) return 'falabella';
    if (hostname.includes('zara')) return 'zara';
    if (hostname.includes('hm.com')) return 'hm';
    if (hostname.includes('nike')) return 'nike';
    if (hostname.includes('adidas')) return 'adidas';

    return 'unknown';
}

/**
 * Main execution
 */
async function main() {
    const options = parseArgs();

    if (!options.csvFile) {
        console.error('❌ CSV file is required. Use --csv <path>');
        process.exit(1);
    }

    console.log('🌱 === SIMPLE CSV SEED SCRIPT ===');
    console.log(`CSV File: ${options.csvFile}`);
    console.log(`Count: ${options.count}`);
    console.log(`Dry run: ${options.dryRun ? 'YES' : 'NO'}`);
    console.log('');

    try {
        // Extract URLs from CSV
        const urls = parseUrlListCSV(options.csvFile);

        if (urls.length === 0) {
            console.log('⚠️  No URLs found in CSV');
            return;
        }

        // Limit to requested count
        const limitedUrls = urls.slice(0, options.count);
        console.log(`\n🎯 Will process ${limitedUrls.length} URLs`);

        if (options.dryRun) {
            console.log('\n🔍 DRY RUN - Would insert:');
            console.log(`   ${limitedUrls.length} products`);
            console.log('\nSample URLs:');
            limitedUrls.slice(0, 5).forEach((url, i) => {
                const merchant = detectMerchant(url);
                console.log(`   ${i + 1}. [${merchant}] ${url.substring(0, 70)}...`);
            });
            return;
        }

        // Convert URLs to database format (without prices - will be fetched by track-prices)
        const dbProducts: ProductInsert[] = limitedUrls.map(url => {
            const merchant = detectMerchant(url);
            const normalizedUrl = normalizeUrl(url);
            const productHash = generateProductHash(merchant, normalizedUrl);

            return {
                merchant,
                original_url: url,
                normalized_url: normalizedUrl,
                product_hash: productHash,
                title: `Product from ${merchant}`, // Placeholder - will be updated by track-prices
                currency: 'COP', // Default - will be updated by track-prices
            };
        });

        console.log(`\n📊 Inserting ${dbProducts.length} products...`);

        // Insert products
        const insertedProducts = await batchInsertProducts(dbProducts);

        console.log('\n✅ Products inserted successfully!');
        console.log(`   Total: ${insertedProducts.length}`);
        console.log('\n💡 Next step: Run price tracking to fetch real data:');
        console.log(`   pnpm track:prices -- --limit ${insertedProducts.length}`);

    } catch (error) {
        console.error('\n❌ Seeding failed:', error);
        process.exit(1);
    }
}

// Run if executed directly
main();
