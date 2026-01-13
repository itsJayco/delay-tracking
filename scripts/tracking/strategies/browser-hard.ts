import { TrackingStrategy, ProductToTrack, TrackingResult, ExtractedProduct, ExtractedPrice, StoreAdapter } from '../types.js';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';

puppeteer.use(StealthPlugin());

// User agent rotation
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

export class BrowserHardStrategy implements TrackingStrategy {
    name = 'BROWSER_HARD';
    private browser: Browser | null = null;

    async track(product: ProductToTrack): Promise<TrackingResult> {
        console.log(`🛡️ [BROWSER_HARD] Tracking ${product.title.substring(0, 40)}...`);

        if (!this.browser) {
            await this.initBrowser();
        }

        let page: Page | null = null;

        try {
            page = await this.browser!.newPage();
            
            // Viewport & Headers
            await page.setViewport({ width: 1920, height: 1080 });
            await page.setUserAgent(USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]);
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8',
            });

            // TURBO MODE: Block heavy resources
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                if (req.isInterceptResolutionHandled()) return;
                const resourceType = req.resourceType();
                if (['image', 'stylesheet', 'font', 'media', 'other'].includes(resourceType) || 
                    req.url().includes('google-analytics') || req.url().includes('doubleclick')) {
                    req.abort().catch(() => {});
                } else {
                    req.continue().catch(() => {});
                }
            });

            // Navigate
            try {
                await page.goto(product.original_url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            } catch (e) { /* Ignore timeout if content loaded */ }

            // Smart Wait
            try {
                await Promise.race([
                    page.waitForSelector('.andes-money-amount__fraction, meta[itemprop="price"]', { timeout: 10000 }),
                    page.waitForFunction(() => window.location.href.includes('account-verification'), { timeout: 10000 })
                ]);
            } catch (e) {}

            // Check Bot Detection
            if (page.url().includes('account-verification') || page.url().includes('/gz/')) {
                return { productId: product.id, success: false, error: 'Bot detection (redirect)', strategyUsed: this.name };
            }

            // Inject Adapter Logic & Extract
            const extractedData = await page.evaluate(this.getAdapterLogic(), product.merchant);

            if (!extractedData || !extractedData.price || extractedData.price.amount === null) {
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
                price: extractedData.price.amount,
                currency: extractedData.price.currency || 'COP',
                strategyUsed: this.name
            };

        } catch (error: any) {
            console.error(`   ❌ [BROWSER_HARD] Failed: ${error.message}`);
            return {
                productId: product.id,
                success: false,
                error: (error as Error).message,
                strategyUsed: this.name
            };
        } finally {
            if (page) {
                try {
                    await page.setRequestInterception(false).catch(() => {});
                    await page.close();
                } catch (e) {}
            }
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    private async initBrowser() {
        const launchOptions = {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled'],
        };

        try {
            this.browser = await puppeteer.launch(launchOptions);
        } catch (error: any) {
            if (error.message.includes('Could not find Chrome')) {
                console.log('⚠️ Chrome not found. Installing...');
                const { execSync } = await import('child_process');
                execSync('npx puppeteer browsers install chrome', { stdio: 'inherit' });
                this.browser = await puppeteer.launch(launchOptions);
            } else {
                throw error;
            }
        }
    }

    /**
     * Injects the MercadoLibre adapter logic into the page
     * This is the exact code provided by the user, adapted to run inside page.evaluate
     */
    private getAdapterLogic() {
        return (merchantName: string): ExtractedProduct | null => {
            // --- ADAPTER CODE START ---
            
            // Helper Types (Mocked inside browser context)
            interface ExtractedPrice { raw: string | null; amount: number | null; currency: string | null; }
            interface ExtractedProduct { title: string; price: ExtractedPrice; image: string | null; sku: string | null; }

            function log(...args: any[]) { /* Silent in prod */ }

            function parsePrice(raw: string): ExtractedPrice {
                if (!raw) return { raw: null, amount: null, currency: null };
                const match = raw.match(/([$€£¥A-Z]{1,3})?\s*([\d,.]+)/i);
                if (!match) return { raw, amount: null, currency: null };

                let amountStr = match[2];
                const host = window.location.hostname;
                let currency = "USD"; 

                if (host.includes(".com.br")) currency = "BRL";
                else if (host.includes(".com.co")) currency = "COP";
                else if (host.includes(".com.mx")) currency = "MXN"; // etc... simplified for brevity
                else if (host.includes(".cl")) currency = "CLP";
                
                // Simplified generic parsing for LATAM
                if (["COP", "CLP", "ARS", "BRL"].includes(currency)) {
                    if (amountStr.includes(".") && !amountStr.includes(",")) {
                         amountStr = amountStr.replace(/\./g, ""); 
                    } else if (amountStr.includes(",") && amountStr.includes(".")) {
                        amountStr = amountStr.replace(/\./g, "").replace(",", ".");
                    } else if (amountStr.includes(",")) {
                         amountStr = amountStr.replace(",", ".");
                    }
                }

                const amount = parseFloat(amountStr);
                return { raw, amount: isNaN(amount) ? null : amount, currency };
            }

            function extractSku(): string | null {
                const url = window.location.href;
                const urlMatch = url.match(/\/([A-Z]{3}-?\d+)-/);
                if (urlMatch) return urlMatch[1].replace("-", "");
                const input = document.querySelector<HTMLInputElement>("input[name='item_id']");
                return input?.value || null;
            }

            function extractImage(): string | null {
                const og = document.querySelector<HTMLMetaElement>('meta[property="og:image"]');
                return og?.content || document.querySelector<HTMLImageElement>("img.ui-pdp-image")?.src || null;
            }

            // Main Extraction
            if (merchantName !== 'mercadolibre') return null; // Only for ML for now in this strategy

            const title = document.querySelector("h1.ui-pdp-title")?.textContent?.trim() ||
                          document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content ||
                          document.title.split("|")[0].trim();

            let price: ExtractedPrice = { raw: null, amount: null, currency: null };

            // 1. Meta Tag
            const metaPrice = document.querySelector<HTMLMetaElement>('meta[itemprop="price"]');
            if (metaPrice?.content) {
                price = parsePrice(metaPrice.content);
                if (!price.currency || price.currency === 'USD') {
                     // Force re-parse with symbol to trigger logic if needed, or just trust content
                     if (window.location.hostname.includes('.co')) price.currency = 'COP';
                }
            }

            // 2. DOM Fallback
            if (price.amount === null) {
                const priceSelectors = [
                    ".ui-pdp-price__second-line .andes-money-amount__fraction",
                    ".ui-pdp-price--main .andes-money-amount__fraction",
                    ".andes-money-amount__fraction"
                ];

                for (const sel of priceSelectors) {
                    const el = document.querySelector(sel);
                    if (el && el.textContent) {
                        const parent = el.closest(".andes-money-amount");
                        const cents = parent?.querySelector(".andes-money-amount__cents")?.textContent;
                        let textPrice = el.textContent;
                        if (cents) textPrice += `,${cents}`;
                        
                        price = parsePrice(textPrice);
                        if (price.amount !== null) break;
                    }
                }
            }

            return {
                title: title || 'Unknown',
                price,
                image: extractImage(),
                sku: extractSku()
            };
            // --- ADAPTER CODE END ---
        };
    }
}
