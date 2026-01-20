// Test script to see what fields Etsy returns
import etsyReceiptsClient from '../../services/sales/etsy-receipts.client.js';

console.log('\n🔍 Fetching receipts to check fields...\n');

try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 300);
    
    const receipts = await etsyReceiptsClient.fetchReceipts(startDate, endDate);
    
    console.log(`✅ Fetched ${receipts.length} receipts\n`);
    
    if (receipts.length > 0) {
        const receipt = receipts[0];
        
        console.log('📦 RECEIPT FIELDS:');
        console.log('='.repeat(80));
        console.log(`All fields: ${Object.keys(receipt).sort().join(', ')}\n`);
        
        console.log('Key fields:');
        console.log(`  receipt_id: ${receipt.receipt_id}`);
        console.log(`  status: ${receipt.status}`);
        console.log(`  was_paid: ${receipt.was_paid}`);
        console.log(`  was_shipped: ${receipt.was_shipped || 'undefined'}`);
        console.log(`  refunds: ${JSON.stringify(receipt.refunds)}`);
        console.log(`  grandtotal: ${JSON.stringify(receipt.grandtotal)}`);
        console.log(`  subtotal: ${JSON.stringify(receipt.subtotal)}`);
        console.log(`  discount_amt: ${JSON.stringify(receipt.discount_amt)}`);
        console.log(`  total_tax_cost: ${JSON.stringify(receipt.total_tax_cost)}`);
        console.log(`  create_timestamp: ${receipt.create_timestamp}`);
        console.log(`  transactions: ${receipt.transactions?.length || 0} items\n`);
        
        if (receipt.transactions && receipt.transactions.length > 0) {
            const txn = receipt.transactions[0];
            console.log('💰 TRANSACTION FIELDS:');
            console.log('='.repeat(80));
            console.log(`All fields: ${Object.keys(txn).sort().join(', ')}\n`);
            
            console.log('Key fields:');
            console.log(`  transaction_id: ${txn.transaction_id}`);
            console.log(`  listing_id: ${txn.listing_id}`);
            console.log(`  title: ${txn.title}`);
            console.log(`  sku: ${txn.sku}`);
            console.log(`  quantity: ${txn.quantity}`);
            console.log(`  price: ${JSON.stringify(txn.price)}`);
            console.log(`  shipping_cost: ${JSON.stringify(txn.shipping_cost)}`);
        }
        
        console.log('\n\n📄 FULL FIRST RECEIPT:');
        console.log('='.repeat(80));
        console.log(JSON.stringify(receipt, null, 2));
    }
} catch (error) {
    console.error('❌ Error:', error.message);
}
