import { extractMercadoLibreData } from './csv-import';

export interface FetchedProduct {
    url: string;
    title: string;
    price: number;
    currency: string;
    merchant: string;
}

/**
 * Detect merchant from URL
 */
function detectMerchant(url: string): string | null {
    const hostname = new URL(url).hostname.toLowerCase();

    if (hostname.includes('mercadolibre')) return 'mercadolibre';
    if (hostname.includes('amazon')) return 'amazon';
    if (hostname.includes('exito')) return 'exito';
    if (hostname.includes('falabella')) return 'falabella';
    if (hostname.includes('zara')) return 'zara';
    if (hostname.includes('hm.com')) return 'hm';
    if (hostname.includes('nike')) return 'nike';
    if (hostname.includes('adidas')) return 'adidas';

    return null;
}

/**
 * Fetch product data from URL
 * Uses store-specific extractors to get real, current data
 */
export async function fetchProductData(url: string): Promise<FetchedProduct | null> {
    const merchant = detectMerchant(url);
    if (!merchant) {
        console.warn(`⚠️  Unknown merchant for URL: ${url}`);
        return null;
    }

    try {
        // Fetch HTML
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
        });

        if (!response.ok) {
            console.warn(`⚠️  Failed to fetch ${url}: ${response.status}`);
            return null;
        }

        const html = await response.text();

        // Extract data based on merchant
        let data: { title: string; price: number; currency: string } | null = null;

        switch (merchant) {
            case 'mercadolibre':
                data = extractMercadoLibreData(html);
                break;
            // TODO: Add extractors for other stores
            default:
                console.warn(`⚠️  No extractor for merchant: ${merchant}`);
                return null;
        }

        if (!data || !data.price) {
            console.warn(`⚠️  Failed to extract data from ${url}`);
            return null;
        }

        return {
            url,
            title: data.title,
            price: data.price,
            currency: data.currency,
            merchant,
        };
    } catch (error) {
        console.error(`❌ Error fetching ${url}:`, error);
        return null;
    }
}

/**
 * Fetch multiple products with rate limiting
 */
export async function fetchMultipleProducts(
    urls: string[],
    options: { delay?: number; maxConcurrent?: number } = {}
): Promise<FetchedProduct[]> {
    const { delay = 1000, maxConcurrent = 3 } = options;
    const products: FetchedProduct[] = [];

    console.log(`\n🌐 Fetching data for ${urls.length} products...`);
    console.log(`⏱️  Rate limit: ${delay}ms delay, ${maxConcurrent} concurrent requests\n`);

    // Process in batches
    for (let i = 0; i < urls.length; i += maxConcurrent) {
        const batch = urls.slice(i, i + maxConcurrent);
        const batchNum = Math.floor(i / maxConcurrent) + 1;
        const totalBatches = Math.ceil(urls.length / maxConcurrent);

        console.log(`📦 Batch ${batchNum}/${totalBatches} (${batch.length} URLs)...`);

        // Fetch batch concurrently
        const results = await Promise.all(
            batch.map(url => fetchProductData(url))
        );

        // Add successful results
        for (const product of results) {
            if (product) {
                products.push(product);
                console.log(`  ✅ ${product.title.substring(0, 60)}... - $${product.price.toLocaleString()} ${product.currency}`);
            }
        }

        // Wait before next batch (except for last batch)
        if (i + maxConcurrent < urls.length) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    console.log(`\n✅ Successfully fetched ${products.length}/${urls.length} products`);
    return products;
}
