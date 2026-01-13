const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
    // Changes the cache location for Puppeteer to a non-hidden folder for better persistence.
    cacheDirectory: join(__dirname, 'puppeteer-cache'),
};
