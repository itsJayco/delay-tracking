/**
 * Puppeteer-based Product Fetcher
 * Uses browser automation to extract product data (handles JavaScript-rendered content)
 */

import puppeteer, { Browser, Page } from 'puppeteer';

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
 * Extract product data from page using Puppeteer
 */
async function extractProductData(
    page: Page,
    merchant: string
): Promise<{ price: number; currency: string; title: string } | null> {
    try {
        const result = await page.evaluate((merchantName) => {
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
 * Fetch product data using Puppeteer
 */
export async function fetchProductWithPuppeteer(
    browser: Browser,
    url: string
): Promise<FetchedProduct | null> {
    const merchant = detectMerchant(url);
    if (!merchant) {
        console.warn(`⚠️  Unknown merchant for URL: ${url}`);
        return null;
    }

    const page = await browser.newPage();

    try {
        // Set user agent
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );

        // Navigate to product page
        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 30000,
        });

        // Wait for dynamic content
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Extract data
        const data = await extractProductData(page, merchant);

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
    } catch (error: any) {
        console.error(`❌ Error fetching ${url}:`, error.message);
        return null;
    } finally {
        await page.close();
    }
}

/**
 * Fetch multiple products with Puppeteer
 */
export async function fetchMultipleProductsWithPuppeteer(
    urls: string[],
    options: { delay?: number; maxConcurrent?: number } = {}
): Promise<FetchedProduct[]> {
    const { delay = 1000, maxConcurrent = 3 } = options;
    const products: FetchedProduct[] = [];

    console.log(`\n🌐 Fetching data for ${urls.length} products with Puppeteer...`);
    console.log(`⏱️  Rate limit: ${delay}ms delay, ${maxConcurrent} concurrent requests\n`);

    // Launch browser
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
        // Process in batches
        for (let i = 0; i < urls.length; i += maxConcurrent) {
            const batch = urls.slice(i, i + maxConcurrent);
            const batchNum = Math.floor(i / maxConcurrent) + 1;
            const totalBatches = Math.ceil(urls.length / maxConcurrent);

            console.log(`📦 Batch ${batchNum}/${totalBatches} (${batch.length} URLs)...`);

            // Fetch batch concurrently
            const results = await Promise.all(
                batch.map(url => fetchProductWithPuppeteer(browser, url))
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
                console.log(`  ⏳ Waiting ${delay}ms...\n`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    } finally {
        await browser.close();
    }

    console.log(`\n✅ Successfully fetched ${products.length}/${urls.length} products`);
    return products;
}
