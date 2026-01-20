// Pricing Service - Calculate and manage Etsy pricing
import db from './database.js';

class PricingService {
    
    // Round price to nearest .99 (e.g., 494.71 → 494.99, 355.50 → 355.99)
    roundToNinetyNine(price) {
        return Math.floor(price) + 0.99;
    }
    
    // Calculate prices for all variations and populate staging table
    calculateAllPrices() {
        // Clear existing staging data
        db.prepare('DELETE FROM Pricing_Staging').run();

        const query = `
            SELECT 
                v.variation_sku,
                v.listing_id,
                v.price as current_price,
                v.quantity,
                m1.SKU as internal_sku,
                m1.Weight as weight_grams,
                m1.Material as material,
                m1.postagecost,
                mat1.costPerGram,
                mat1.sellPricePerGram
            FROM Etsy_Variations v
            LEFT JOIN Marketplace_Sku_Map map1
                ON map1.marketplace = 'etsy' 
                AND map1.variation_sku = v.variation_sku
                AND map1.is_active = 1
            LEFT JOIN Master_Skus m1
                ON m1.SKU = map1.internal_sku
            LEFT JOIN Materials mat1
                ON mat1.materialId = m1.Material
            WHERE v.variation_sku IS NOT NULL
            
            UNION ALL
            
            SELECT 
                COALESCE(i.sku, 'LISTING_' || i.listing_id) as variation_sku,
                i.listing_id,
                i.price as current_price,
                i.quantity,
                m2.SKU as internal_sku,
                m2.Weight as weight_grams,
                m2.Material as material,
                m2.postagecost,
                mat2.costPerGram,
                mat2.sellPricePerGram
            FROM Etsy_Inventory i
            LEFT JOIN Marketplace_Sku_Map map2
                ON map2.marketplace = 'etsy' 
                AND map2.variation_sku = COALESCE(i.sku, 'LISTING_' || i.listing_id)
                AND map2.is_active = 1
            LEFT JOIN Master_Skus m2
                ON m2.SKU = map2.internal_sku
            LEFT JOIN Materials mat2
                ON mat2.materialId = m2.Material
            WHERE i.has_variations = 0
        `;

        const variations = db.prepare(query).all();
        const insertStmt = db.prepare(`
            INSERT OR IGNORE INTO Pricing_Staging (
                variation_sku, listing_id, internal_sku, current_price, 
                calculated_price, weight_grams, material, material_cost,
                etsy_transaction_fee, etsy_payment_fee, postage_cost,
                total_fees, profit, profit_margin_percent, status, calculated_at,
                etsy_ad_fee, margin_modifier, base_calculated_price
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let calculated = 0;
        let skipped = 0;

        for (const v of variations) {
            // Check if we can calculate (has mapping and weight/material data)
            const canCalculate = v.internal_sku && v.weight_grams && v.sellPricePerGram;
            
            let calculatedPrice = null;
            let materialCost = null;
            let transactionFee = null;
            let paymentFee = null;
            let adFee = null;
            let postageCost = null;
            let totalFees = null;
            let profit = null;
            let profitMarginPercent = null;
            let status = 'pending';

            if (canCalculate) {
                // Calculate price: Weight × Sell Price Per Gram, rounded to .99
                const rawPrice = v.weight_grams * v.sellPricePerGram;
                calculatedPrice = this.roundToNinetyNine(rawPrice);
                
                // Calculate material cost
                materialCost = parseFloat((v.weight_grams * (v.costPerGram || 0)).toFixed(2));
                
                // Calculate Etsy fees
                transactionFee = parseFloat((calculatedPrice * 0.065).toFixed(2)); // 6.5%
                paymentFee = parseFloat((calculatedPrice * 0.04 + 0.2).toFixed(2)); // 4% + £0.20
                adFee = parseFloat((calculatedPrice * 0.15).toFixed(2)); // 15% for promoted listings
                postageCost = v.postagecost || 0;
                
                totalFees = parseFloat((transactionFee + paymentFee + adFee).toFixed(2));
                
                // Calculate profit (with ad fee included)
                profit = parseFloat((calculatedPrice - materialCost - totalFees - postageCost).toFixed(2));
                profitMarginPercent = calculatedPrice > 0 
                    ? parseFloat(((profit / calculatedPrice) * 100).toFixed(2)) 
                    : 0;
                
                calculated++;
            } else {
                // Use current price as placeholder, mark as unmapped
                calculatedPrice = v.current_price || 0;
                status = 'unmapped';
                skipped++;
            }

            insertStmt.run(
                v.variation_sku,
                v.listing_id,
                v.internal_sku || null,
                v.current_price || 0,
                calculatedPrice,
                v.weight_grams || null,
                v.material || null,
                materialCost || 0,
                transactionFee || 0,
                paymentFee || 0,
                postageCost || 0,
                totalFees || 0,
                profit || 0,
                profitMarginPercent || 0,
                status,
                Date.now(),
                adFee || 0,
                0, // margin_modifier (default 0)
                calculatedPrice // base_calculated_price
            );
        }

        return {
            success: true,
            calculated,
            skipped,
            total: variations.length
        };
    }

    // Get all staged prices
    getAllStaged() {
        const query = `
            SELECT 
                ps.*,
                ei.title as listing_title
            FROM Pricing_Staging ps
            LEFT JOIN Etsy_Inventory ei ON ei.listing_id = ps.listing_id
            ORDER BY ps.listing_id, ps.variation_sku
        `;
        return db.prepare(query).all();
    }

    // Get staged prices by status
    getByStatus(status) {
        const query = `
            SELECT 
                ps.*,
                ei.title as listing_title
            FROM Pricing_Staging ps
            LEFT JOIN Etsy_Inventory ei ON ei.listing_id = ps.listing_id
            WHERE ps.status = ?
            ORDER BY ps.listing_id, ps.variation_sku
        `;
        return db.prepare(query).all(status);
    }

    // Approve specific variations
    approveVariations(variationSkus) {
        const stmt = db.prepare(`
            UPDATE Pricing_Staging 
            SET status = 'approved', approved_at = ?
            WHERE variation_sku = ?
        `);

        const now = Date.now();
        for (const sku of variationSkus) {
            stmt.run(now, sku);
        }

        return { success: true, count: variationSkus.length };
    }

    // Reject specific variations
    rejectVariations(variationSkus) {
        const stmt = db.prepare(`
            UPDATE Pricing_Staging 
            SET status = 'rejected'
            WHERE variation_sku = ?
        `);

        for (const sku of variationSkus) {
            stmt.run(sku);
        }

        return { success: true, count: variationSkus.length };
    }

    // Get summary stats
    getStats() {
        const stats = db.prepare(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
                SUM(CASE WHEN status = 'pushed' THEN 1 ELSE 0 END) as pushed,
                AVG(profit_margin_percent) as avg_margin,
                SUM(CASE WHEN profit < 0 THEN 1 ELSE 0 END) as negative_profit
            FROM Pricing_Staging
        `).get();

        // Get distinct listings count from Etsy_Variations
        const listingsCount = db.prepare(`
            SELECT COUNT(DISTINCT listing_id) as count
            FROM Etsy_Variations
        `).get();

        return {
            ...stats,
            listings: listingsCount?.count || 0
        };
    }

    // Mark variations as pushed to Etsy
    markAsPushed(variationSkus) {
        const stmt = db.prepare(`
            UPDATE Pricing_Staging 
            SET status = 'pushed', pushed_at = ?
            WHERE variation_sku = ?
        `);

        const now = Date.now();
        for (const sku of variationSkus) {
            stmt.run(now, sku);
        }

        return { success: true, count: variationSkus.length };
    }
    
    // Get approved prices ready for pushing to Etsy
    getApprovedPricesForPush(variationSkus) {
        const placeholders = variationSkus.map(() => '?').join(',');
        const stmt = db.prepare(`
            SELECT 
                ps.variation_sku,
                ps.listing_id,
                ps.calculated_price as new_price
            FROM Pricing_Staging ps
            WHERE ps.variation_sku IN (${placeholders})
            AND ps.status = 'approved'
        `);
        
        return stmt.all(...variationSkus);
    }
    
    // Update margin modifier for a variation
    updateMarginModifier(variationSku, marginModifier) {
        // Get current staging record to access material cost and postage
        const record = db.prepare(`
            SELECT material_cost, postage_cost, base_calculated_price 
            FROM Pricing_Staging 
            WHERE variation_sku = ?
        `).get(variationSku);
        
        if (!record) return;
        
        let calculatedPrice;
        if (marginModifier && marginModifier > 0) {
            // Reverse calculate price for target margin with ads
            const targetMargin = marginModifier / 100;
            const feeMultiplier = 0.745; // 1 - 0.065 - 0.04 - 0.15
            const fixedCosts = record.material_cost + 0.2 + (record.postage_cost || 0);
            const rawPrice = fixedCosts / (feeMultiplier - targetMargin);
            calculatedPrice = this.roundToNinetyNine(rawPrice);
        } else {
            calculatedPrice = record.base_calculated_price;
        }
        
        const stmt = db.prepare(`
            UPDATE Pricing_Staging 
            SET margin_modifier = ?,
                calculated_price = ?
            WHERE variation_sku = ?
        `);
        stmt.run(marginModifier, calculatedPrice, variationSku);
    }
}

export default new PricingService();
