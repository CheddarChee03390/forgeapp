#!/usr/bin/env node
/**
 * Direct API call to Etsy receipts endpoint
 * Shows exactly what the API returns
 */

import etsyClient from '../../services/etsy/etsyClient.js';

console.log('🔍 Calling Etsy API: GET /v3/application/shops/{shop_id}/receipts\n');

try {
    const shopId = etsyClient.getShopId();
    if (!shopId) {
        console.error('❌ Not authenticated');
        process.exit(1);
    }

    // Calculate date range (300 days back)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 300);
    
    const minCreated = Math.floor(startDate.getTime() / 1000);
    const maxCreated = Math.floor(endDate.getTime() / 1000) + 86399;

    const params = new URLSearchParams({
        limit: '100',
        offset: '0',
        min_created: String(minCreated),
        max_created: String(maxCreated)
        // NOT including was_paid filter to see ALL receipts
    });

    const url = etsyClient.buildUrl(`/application/shops/${shopId}/receipts?${params.toString()}`);
    console.log(`📡 URL: ${url.split('?')[0]}?...`);
    console.log(`📅 Date Range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}\n`);

    const response = await etsyClient.etsyFetch(url);  // Use OAuth instead of API key

    if (!response.ok) {
        console.error(`❌ API Error: ${response.status} ${response.statusText}`);
        const error = await response.json().catch(() => ({}));
        console.error(error);
        process.exit(1);
    }

    const data = await response.json();
    const receipts = data.results || [];

    console.log(`✅ SUCCESS - Fetched ${receipts.length} receipts\n`);

    // Look for the cancelled receipt
    const cancelledReceipt = receipts.find(r => r.receipt_id === 3664474997);
    
    if (cancelledReceipt) {
        console.log('🔍 FOUND CANCELLED RECEIPT 3664474997:');
        console.log('─'.repeat(60));
        console.log(`receipt_id: ${cancelledReceipt.receipt_id}`);
        console.log(`status: ${cancelledReceipt.status}`);
        console.log(`is_paid: ${cancelledReceipt.is_paid}`);
        console.log(`is_shipped: ${cancelledReceipt.is_shipped}`);
        console.log(`was_paid: ${cancelledReceipt.was_paid}`);
        console.log(`was_shipped: ${cancelledReceipt.was_shipped}`);
        console.log(`was_canceled: ${cancelledReceipt.was_canceled}`);
        console.log(`was_delivered: ${cancelledReceipt.was_delivered}`);
        console.log(`\nAll fields on this receipt:`);
        console.log(Object.keys(cancelledReceipt).sort().join(', '));
    } else {
        console.log('⚠️  Receipt 3664474997 NOT found in API results');
        console.log('This means the API is filtering it out (likely because it was cancelled/refunded)');
    }

    // Show sample of first receipt
    console.log(`\n📋 SAMPLE RECEIPT (first in results):`);
    console.log('─'.repeat(60));
    const sample = receipts[0];
    console.log(`receipt_id: ${sample.receipt_id}`);
    console.log(`status: ${sample.status}`);
    console.log(`is_paid: ${sample.is_paid}`);
    console.log(`was_paid: ${sample.was_paid}`);
    console.log(`was_shipped: ${sample.was_shipped}`);
    console.log(`was_canceled: ${sample.was_canceled}`);
    console.log(`\nAll available fields (${Object.keys(sample).length}):`);
    console.log(Object.keys(sample).sort().join(', '));

    console.log(`\n📊 SUMMARY:`);
    console.log(`Total receipts returned: ${receipts.length}`);
    console.log(`Receipt 3664474997 present: ${cancelledReceipt ? 'YES ✓' : 'NO ✗'}`);

} catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
}
