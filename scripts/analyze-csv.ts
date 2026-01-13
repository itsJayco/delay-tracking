import * as fs from 'fs';
import { parseCSV } from './scrapers/csv-import';

// Read and analyze the CSV structure
const csvPath = process.argv[2] || 'C:\\Users\\triid\\Downloads\\mercadolibre-com-co-2026-01-11.csv';

console.log('Analyzing CSV structure...\n');

const content = fs.readFileSync(csvPath, 'utf-8');
const lines = content.split('\n').filter(line => line.trim());

// Parse header
const headers = lines[0].split(',').map(h => h.trim());
console.log('Headers:', headers.slice(0, 15));
console.log('\nTotal rows:', lines.length);

// Show first 3 data rows
console.log('\nFirst 3 product rows:');
for (let i = 1; i <= Math.min(3, lines.length - 1); i++) {
    const values = lines[i].split(',');
    console.log(`\nRow ${i}:`);
    console.log('  web_scraper_order:', values[0]);
    console.log('  url:', values[2]?.substring(0, 80));
    console.log('  name_0:', values[6]);
    console.log('  data_0:', values[3]);
    console.log('  data_1:', values[4]);
    console.log('  data_2:', values[5]);
}
