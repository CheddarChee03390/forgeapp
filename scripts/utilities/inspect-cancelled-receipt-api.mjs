#!/usr/bin/env node
/**
 * Inspect receipt 3664474997 directly from Etsy API to check for was_canceled field
 */

import etsyClient from '../../services/etsy/etsyClient.js';

// Test with a valid receipt first, then the cancelled one
const receipts = [
    { id: 3842843252, note: 'Valid receipt for comparison' },
    { id: 3664474997, note: 'Cancelled receipt' }
];

for (const { id: receiptId, note } of receipts) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 ${note}: ${receiptId}`);
    console.log('='.repeat(60));

try {
    const shopId = etsyClient.getShopId();
    if (!shopId) {
        console.error('❌ Not authenticated');
        process.exit(1);
    }

    const url = etsyClient.buildUrl(`/application/shops/${shopId}/receipts/${receiptId}`);
    const response = await etsyClient.etsyFetchWithApiKey(url);

    if (!response.ok) {
        console.error(`❌ API Error: ${response.status} ${response.statusText}`);
        process.exit(1);
    }

    const receipt = await response.json();

    console.log('📋 RECEIPT DETAILS:');
    console.log('─'.repeat(50));
    console.log(`Receipt ID: ${receipt.receipt_id}`);
    console.log(`Status: ${receipt.status}`);
    console.log(`Is Paid: ${receipt.is_paid}`);
    console.log(`Is Shipped: ${receipt.is_shipped}`);
    
    // Check for cancellation fields
    console.log(`\n🔍 CANCELLATION CHECK:`);
    console.log(`was_canceled: ${receipt.was_canceled}`);
    console.log(`was_shipped: ${receipt.was_shipped}`);
    console.log(`was_paid: ${receipt.was_paid}`);
    console.log(`was_delivered: ${receipt.was_delivered}`);
    
    // Check for refunds
    console.log(`\n💰 REFUNDS:`);
    if (receipt.refunds && receipt.refunds.length > 0) {
        console.log(`Number of refunds: ${receipt.refunds.length}`);
        receipt.refunds.forEach((refund, idx) => {
            console.log(`  Refund ${idx + 1}: ${JSON.stringify(refund)}`);
        });
    } else {
        console.log(`No refunds found`);
    }

    // Show all top-level keys
    console.log(`\n🔑 ALL AVAILABLE FIELDS:`);
    console.log(Object.keys(receipt).sort().join(', '));

    // If you want to see the full receipt:
    // console.log(`\n📄 FULL RECEIPT DATA:`);
    // console.log(JSON.stringify(receipt, null, 2));

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}
