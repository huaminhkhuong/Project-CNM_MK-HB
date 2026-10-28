/**
 * 🌟 CANONICAL MASTER DATABASE SEED ORCHESTRATOR
 *
 * Runs all seed modules in strict foreign-key dependency order:
 *   1. Roles & Default Users (seed-production.js)
 *   2. Comprehensive Product Catalog (300 items across 8 categories) (import-all-catalog-sources.js)
 *   3. Hardware Specifications & SKU Attributes (45 attributes, 244 values, 2,500+ sku_attributes) (seed-hardware-specs.js)
 *   4. PC Builder Comprehensive Rules Engine (44 compatibility rules) (seed-comprehensive-rules.js)
 *   5. Promotional Coupons & Vouchers (5 canonical vouchers) (seed-coupons.js)
 *
 * Execution:
 *   npm run seed
 */
const { execFileSync } = require("child_process");
const path = require("path");

const SEED_STEPS = [
  {
    name: "1. Roles & Default Users",
    script: path.join(__dirname, "seed-production.js")
  },
  {
    name: "2. Full Catalog Consolidation (300 Products)",
    script: path.join(__dirname, "import-all-catalog-sources.js")
  },
  {
    name: "3. Hardware Specs & SKU Attributes",
    script: path.join(__dirname, "seed-hardware-specs.js")
  },
  {
    name: "4. Comprehensive PC Compatibility Rules",
    script: path.join(__dirname, "seed-comprehensive-rules.js")
  },
  {
    name: "5. Promotional Coupons & Vouchers",
    script: path.join(__dirname, "seed-coupons.js")
  },
  {
    name: "6. Verified Product Customer Reviews",
    script: path.join(__dirname, "seed-reviews.js")
  }
];

function runMasterSeed() {
  console.log("===============================================================");
  console.log("🚀 STARTING CANONICAL MASTER DATABASE SEED");
  console.log("===============================================================");

  const startTime = Date.now();

  for (const step of SEED_STEPS) {
    console.log(`\n⏳ Running Step: ${step.name}...`);
    try {
      execFileSync(process.execPath, [step.script], {
        stdio: "inherit",
        env: { ...process.env, NODE_ENV: process.env.NODE_ENV || "development" }
      });
      console.log(`✅ [OK] Completed ${step.name}`);
    } catch (error) {
      console.error(`❌ [FAILED] Step ${step.name} encountered an error:`, error.message);
      process.exit(1);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log("\n===============================================================");
  console.log(`🎉 ALL CANONICAL SEED STEPS COMPLETED SUCCESSFULLY IN ${duration}s!`);
  console.log("===============================================================\n");
}

if (require.main === module) {
  runMasterSeed();
}

module.exports = { runMasterSeed };
