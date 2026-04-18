import "dotenv/config";
import { initStore, resetAll } from "./store.js";
import { seedAll } from "./data/seed-data.js";

async function main() {
  await initStore();
  const { resources, requests } = seedAll();
  await resetAll({ resources, requests, allocations: [], audit: [] });
  console.log(`Seeded ${resources.length} resources and ${requests.length} requests across 4 domains.`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
