export interface TrackingResult {
    productId: string;
    success: boolean;
    price?: number;
    currency?: string;
    error?: string;
    strategyUsed: string;
}

export interface ProductToTrack {
    id: string;
    merchant: string;
    original_url: string;
    title: string;
}

export interface TrackingStrategy {
    name: string;
    
    /**
     * Track a single product using this strategy
     */
    track(product: ProductToTrack): Promise<TrackingResult>;

    /**
     * Clean up any resources (e.g. close browser)
     */
    close?(): Promise<void>;
}

export type StrategyType = 'HTTP_FAST' | 'BROWSER_LIGHT' | 'BROWSER_HARD' | 'FALLBACK_API';

export interface DomainConfig {
    strategy: StrategyType;
    difficulty: 'easy' | 'medium' | 'hard';
}

/**
 * Data structures aligned with Chrome Extension
 */
export interface ExtractedPrice {
    raw: string | null;
    amount: number | null;
    currency: string | null;
}

export interface ExtractedProduct {
    title: string;
    price: ExtractedPrice;
    image: string | null;
    sku: string | null;
}

export interface StoreAdapter {
    id: string;
    domains: string[];
    detect(): boolean;
    isProductPage(): boolean;
    extract(): ExtractedProduct | null;
    getCleanUrl?(): string;
}
