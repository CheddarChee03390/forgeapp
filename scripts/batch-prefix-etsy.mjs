import 'dotenv/config';
import db from '../services/database.js';
import etsyService from '../services/etsyService.js';

const prefix = 'ETSY_';
const limit = 5; // max parallel calls to be gentle

function getListingIds() {
  const rows = db.prepare('SELECT listing_id FROM Etsy_Inventory ORDER BY listing_id').all();
  return rows.map(r => r.listing_id);
}

async function run() {
  const ids = getListingIds();
  console.log(`Found ${ids.length} listings to update with prefix ${prefix}`);

  const chunks = [];
  for (let i = 0; i < ids.length; i += limit) {
    chunks.push(ids.slice(i, i + limit));
  }

  for (const chunk of chunks) {
    console.log(`\nProcessing: ${chunk.join(', ')}`);
    const results = await Promise.allSettled(chunk.map(id => etsyService.pushPrefixedSkus(id, prefix)));
    results.forEach((res, idx) => {
      const id = chunk[idx];
      if (res.status === 'fulfilled') {
        console.log(`✅ ${id} updatedProducts=${res.value.updatedProducts}`);
      } else {
        console.log(`❌ ${id} error: ${res.reason?.message || res.reason}`);
      }
    });
    // small delay between batches to be polite
    await new Promise(r => setTimeout(r, 750));
  }

  console.log('\nDone.');
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
