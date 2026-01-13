/**
 * Cron Job Entry Point for Railway/Render
 * Runs daily price tracking with intelligent prioritization
 */

import { trackPrices } from './track-prices.js';

async function main() {
    console.log('🕐 Cron job started at:', new Date().toISOString());
    console.log('🌍 Environment:', process.env.NODE_ENV || 'development');
    
    // Check for force mode from environment variable
    const forceMode = process.env.FORCE_MODE === 'true';
    console.log('🔧 Force mode:', forceMode ? 'ENABLED' : 'DISABLED');
    
    try {
        // Run price tracking with production settings
        await trackPrices({
            limit: 1000, // Track up to 1000 products
            concurrency: 5, // 5 concurrent pages (good for cloud servers)
            force: forceMode, // Use force mode if FORCE_MODE=true in env
        });
        
        console.log('✅ Cron job completed successfully at:', new Date().toISOString());
        process.exit(0);
    } catch (error) {
        console.error('❌ Cron job failed:', error);
        console.error('Stack trace:', (error as Error).stack);
        process.exit(1);
    }
}

// Run the cron job
main();
