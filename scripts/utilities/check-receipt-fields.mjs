// Check what fields are available on receipts from Etsy API
import etsyClient from '../../services/etsy/etsyClient.js';

console.log('\n🔍 Fetching receipt to see available fields...\n');

try {
    const shopId = await etsyClient.getShopId();
    
    // Get receipts from a broad date range
    const endDate = new Date();
    const startDate = new Date('2025-01-01');
    
    const minCreated = Math.floor(startDate.getTime() / 1000);
    const maxCreated = Math.floor(endDate.getTime() / 1000);
    
    const params = new URLSearchParams({
        limit: '5',
        min_created: minCreated.toString(),
        max_created: maxCreated.toString(),
        was_paid: 'true'
    });
    params.append('includes', 'Transactions');
    
    const url = etsyClient.buildUrl(`/application/shops/${shopId}/receipts?${params}`);
    const response = await etsyClient.etsyFetchWithApiKey(url);
    
    if (response.results && response.results.length > 0) {
        const receipt = response.results[0];
        console.log('📦 Sample Receipt Fields:\n');
        console.log(`receipt_id: ${receipt.receipt_id}`);
        console.log(`was_paid: ${receipt.was_paid}`);
        console.log(`was_shipped: ${receipt.was_shipped}`);
        console.log(`status: ${receipt.status}`);
        console.log(`is_gift: ${receipt.is_gift}`);
        console.log(`refunds: ${JSON.stringify(receipt.refunds)}`);
        console.log(`discount_amt: ${JSON.stringify(receipt.discount_amt)}`);
        console.log(`grandtotal: ${JSON.stringify(receipt.grandtotal)}`);
        console.log(`\nAll available fields:`);
        console.log(Object.keys(receipt).sort().join(', '));
        
        console.log('\n\nFull receipt object (first one):');
        console.log(JSON.stringify(receipt, null, 2));
    } else {
        console.log('No receipts found');
    }
} catch (error) {
    console.error('❌ Error:', error.message);
}
