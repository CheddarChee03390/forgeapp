/**
 * Diagnose Suspicious Orders
 * Fetch the 9 extra orders from Etsy API to see why they differ from valid ones
 */

import etsyClient from '../../services/etsy/etsyClient.js';

const suspiciousReceiptIds = [
    3664474997,
    3680265954,
    3705868828,
    3711617960,
    3752899464,
    3765561094,
    3840338951,
    3842837852,
    3856489549
];

async function diagnoseOrders() {
    try {
        const shopId = etsyClient.getShopId();
        if (!shopId) {
            throw new Error('Not authenticated. Please connect to Etsy first.');
        }

        console.log(`🔍 DIAGNOSING ${suspiciousReceiptIds.length} SUSPICIOUS ORDERS`);
        console.log(`═══════════════════════════════════════════════════\n`);

        const results = [];

        for (const receiptId of suspiciousReceiptIds) {
            try {
                const url = etsyClient.buildUrl(`/application/shops/${shopId}/receipts/${receiptId}`);
                const response = await etsyClient.etsyFetchWithApiKey(url);

                if (!response.ok) {
                    console.log(`⚠️  Could not fetch receipt ${receiptId}: ${response.status}\n`);
                    continue;
                }

                const receipt = await response.json();

                const result = {
                    receipt_id: receipt.receipt_id,
                    is_paid: receipt.is_paid,
                    is_shipped: receipt.is_shipped,
                    status: receipt.status,
                    refunds_count: receipt.refunds ? receipt.refunds.length : 0,
                    created: new Date(receipt.created_timestamp * 1000).toISOString().split('T')[0],
                    grandtotal: receipt.grandtotal,
                    transactions_count: receipt.transactions ? receipt.transactions.length : 0,
                    shipments_count: receipt.shipments ? receipt.shipments.length : 0,
                    has_refunds: receipt.refunds && receipt.refunds.length > 0
                };

                // If there are refunds, get details
                if (result.has_refunds) {
                    result.refund_details = receipt.refunds.map(r => ({
                        amount: r.amount,
                        reason: r.reason,
                        status: r.status
                    }));
                }

                results.push(result);
                
                console.log(`Receipt ${receipt.receipt_id}:`);
                console.log(`  Status: ${receipt.status}`);
                console.log(`  Is Paid: ${receipt.is_paid}`);
                console.log(`  Is Shipped: ${receipt.is_shipped}`);
                console.log(`  Refunds: ${result.refunds_count}`);
                if (result.has_refunds) {
                    result.refund_details.forEach(r => {
                        console.log(`    └─ ${r.status}: ${r.reason} (Amount: ${r.amount?.amount}/${r.amount?.divisor})`);
                    });
                }
                console.log(`  Transactions: ${result.transactions_count}`);
                console.log(`  Shipments: ${result.shipments_count}`);
                console.log();

            } catch (error) {
                console.error(`❌ Error fetching receipt ${receiptId}:`, error.message);
            }
        }

        // Analysis
        console.log(`\n📊 ANALYSIS`);
        console.log(`═════════════\n`);

        const paid = results.filter(r => r.is_paid).length;
        const unpaid = results.filter(r => !r.is_paid).length;
        const refunded = results.filter(r => r.has_refunds).length;
        const cancelled = results.filter(r => r.status === 'cancelled').length;

        console.log(`Paid: ${paid}`);
        console.log(`Unpaid: ${unpaid}`);
        console.log(`With Refunds: ${refunded}`);
        console.log(`Cancelled: ${cancelled}`);

        // Show what distinguishes them
        console.log(`\n🎯 PATTERN FOUND:`);
        if (refunded > 0) {
            console.log(`✓ ${refunded} orders have REFUNDS array populated`);
        }
        if (unpaid > 0) {
            console.log(`✓ ${unpaid} orders are UNPAID (is_paid: false)`);
        }
        if (cancelled > 0) {
            console.log(`✓ ${cancelled} orders have status = 'cancelled'`);
        }

        console.log(`\n💡 RECOMMENDATIONS FOR SYNC VALIDATION:`);
        if (refunded > 0 || unpaid > 0 || cancelled > 0) {
            console.log(`✓ Current checks should already filter these out:`);
            if (refunded > 0) console.log(`  - Check refunds array length`);
            if (unpaid > 0) console.log(`  - Check is_paid: true`);
            if (cancelled > 0) console.log(`  - Check status !== 'cancelled'`);
        } else {
            console.log(`⚠️  These orders appear VALID - check other criteria`);
            console.log(`  - May need date range filtering`);
            console.log(`  - May need to add status checks`);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

diagnoseOrders();
