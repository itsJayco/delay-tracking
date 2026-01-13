import { TrackingStrategy, ProductToTrack, TrackingResult } from '../types.js';

export class HttpFastStrategy implements TrackingStrategy {
    name = 'HTTP_FAST';

    async track(product: ProductToTrack): Promise<TrackingResult> {
        console.log(`⚡ [HTTP_FAST] Tracking ${product.title.substring(0, 40)}...`);

        try {
            const response = await fetch(product.original_url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8',
                },
                redirect: 'follow'
            });

            if (!response.ok) {
                if (response.status === 403 || response.status === 401) {
                    throw new Error(`Auth/Bot blockade (HTTP ${response.status})`);
                }
                throw new Error(`HTTP ${response.status} ${response.statusText}`);
            }

            const html = await response.text();
            
            // Extract Data (Simplified for now, will expand with adapters)
            const priceData = this.extractPrice(html, product.merchant);

            if (!priceData.price) {
                return {
                    productId: product.id,
                    success: false,
                    error: 'Price not found',
                    strategyUsed: this.name
                };
            }

            return {
                productId: product.id,
                success: true,
                price: priceData.price,
                currency: priceData.currency,
                strategyUsed: this.name
            };

        } catch (error: any) {
            console.error(`   ❌ [HTTP_FAST] Failed: ${error.message}`);
            return {
                productId: product.id,
                success: false,
                error: error.message,
                strategyUsed: this.name
            };
        }
    }

    private extractPrice(html: string, merchant: string): { price?: number; currency?: string } {
        // Generic extraction logic (similar to csv-import)
        let price = 0;
        let currency = 'COP';

        // 1. JSON-LD
        const jsonLdMatch = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
        if (jsonLdMatch) {
            try {
                const jsonLd = JSON.parse(jsonLdMatch[1]);
                const offer = Array.isArray(jsonLd) ? jsonLd.find(i => i['@type'] === 'Product')?.offers : jsonLd.offers;
                const priceVal = offer?.price || offer?.[0]?.price;
                if (priceVal) {
                    return { price: parseFloat(priceVal), currency: offer?.priceCurrency || 'COP' };
                }
            } catch (e) {}
        }

        // 2. Meta Tags
        const metaPrice = html.match(/<meta property="product:price:amount" content="([\d.]+)"/i) || 
                          html.match(/<meta property="og:price:amount" content="([\d.]+)"/i) ||
                          html.match(/<meta itemprop="price" content="([\d.]+)"/i);
        
        if (metaPrice && metaPrice[1]) {
            return { price: parseFloat(metaPrice[1]), currency: 'COP' };
        }

        // 3. Regex Fallback
        // ... (can add more patterns later)

        return { price, currency };
    }
}
