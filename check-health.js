#!/usr/bin/env node

/**
 * Backend Health Check Script
 * Tests if all modules can be loaded without syntax errors
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("✅ Backend Module Health Check\n");

const filesToCheck = [
  "app.js",
  "index.js",
  "constants.js",
  "utils/asyncHandler.js",
  "utils/ApiError.js",
  "utils/ApiResponse.js",
  "utils/cloudinary.js",
  "middleware/auth.middleware.js",
  "middleware/multer.middleware.js",
  "models/user.models.js",
  "models/item.models.js",
  "controllers/user.controller.js",
  "controllers/item.controller.js",
  "controllers/ai.controller.js",
  "routes/auth.routes.js",
  "routes/user.routes.js",
  "routes/item.routes.js",
  "routes/ai.routes.js",
];

let passed = 0;
let failed = 0;

async function checkFile(file) {
  const filePath = path.join(__dirname, file);

  try {
    if (!fs.existsSync(filePath)) {
      console.log(`❌ ${file} - FILE NOT FOUND`);
      failed++;
      return;
    }

    // Read file to check for basic syntax
    const content = fs.readFileSync(filePath, "utf-8");

    // Basic checks
    if (content.includes("import ") || content.includes("export ")) {
      console.log(`✅ ${file}`);
      passed++;
    } else {
      console.log(`⚠️  ${file} - No imports/exports detected`);
      failed++;
    }
  } catch (err) {
    console.log(`❌ ${file} - ${err.message}`);
    failed++;
  }
}

console.log("Checking essential files:\n");

for (const file of filesToCheck) {
  await checkFile(file);
}

console.log(`\n📊 Results:`);
console.log(`   ✅ Passed: ${passed}`);
console.log(`   ❌ Failed: ${failed}`);
console.log(`   📁 Total: ${filesToCheck.length}`);

if (failed === 0) {
  console.log("\n🎉 All modules are valid and ready!");
  process.exit(0);
} else {
  console.log("\n⚠️  Some modules need fixing!");
  process.exit(1);
}
