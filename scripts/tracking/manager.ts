import { TrackingStrategy, DomainConfig, ProductToTrack, TrackingResult } from './types.js';
import { HttpFastStrategy } from './strategies/http-fast.js';
import { BrowserHardStrategy } from './strategies/browser-hard.js';

const DOMAIN_CONFIG: Record<string, DomainConfig> = {
    'mercadolibre.com': { strategy: 'BROWSER_HARD', difficulty: 'hard' },
    'mercadolibre.com.co': { strategy: 'BROWSER_HARD', difficulty: 'hard' },
    'mercadolibre.com.mx': { strategy: 'BROWSER_HARD', difficulty: 'hard' },
    'mercadolibre.com.br': { strategy: 'BROWSER_HARD', difficulty: 'hard' },
    'mercadolibre.cl': { strategy: 'BROWSER_HARD', difficulty: 'hard' },
    'amazon.com': { strategy: 'BROWSER_HARD', difficulty: 'hard' }, // Amazon usually needs browser
};

export class StrategyManager {
    private strategies: Map<string, TrackingStrategy> = new Map();

    constructor() {
        this.strategies.set('HTTP_FAST', new HttpFastStrategy());
        this.strategies.set('BROWSER_HARD', new BrowserHardStrategy());
    }

    /**
     * Determine best strategy for a product
     */
    getStrategyForProduct(product: ProductToTrack): TrackingStrategy {
        try {
            const url = new URL(product.original_url);
            const hostname = url.hostname.replace('www.', '');

            // Check exact match or partial match
            for (const [domain, config] of Object.entries(DOMAIN_CONFIG)) {
                if (hostname.includes(domain)) {
                    const strategy = this.strategies.get(config.strategy);
                    if (strategy) return strategy;
                }
            }
        } catch (e) {}

        // Default to fast HTTP
        return this.strategies.get('HTTP_FAST')!;
    }

    /**
     * execute tracking for a product
     */
    async trackProduct(product: ProductToTrack): Promise<TrackingResult> {
        const strategy = this.getStrategyForProduct(product);
        return await strategy.track(product);
    }

    /**
     * Cleanup all strategies
     */
    async closeAll() {
        for (const strategy of this.strategies.values()) {
            if (strategy.close) {
                await strategy.close();
            }
        }
    }
}
