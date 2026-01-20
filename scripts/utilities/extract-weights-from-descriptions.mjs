import db from './services/database.js';

// Parse weight data from Etsy descriptions
function extractWeightData(description) {
  if (!description) return null;
  
  // Pattern 1a: "Weight: X-Yg" or "Average Weight: Xg" or "Average weight: Xg"
  let match = description.match(/(?:Weight|Average weight|Average Weight):\s*(?:Approx\.\s*)?([0-9.]+)(?:\s*-\s*[0-9.]+)?g/i);
  if (match) {
    return parseFloat(match[1]);
  }
  
  // Pattern 2: Size-specific weights like "- 8&quot; - 97.76g" or "- 20&quot; - 116.6g"
  const sizeWeights = {};
  // Handle both &quot; encoded and plain quote formats
  const sizePattern = /[-•]\s*(\d+(?:\.\d+)?)(?:&quot;|["'])??\s*-\s*([0-9.]+)g/g;
  let sizeMatch;
  while ((sizeMatch = sizePattern.exec(description)) !== null) {
    sizeWeights[sizeMatch[1]] = parseFloat(sizeMatch[2]);
  }
  
  if (Object.keys(sizeWeights).length > 0) {
    return sizeWeights;
  }
  
  return null;
}

// Get all skipped items with their Etsy listings
const skippedItems = db.prepare(`
  SELECT DISTINCT
    map.internal_sku,
    l.listing_id,
    l.title,
    l.raw_api_data,
    v.variation_sku
  FROM Etsy_Variations v
  LEFT JOIN Marketplace_Sku_Map map ON v.variation_sku = map.variation_sku
  LEFT JOIN Master_Skus m ON map.internal_sku = m.SKU
  LEFT JOIN Etsy_Inventory l ON v.listing_id = l.listing_id
  WHERE m.Weight IS NULL
  AND map.internal_sku IS NOT NULL
  ORDER BY map.internal_sku
`).all();

console.log(`Found ${skippedItems.length} items with missing weight\n`);

// Group by Master SKU to see patterns
const groupedBySku = {};
const extractedWeights = {};

skippedItems.forEach(item => {
  if (!groupedBySku[item.internal_sku]) {
    groupedBySku[item.internal_sku] = [];
  }
  groupedBySku[item.internal_sku].push(item);
  
  // Extract weight from description
  try {
    const data = JSON.parse(item.raw_api_data);
    const weight = extractWeightData(data.description);
    
    if (weight) {
      if (typeof weight === 'number') {
        extractedWeights[item.internal_sku] = weight;
        console.log(`✓ ${item.internal_sku}: ${weight}g (from ${item.title.substring(0, 50)})`);
      } else {
        console.log(`✓ ${item.internal_sku}: Size-specific weights found:`, weight);
        extractedWeights[item.internal_sku] = weight;
      }
    } else {
      console.log(`✗ ${item.internal_sku}: No weight found in description`);
    }
  } catch (e) {
    console.log(`✗ ${item.internal_sku}: Error parsing data`);
  }
});

console.log('\n\n=== WEIGHT EXTRACTION SUMMARY ===\n');
console.log('SKUs with weights found:', Object.keys(extractedWeights).length);
console.log('SKUs needing manual entry:', Object.keys(groupedBySku).length - Object.keys(extractedWeights).length);

// Show what we found
console.log('\n=== EXTRACTED WEIGHTS ===\n');
const sqlUpdates = [];
Object.entries(extractedWeights).forEach(([sku, weight]) => {
  if (typeof weight === 'number') {
    sqlUpdates.push(`UPDATE Master_Skus SET Weight = ${weight} WHERE SKU = '${sku}';`);
    console.log(`UPDATE Master_Skus SET Weight = ${weight} WHERE SKU = '${sku}';`);
  } else if (typeof weight === 'object') {
    // Size-specific weight - extract size from SKU
    // SKU format: PREFIX_SIZE (e.g., BR_F2_GP_8, CH_BELZ14_GP_20, CH_F97ELB-CHAIN_20)
    const sizeMatch = sku.match(/([0-9.]+)$/);
    if (sizeMatch) {
      const size = sizeMatch[1];
      if (weight[size]) {
        sqlUpdates.push(`UPDATE Master_Skus SET Weight = ${weight[size]} WHERE SKU = '${sku}';`);
        console.log(`UPDATE Master_Skus SET Weight = ${weight[size]} WHERE SKU = '${sku}';  -- size ${size}`);
      } else {
        console.log(`-- SIZE MISMATCH for ${sku}: SKU has size ${size} but available sizes are ${Object.keys(weight).join(', ')}`);
      }
    }
  }
});

// Find SKUs without weights
console.log('\n=== SKUS NEEDING MANUAL ENTRY ===\n');
Object.keys(groupedBySku).forEach(sku => {
  if (!extractedWeights[sku]) {
    const items = groupedBySku[sku];
    console.log(`-- ${sku}: ${items[0].title}`);
  }
});
