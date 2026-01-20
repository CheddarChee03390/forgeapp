import 'dotenv/config';
import etsyClient from '../../services/etsy/etsyClient.js';
import fs from 'fs';

async function testRawEtsyAPI() {
    try {
        const shopId = await etsyClient.getShopId();
        console.log(`Shop ID: ${shopId}`);

        // Calculate date range (last 300 days)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 300);
        
        const minCreated = Math.floor(startDate.getTime() / 1000);
        const maxCreated = Math.floor(endDate.getTime() / 1000) + 86399;

        // Build URL with was_paid=true (your current filter)
        const url = etsyClient.buildUrl(
            `/application/shops/${shopId}/receipts?was_paid=true&min_created=${minCreated}&max_created=${maxCreated}&limit=100`
        );

        console.log(`\nCalling: ${url}\n`);

        const response = await etsyClient.etsyFetchWithApiKey(url);
        
        if (!response.ok) {
            const error = await response.text();
            console.error('API Error:', response.status, error);
            return;
        }

        const data = await response.json();
        
        // Write full response to file
        fs.writeFileSync('raw-etsy-response.json', JSON.stringify(data, null, 2));
        
        console.log(`✅ Response saved to raw-etsy-response.json`);
        console.log(`\nTotal receipts: ${data.results?.length || 0}`);
        console.log(`Receipt IDs: ${data.results?.map(r => r.receipt_id).sort((a,b) => a-b).join(', ')}`);
        
        // Check for the cancelled order
        const target = data.results?.find(r => r.receipt_id === 3664474997);
        console.log(`\nContains 3664474997: ${target ? 'YES ✓' : 'NO ✗'}`);
        
        if (target) {
            console.log('\nReceipt 3664474997 details:');
            console.log(JSON.stringify(target, null, 2));
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

testRawEtsyAPI();
