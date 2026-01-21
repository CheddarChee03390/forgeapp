// CSV Helper Functions
import crypto from 'crypto';

/**
 * Normalize date from Etsy format to ISO
 * Example: "30 November, 2025" -> "2025-11-30"
 * Also handles: "30 Nov, 2025", "15 Jan, 2026", "15-Jan-26", etc.
 */
export function normalizeDate(dateStr) {
    if (!dateStr) return '1970-01-01';
    
    const months = {
        january: 1, jan: 1,
        february: 2, feb: 2,
        march: 3, mar: 3,
        april: 4, apr: 4,
        may: 5,
        june: 6, jun: 6,
        july: 7, jul: 7,
        august: 8, aug: 8,
        september: 9, sep: 9, sept: 9,
        october: 10, oct: 10,
        november: 11, nov: 11,
        december: 12, dec: 12
    };
    
    // Handle "DD-MMM-YY" format (e.g., "20-Jan-26")
    const hyphenMatch = dateStr.match(/(\d{1,2})-(\w+)-(\d{2})/i);
    if (hyphenMatch) {
        const day = hyphenMatch[1].padStart(2, '0');
        const monthNum = months[hyphenMatch[2].toLowerCase()] || 1;
        const month = String(monthNum).padStart(2, '0');
        // Assume 20xx for YY format
        const year = `20${hyphenMatch[3]}`;
        return `${year}-${month}-${day}`;
    }
    
    // Handle "DD Month, YYYY" or "DD Mon, YYYY" format
    const match = dateStr.match(/(\d{1,2})\s+(\w+),?\s+(\d{4})/i);
    if (match) {
        const day = match[1].padStart(2, '0');
        const monthNum = months[match[2].toLowerCase()] || 1;
        const month = String(monthNum).padStart(2, '0');
        const year = match[3];
        return `${year}-${month}-${day}`;
    }
    
    // Handle ISO format already
    if (dateStr.match(/\d{4}-\d{2}-\d{2}/)) {
        return dateStr;
    }
    
    console.warn(`⚠️ Could not parse date: "${dateStr}"`);
    return '1970-01-01';
}

/**
 * Generate deterministic hash for deduplication
 * Uses: Date|Type|Title|Fees&Taxes|Net
 */
export function generateHash(date, type, title, feesAndTaxes, net, info = '') {
    const isoDate = normalizeDate(date);
    // Only include info field if it's not empty (for listing-specific fees)
    // Shop-level fees like "VAT: Etsy Ads" have empty info and should dedupe normally
    const hashStr = info 
        ? `${isoDate}|${type}|${title}|${feesAndTaxes}|${net}|${info}`
        : `${isoDate}|${type}|${title}|${feesAndTaxes}|${net}`;
    return crypto.createHash('sha256').update(hashStr).digest('hex');
}

/**
 * Map Etsy CSV type to database fee_type categories
 * Maps to Etsy's official Activity Summary categories:
 * - Fees: listing, transaction, processing, regulatory
 * - Marketing: etsy_ads, offsite_ads
 * - Delivery: postage_labels
 * - VAT: vat_on_fees
 */
export function mapFeeType(type, title) {
    const lowerType = type.toLowerCase();
    const lowerTitle = title.toLowerCase();
    
    // Credits - map back to the original fee type they credit
    if (lowerType === 'credit' || lowerTitle.includes('credit')) {
        if (lowerTitle.includes('listing')) return 'listing_fee';
        if (lowerTitle.includes('transaction')) return 'transaction_fee';
        if (lowerTitle.includes('processing')) return 'processing_fee';
        if (lowerTitle.includes('regulatory')) return 'regulatory_fee';
        if (lowerTitle.includes('etsy ads') || lowerTitle.includes('etsy ad')) return 'etsy_ads';
        if (lowerTitle.includes('offsite')) return 'offsite_ads';
        if (lowerTitle.includes('postage') || lowerTitle.includes('shipping') || lowerTitle.includes('label')) return 'postage_labels';
        if (lowerTitle.includes('vat') || lowerTitle.includes('seller')) return 'vat_on_fees';
        return null; // Skip unknown credits
    }
    
    // VAT on seller fees (separate category)
    if (lowerType === 'vat') {
        return 'vat_on_fees';
    }
    
    // Refunds
    if (lowerType === 'refund') {
        return 'refund';
    }
    
    // Fee type breakdown (matches Etsy's "Fees" category)
    if (lowerType === 'fee') {
        if (lowerTitle.includes('listing')) return 'listing_fee';
        if (lowerTitle.includes('transaction')) return 'transaction_fee';
        if (lowerTitle.includes('processing')) return 'processing_fee';
        if (lowerTitle.includes('regulatory')) return 'regulatory_fee';
        if (lowerTitle.includes('dispute') || lowerTitle.includes('chargeback')) return 'payment_dispute_fee';
        return 'other_fee';
    }
    
    // Marketing (Etsy Ads, Offsite Ads)
    if (lowerType === 'marketing') {
        if (lowerTitle.includes('etsy ads') || lowerTitle.includes('click-through')) return 'etsy_ads';
        if (lowerTitle.includes('offsite')) return 'offsite_ads';
        return 'marketing_other';
    }
    
    // Delivery/Shipping (Postage Labels)
    // NOTE: Exclude "Duties" - those are customs/import fees not included in Etsy's Delivery category
    if ((lowerType === 'shipping' || lowerTitle.includes('postage') || lowerTitle.includes('label')) && !lowerTitle.includes('duties')) {
        return 'postage_labels';
    }
    
    // Payment-related (shouldn't appear in statements, but handle if present)
    if (lowerType === 'payment') {
        if (lowerTitle.includes('refund') && lowerTitle.includes('charge')) return 'refund_charge';
        return 'payment_other';
    }
    
    // Etsy Miscellaneous Credit (compensations, case resolutions, etc.)
    if (lowerType === 'etsy miscellaneous credit' || lowerType.includes('miscellaneous')) {
        return 'etsy_misc_credit';
    }
    
    return null;
}

/**
 * Extract Etsy order number from title or info text
 * Returns just the number (e.g., "1234"), not the full ID
 */
export function extractOrderId(title, info) {
    const text = title + ' ' + info;
    const match = text.match(/Order #(\d+)|refund[^0-9]*(\d+)|order:\s*(\d+)/i);
    if (match) {
        return match[1] || match[2] || match[3];
    }
    return null;
}
