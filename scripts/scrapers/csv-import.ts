/**
 * CSV Import Scraper
 * Reads a CSV file with product URLs and fetches correct data using our adapters
 */

import * as fs from 'fs';
import * as path from 'path';

export interface CSVProduct {
    url: string;
    title?: string;
    [key: string]: any; // Allow other CSV columns
}

/**
 * Parse CSV file to extract product URLs
 * Assumes CSV has at least a 'url' or 'link' column
 */
export function parseCSV(filePath: string): CSVProduct[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    if (lines.length === 0) {
        throw new Error('CSV file is empty');
    }

    // Parse header - handle quoted fields
    const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
    const urlColumnIndex = headers.findIndex(h => h === 'url' || h === 'link' || h === 'permalink' || h === 'web-scraper-href');

    if (urlColumnIndex === -1) {
        console.warn('Available columns:', headers);
        throw new Error('CSV must have a "url", "link", "permalink", or "web-scraper-href" column');
    }

    console.log(`Found URL column: "${headers[urlColumnIndex]}" at index ${urlColumnIndex}`);

    // Parse rows
    const products: CSVProduct[] = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);

        if (values.length > urlColumnIndex && values[urlColumnIndex]) {
            const rawUrl = values[urlColumnIndex].trim();

            // Clean URL - remove quotes and tracking parameters
            let cleanUrl = rawUrl.replace(/^"|"$/g, '');

            // Remove URL fragments and tracking
            try {
                const urlObj = new URL(cleanUrl);
                // Remove hash/fragment
                urlObj.hash = '';
                cleanUrl = urlObj.toString();
            } catch (e) {
                // If URL parsing fails, use as-is
            }

            const product: CSVProduct = {
                url: cleanUrl,
            };

            // Add other columns as metadata
            headers.forEach((header, index) => {
                if (index !== urlColumnIndex && values[index]) {
                    product[header] = values[index].replace(/^"|"$/g, '').trim();
                }
            });

            products.push(product);
        }
    }

    console.log(`📄 Parsed ${products.length} products from CSV`);
    return products;
}

/**
 * Parse a single CSV line, handling quoted fields
 */
function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    result.push(current.trim());
    return result;
}

/**
 * Detect merchant from URL
 */
export function detectMerchantFromUrl(url: string): string | null {
    const urlLower = url.toLowerCase();

    if (urlLower.includes('mercadolibre') || urlLower.includes('mercadolivre')) {
        return 'mercadolibre';
    }
    if (urlLower.includes('amazon')) {
        return 'amazon';
    }
    if (urlLower.includes('ebay')) {
        return 'ebay';
    }
    if (urlLower.includes('exito.com')) {
        return 'exito';
    }
    if (urlLower.includes('falabella')) {
        return 'falabella';
    }

    return null;
}

/**
 * Fetch product data from URL using JSDOM (server-side scraping)
 */
export async function fetchProductFromUrl(url: string, merchant: string): Promise<any> {
    console.log(`🔍 Fetching ${merchant} product: ${url.substring(0, 60)}...`);

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8',
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const html = await response.text();

        // Extract data based on merchant
        const productData = extractProductData(html, url, merchant);

        if (!productData.price) {
            console.warn(`⚠️ No price found for ${url}`);
        }

        return productData;
    } catch (error) {
        console.error(`❌ Failed to fetch ${url}:`, error);
        return null;
    }
}

/**
 * Extract product data from HTML based on merchant
 */
function extractProductData(html: string, url: string, merchant: string): any {
    switch (merchant) {
        case 'mercadolibre':
            return extractMercadoLibreData(html, url);
        case 'amazon':
            return extractAmazonData(html, url);
        default:
            return { url, title: 'Unknown', price: 0, currency: 'COP' };
    }
}

/**
 * Extract MercadoLibre product data from HTML
 */
export function extractMercadoLibreData(html: string, url?: string): any {
    let price = 0;
    let currency = 'COP';
    let title = '';

    // Method 1: Try JSON-LD (most reliable)
    const jsonLdMatch = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
    if (jsonLdMatch) {
        try {
            const jsonLd = JSON.parse(jsonLdMatch[1]);
            if (jsonLd.offers?.price) {
                price = parseFloat(jsonLd.offers.price);
                currency = jsonLd.offers.priceCurrency || 'COP';
            }
            if (jsonLd.name) {
                title = jsonLd.name;
            }
        } catch (e) {
            // Continue to other methods
        }
    }

    // Method 2: Try meta tags
    if (!price) {
        const priceMatch = html.match(/<meta property="og:price:amount" content="([^"]+)"/i);
        if (priceMatch) {
            price = parseFloat(priceMatch[1].replace(/[^0-9.]/g, ''));
        }
    }

    // Method 3: Try to find price in script tags (ML often embeds data in __PRELOADED_STATE__)
    if (!price) {
        const preloadedMatch = html.match(/window\.__PRELOADED_STATE__\s*=\s*({[\s\S]*?});/i);
        if (preloadedMatch) {
            try {
                const preloaded = JSON.parse(preloadedMatch[1]);
                // Navigate through the object to find price
                const priceData = JSON.stringify(preloaded).match(/"price":(\d+\.?\d*)/i);
                if (priceData) {
                    price = parseFloat(priceData[1]);
                }
            } catch (e) {
                // Continue
            }
        }
    }

    // Method 4: Look for price in common HTML patterns
    if (!price) {
        // Try to find price-related class names
        const pricePatterns = [
            /<span[^>]*class="[^"]*price[^"]*"[^>]*>\s*\$?\s*([\d,.]+)/i,
            /<div[^>]*class="[^"]*price[^"]*"[^>]*>\s*\$?\s*([\d,.]+)/i,
            /"price"\s*:\s*"?([\d,.]+)"?/i,
            /precio[^>]*>\s*\$?\s*([\d,.]+)/i,
        ];

        for (const pattern of pricePatterns) {
            const match = html.match(pattern);
            if (match) {
                const priceStr = match[1].replace(/[^0-9.]/g, '');
                const parsedPrice = parseFloat(priceStr);
                if (parsedPrice > 0) {
                    price = parsedPrice;
                    break;
                }
            }
        }
    }

    // Extract currency
    if (!currency || currency === 'COP') {
        const currencyMatch = html.match(/<meta property="og:price:currency" content="([^"]+)"/i);
        if (currencyMatch) {
            currency = currencyMatch[1];
        }
    }

    // Extract title
    if (!title) {
        const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/i);
        if (titleMatch) {
            title = titleMatch[1];
        }
    }

    // Fallback: try to get title from <title> tag
    if (!title) {
        const titleTagMatch = html.match(/<title>([^<]+)<\/title>/i);
        if (titleTagMatch) {
            title = titleTagMatch[1].replace(/ \| Mercado Libre.*$/i, '').trim();
        }
    }

    console.log(`   Extracted: ${title.substring(0, 50)}... - $${price} ${currency}`);

    return {
        url: url || '',
        title: title || 'Unknown Product',
        price,
        currency,
    };
}

/**
 * Extract Amazon product data from HTML
 */
function extractAmazonData(html: string, url: string): any {
    // Similar extraction logic for Amazon
    // This is a placeholder - implement based on Amazon's HTML structure
    return {
        url,
        title: 'Amazon Product',
        price: 0,
        currency: 'COP',
    };
}

/**
 * Process CSV file and fetch all products
 */
export async function processCSVFile(
    filePath: string,
    options: { limit?: number; delay?: number } = {}
): Promise<any[]> {
    const { limit = Infinity, delay = 1000 } = options;

    const csvProducts = parseCSV(filePath);
    const productsToProcess = csvProducts.slice(0, limit);

    console.log(`\n🚀 Processing ${productsToProcess.length} products from CSV...\n`);

    const results: any[] = [];

    for (let i = 0; i < productsToProcess.length; i++) {
        const csvProduct = productsToProcess[i];
        const merchant = detectMerchantFromUrl(csvProduct.url);

        if (!merchant) {
            console.warn(`⚠️ Unknown merchant for URL: ${csvProduct.url}`);
            continue;
        }

        const productData = await fetchProductFromUrl(csvProduct.url, merchant);

        if (productData) {
            results.push({
                ...productData,
                merchant,
            });
            console.log(`✅ [${i + 1}/${productsToProcess.length}] ${productData.title.substring(0, 50)}... - $${productData.price} ${productData.currency}`);
        }

        // Rate limiting
        if (i < productsToProcess.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    console.log(`\n✅ Successfully processed ${results.length}/${productsToProcess.length} products\n`);

    return results;
}
