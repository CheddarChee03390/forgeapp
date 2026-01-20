// Fetch one receipt from Etsy API to compare prices
import etsyClient from '../../services/etsy/etsyClient.js';

console.log('\n🔍 Fetching sample receipt from Etsy API...\n');

try {
    const shopId = await etsyClient.getShopId();
    const url = etsyClient.buildUrl(`/application/shops/${shopId}/receipts?limit=1&includes=Transactions`);
    const response = await etsyClient.etsyFetchWithApiKey(url);
    
    if (response.results && response.results.length > 0) {
        const receipt = response.results[0];
        console.log(`📦 Receipt #${receipt.receipt_id}`);
        console.log(`   Created: ${new Date(receipt.create_timestamp * 1000).toISOString()}`);
        console.log(`   Total (receipt): ${JSON.stringify(receipt.grandtotal)}`);
        console.log(`   Subtotal (receipt): ${JSON.stringify(receipt.subtotal)}`);
        console.log(`\n   Transactions (${receipt.transactions.length} items):`);
        
        receipt.transactions.forEach((t, i) => {
            console.log(`\n   ${i + 1}. Transaction #${t.transaction_id}`);
            console.log(`      Listing ID: ${t.listing_id}`);
            console.log(`      Title: ${t.title}`);
            console.log(`      Quantity: ${t.quantity}`);
            console.log(`      Price: ${JSON.stringify(t.price)}`);
            if (t.price?.amount && t.price?.divisor) {
                console.log(`      Calculated: ${t.price.amount} / ${t.price.divisor} = £${(t.price.amount / t.price.divisor).toFixed(2)}`);
            }
        });
    } else {
        console.log('   No receipts found');
    }
} catch (error) {
    console.error('❌ Error:', error.message);
}
