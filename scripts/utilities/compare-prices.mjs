// Fetch a receipt with full price breakdown
import etsyClient from '../../services/etsy/etsyClient.js';

console.log('\n🔍 Fetching receipt with full price data...\n');

try {
    const shopId = await etsyClient.getShopId();
    
    // Get a date range that should have orders
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 300); // Last 300 days
    
    const minCreated = Math.floor(startDate.getTime() / 1000);
    const maxCreated = Math.floor(endDate.getTime() / 1000);
    
    const params = new URLSearchParams({
        limit: '3',
        was_paid: 'true',
        min_created: minCreated.toString(),
        max_created: maxCreated.toString()
    });
    params.append('includes', 'Transactions');
    
    const url = etsyClient.buildUrl(`/application/shops/${shopId}/receipts?${params}`);
    const response = await etsyClient.etsyFetchWithApiKey(url);
    
    if (response.results && response.results.length > 0) {
        for (const receipt of response.results) {
            console.log(`\n${'='.repeat(80)}`);
            console.log(`📦 RECEIPT #${receipt.receipt_id}`);
            console.log(`${'='.repeat(80)}`);
            console.log(`Created: ${new Date(receipt.create_timestamp * 1000).toISOString().split('T')[0]}`);
            console.log(`\nRECEIPT LEVEL PRICES:`);
            console.log(`  grandtotal: ${JSON.stringify(receipt.grandtotal)}`);
            console.log(`  subtotal: ${JSON.stringify(receipt.subtotal)}`);
            console.log(`  total_price: ${JSON.stringify(receipt.total_price)}`);
            console.log(`  total_shipping_cost: ${JSON.stringify(receipt.total_shipping_cost)}`);
            console.log(`  total_tax_cost: ${JSON.stringify(receipt.total_tax_cost)}`);
            console.log(`  total_vat_cost: ${JSON.stringify(receipt.total_vat_cost)}`);
            console.log(`  discount_amt: ${JSON.stringify(receipt.discount_amt)}`);
            
            console.log(`\nTRANSACTIONS (${receipt.transactions.length} items):`);
            receipt.transactions.forEach((t, i) => {
                console.log(`\n  ${i + 1}. Transaction #${t.transaction_id}`);
                console.log(`     listing_id: ${t.listing_id}`);
                console.log(`     title: ${t.title}`);
                console.log(`     quantity: ${t.quantity}`);
                console.log(`     price: ${JSON.stringify(t.price)}`);
                if (t.price?.amount && t.price?.divisor) {
                    const calculated = t.price.amount / t.price.divisor;
                    console.log(`     CALCULATED: ${t.price.amount} / ${t.price.divisor} = £${calculated.toFixed(2)}`);
                }
                console.log(`     shipping_cost: ${JSON.stringify(t.shipping_cost)}`);
                console.log(`     variations: ${JSON.stringify(t.variations)}`);
            });
            
            // Calculate what we would store
            console.log(`\n  WHAT WE STORE IN DATABASE:`);
            let total = 0;
            receipt.transactions.forEach((t, i) => {
                const price = t.price?.amount && t.price?.divisor
                    ? t.price.amount / t.price.divisor
                    : parseFloat(t.price) || 0;
                total += price * t.quantity;
                console.log(`    Transaction ${i + 1}: ${t.quantity} × £${price.toFixed(2)} = £${(price * t.quantity).toFixed(2)}`);
            });
            console.log(`    Total we store: £${total.toFixed(2)}`);
            
            if (receipt.grandtotal?.amount && receipt.grandtotal?.divisor) {
                const receiptTotal = receipt.grandtotal.amount / receipt.grandtotal.divisor;
                console.log(`    Receipt grandtotal: £${receiptTotal.toFixed(2)}`);
                if (Math.abs(total - receiptTotal) > 0.01) {
                    console.log(`    ⚠️  MISMATCH! Difference: £${(total - receiptTotal).toFixed(2)}`);
                }
            }
        }
    } else {
        console.log('   No receipts found');
    }
} catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
        console.error('Response:', JSON.stringify(error.response, null, 2));
    }
}
