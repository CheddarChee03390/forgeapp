// Fetch receipts and log all available fields
import etsyClient from '../../services/etsy/etsyClient.js';

console.log('\n🔍 Fetching receipts to examine available fields...\n');

try {
    const shopId = await etsyClient.getShopId();
    
    // Try to get any receipts from last year
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);
    
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
    console.log(`📡 Fetching from: ${url.substring(0, 100)}...\n`);
    
    const response = await etsyClient.etsyFetchWithApiKey(url);
    
    if (!response.ok) {
        console.error(`❌ API Error: ${response.status} ${response.statusText}`);
        const text = await response.text();
        console.error(text);
        process.exit(1);
    }
    
    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
        console.log('❌ No receipts returned');
        console.log(`Response: ${JSON.stringify(data, null, 2)}`);
        process.exit(0);
    }
    
    console.log(`✅ Found ${data.results.length} receipts\n`);
    
    const receipt = data.results[0];
    
    console.log('📦 RECEIPT FIELDS:');
    console.log('='.repeat(80));
    
    // List all top-level fields
    const fields = Object.keys(receipt).sort();
    console.log('\nAll available fields:');
    fields.forEach(field => {
        const value = receipt[field];
        const type = Array.isArray(value) ? 'array' : typeof value;
        const preview = Array.isArray(value) 
            ? `[${value.length} items]`
            : type === 'object' && value !== null
                ? JSON.stringify(value).substring(0, 50) + '...'
                : String(value).substring(0, 50);
        console.log(`  ${field.padEnd(30)} ${type.padEnd(10)} ${preview}`);
    });
    
    console.log('\n📊 KEY FIELDS FOR ANALYSIS:');
    console.log('='.repeat(80));
    console.log(`receipt_id:       ${receipt.receipt_id}`);
    console.log(`status:           ${receipt.status}`);
    console.log(`was_paid:         ${receipt.was_paid}`);
    console.log(`was_shipped:      ${receipt.was_shipped}`);
    console.log(`refunds:          ${JSON.stringify(receipt.refunds)}`);
    console.log(`discount_amt:     ${JSON.stringify(receipt.discount_amt)}`);
    console.log(`grandtotal:       ${JSON.stringify(receipt.grandtotal)}`);
    console.log(`subtotal:         ${JSON.stringify(receipt.subtotal)}`);
    console.log(`total_tax_cost:   ${JSON.stringify(receipt.total_tax_cost)}`);
    console.log(`transactions:     ${receipt.transactions?.length || 0} items`);
    
    if (receipt.transactions && receipt.transactions.length > 0) {
        console.log('\n💰 TRANSACTION FIELDS (first transaction):');
        console.log('='.repeat(80));
        const txn = receipt.transactions[0];
        const txnFields = Object.keys(txn).sort();
        txnFields.forEach(field => {
            const value = txn[field];
            const type = Array.isArray(value) ? 'array' : typeof value;
            const preview = type === 'object' && value !== null
                ? JSON.stringify(value)
                : String(value).substring(0, 60);
            console.log(`  ${field.padEnd(25)} ${type.padEnd(10)} ${preview}`);
        });
    }
    
    console.log('\n\n📄 FULL RECEIPT JSON (first receipt):');
    console.log('='.repeat(80));
    console.log(JSON.stringify(receipt, null, 2));
    
} catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
}
