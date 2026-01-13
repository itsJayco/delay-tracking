/**
 * MercadoLibre Scraper
 * Fetches top-selling products from MercadoLibre Colombia using their official API
 */

export interface MLProduct {
    id: string;
    title: string;
    price: number;
    currency_id: string;
    permalink: string;
    thumbnail: string;
    sold_quantity?: number;
}

export interface MLSearchResponse {
    results: MLProduct[];
    paging: {
        total: number;
        offset: number;
        limit: number;
    };
}

/**
 * Fetch best-selling products from MercadoLibre Colombia
 * @param category - Category ID (e.g., 'MCO1000' for Electronics)
 * @param limit - Number of products to fetch
 */
export async function fetchMercadoLibreBestSellers(
    category: string = 'MCO1000',
    limit: number = 100
): Promise<MLProduct[]> {
    const url = `https://api.mercadolibre.com/sites/MCO/search?category=${category}&sort=sold_quantity_desc&limit=${limit}`;

    console.log(`🔍 Fetching MercadoLibre best sellers from category ${category}...`);

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`MercadoLibre API error: ${response.status} ${response.statusText}`);
        }

        const data: MLSearchResponse = await response.json();

        console.log(`✅ Found ${data.results.length} products (total available: ${data.paging.total})`);

        return data.results;
    } catch (error) {
        console.error('❌ Error fetching MercadoLibre products:', error);
        throw error;
    }
}

/**
 * Fetch products from multiple categories
 */
export async function fetchMultipleCategories(
    categories: string[],
    productsPerCategory: number = 50
): Promise<MLProduct[]> {
    console.log(`📦 Fetching products from ${categories.length} categories...`);

    const allProducts: MLProduct[] = [];

    for (const category of categories) {
        try {
            const products = await fetchMercadoLibreBestSellers(category, productsPerCategory);
            allProducts.push(...products);

            // Rate limiting: wait 500ms between requests
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            console.error(`⚠️ Failed to fetch category ${category}:`, error);
            // Continue with other categories
        }
    }

    console.log(`✅ Total products fetched: ${allProducts.length}`);

    return allProducts;
}

/**
 * Popular MercadoLibre Colombia categories
 */
export const POPULAR_CATEGORIES = {
    ELECTRONICS: 'MCO1000',           // Electrónica, Audio y Video
    PHONES: 'MCO1055',                // Celulares y Teléfonos
    COMPUTERS: 'MCO1648',             // Computación
    HOME_APPLIANCES: 'MCO5726',       // Electrodomésticos
    FASHION: 'MCO1430',               // Ropa y Accesorios
    SPORTS: 'MCO1276',                // Deportes y Fitness
    HOME: 'MCO1574',                  // Hogar, Muebles y Jardín
    BEAUTY: 'MCO1246',                // Belleza y Cuidado Personal
    TOYS: 'MCO1132',                  // Juegos y Juguetes
    BOOKS: 'MCO3025',                 // Libros, Revistas y Comics
};
