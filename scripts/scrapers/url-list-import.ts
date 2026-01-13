import * as fs from 'fs';

/**
 * Simple URL list parser
 * Extracts only URLs from CSV, ignoring all other data
 * This makes us independent of Web Scraper's data quality
 */
export function parseUrlListCSV(filePath: string): string[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    if (lines.length === 0) {
        throw new Error('CSV file is empty');
    }

    // Parse header to find URL column
    const headerLine = lines[0];
    const headers = parseCSVLine(headerLine).map(h => h.trim().toLowerCase());

    const urlIndex = headers.indexOf('url');
    const orderIndex = headers.indexOf('web_scraper_order');

    if (urlIndex === -1) {
        throw new Error('No "url" column found in CSV');
    }

    console.log(`📄 Found ${headers.length} columns in CSV`);

    const urls: string[] = [];
    const seen = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);

        // Only process product rows (if web_scraper_order exists)
        if (orderIndex >= 0) {
            const order = values[orderIndex]?.trim();
            if (!order || !order.match(/^\d+-\d+$/)) {
                continue; // Skip non-product rows
            }
        }

        const url = values[urlIndex]?.trim().replace(/^"|"$/g, '');
        if (!url || !url.startsWith('http')) {
            continue;
        }

        // Clean and normalize URL
        let cleanUrl = url;
        try {
            const urlObj = new URL(cleanUrl);
            urlObj.hash = ''; // Remove hash
            urlObj.search = ''; // Remove all query params for deduplication
            cleanUrl = urlObj.toString();
        } catch (e) {
            console.warn(`⚠️  Invalid URL: ${url}`);
            continue;
        }

        // Deduplicate
        if (seen.has(cleanUrl)) {
            continue;
        }
        seen.add(cleanUrl);
        urls.push(url); // Use original URL (with params) for fetching
    }

    console.log(`✅ Extracted ${urls.length} unique URLs from CSV`);
    return urls;
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
