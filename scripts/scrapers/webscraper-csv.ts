import * as fs from 'fs';

interface WebScraperProduct {
    url: string;
    title: string;
    price: number;
    currency: string;
    merchant: string;
}

/**
 * Parse Web Scraper CSV format
 * Only extracts rows that are actual products (web_scraper_order ends with -N)
 */
export function parseWebScraperCSV(filePath: string): WebScraperProduct[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    if (lines.length === 0) {
        throw new Error('CSV file is empty');
    }

    // Parse header
    const headerLine = lines[0];
    const headers = parseCSVLine(headerLine).map(h => h.trim().toLowerCase());

    console.log(`📄 Found ${headers.length} columns in CSV`);

    // Find column indices
    const indices = {
        order: headers.indexOf('web_scraper_order'),
        url: headers.indexOf('url'),
        name: headers.indexOf('name_0'),
        title: headers.indexOf('title_0'),
        data0: headers.indexOf('data_0'),
        data1: headers.indexOf('data_1'),
        data2: headers.indexOf('data_2'),
    };

    const products: WebScraperProduct[] = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);

        // Only process rows where web_scraper_order matches pattern like "1768228070-1"
        const order = values[indices.order]?.trim();
        if (!order || !order.match(/^\d+-\d+$/)) {
            continue; // Skip description rows
        }

        const url = values[indices.url]?.trim();
        if (!url || !url.startsWith('http')) {
            continue; // Skip if no valid URL
        }

        // Clean URL
        let cleanUrl = url.replace(/^"|"$/g, '');
        try {
            const urlObj = new URL(cleanUrl);
            urlObj.hash = ''; // Remove tracking
            cleanUrl = urlObj.toString();
        } catch (e) {
            console.warn(`⚠️  Invalid URL: ${url}`);
            continue;
        }

        // Detect merchant
        const merchant = detectMerchant(cleanUrl);
        if (!merchant) {
            console.warn(`⚠️  Unknown merchant for URL: ${cleanUrl}`);
            continue;
        }

        // Extract title - try name_0 first, then title_0
        let title = 'Unknown Product';
        if (indices.name >= 0 && values[indices.name]) {
            title = values[indices.name].replace(/^"|"$/g, '').trim();
        } else if (indices.title >= 0 && values[indices.title]) {
            title = values[indices.title].replace(/^"|"$/g, '').trim();
        }

        // Extract price from data columns
        // Web Scraper puts price parts in data_0, data_1, data_2
        // Example: data_0="$", data_1="", data_2="49.612" or data_1="70.378", data_2="23.459"
        let price = 0;
        let currency = 'COP';

        const data0 = values[indices.data0]?.replace(/^"|"$/g, '').trim() || '';
        const data1 = values[indices.data1]?.replace(/^"|"$/g, '').trim() || '';
        const data2 = values[indices.data2]?.replace(/^"|"$/g, '').trim() || '';

        // Try to extract price from data columns
        if (data2 && data2.match(/^\d+[\d,.]*$/)) {
            // data_2 usually has the main price
            price = parseFloat(data2.replace(/[,.]/g, ''));
        } else if (data1 && data1.match(/^\d+[\d,.]*$/)) {
            // Sometimes it's in data_1
            price = parseFloat(data1.replace(/[,.]/g, ''));
        }

        // Detect currency
        if (data0 === '$' || data0.includes('$')) {
            currency = 'COP'; // Assume Colombian Peso for MercadoLibre Colombia
        }

        products.push({
            url: cleanUrl,
            title,
            price,
            currency,
            merchant,
        });
    }

    console.log(`✅ Extracted ${products.length} valid products from CSV`);
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
function detectMerchant(url: string): string | null {
    if (url.includes('mercadolibre.com') || url.includes('mercadolibre.co')) {
        return 'mercadolibre';
    }
    if (url.includes('amazon.com')) {
        return 'amazon';
    }
    if (url.includes('exito.com')) {
        return 'exito';
    }
    return null;
}
