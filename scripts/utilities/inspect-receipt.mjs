import etsyClient from '../../services/etsy/etsyClient.js';

const receiptId = '3664474997';

console.log(`\n🔍 Fetching receipt ${receiptId} from Etsy API...\n`);

try {
    const shopId = etsyClient.getShopId();
    const url = etsyClient.buildUrl(`/application/shops/${shopId}/receipts/${receiptId}`);
    
    const response = await etsyClient.etsyFetch(url);
    
    if (!response.ok) {
        throw new Error(`API responded with status ${response.status}: ${await response.text()}`);
    }
    
    const receipt = await response.json();
    
    console.log('📋 FULL RECEIPT OBJECT:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(receipt, null, 2));
    console.log('='.repeat(80));
    
    console.log('\n🔑 KEY FIELDS TO CHECK:');
    console.log('─'.repeat(80));
    console.log(`receipt_id: ${receipt.receipt_id}`);
    console.log(`status: ${receipt.status}`);
    console.log(`is_paid: ${receipt.is_paid}`);
    console.log(`is_shipped: ${receipt.is_shipped}`);
    console.log(`was_paid: ${receipt.was_paid}`);
    console.log(`was_shipped: ${receipt.was_shipped}`);
    console.log(`refunds: ${receipt.refunds ? JSON.stringify(receipt.refunds) : 'null'}`);
    console.log(`grandtotal: ${receipt.grandtotal?.amount} ${receipt.grandtotal?.currency_code}`);
    console.log(`create_timestamp: ${receipt.create_timestamp}`);
    console.log(`update_timestamp: ${receipt.update_timestamp}`);
    console.log('─'.repeat(80));
    
    console.log('\n✅ Analysis:');
    if (receipt.status && receipt.status.toLowerCase().includes('cancel')) {
        console.log(`  ⚠️  Status field indicates cancellation: "${receipt.status}"`);
    }
    if (receipt.is_paid === false) {
        console.log(`  ⚠️  is_paid is false`);
    }
    if (receipt.refunds && receipt.refunds.length > 0) {
        console.log(`  ⚠️  Has ${receipt.refunds.length} refund(s)`);
    }
    
} catch (error) {
    console.error('❌ Error fetching receipt:', error.message);
    if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
    }
}
