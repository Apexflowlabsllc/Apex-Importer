const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// 1. Load Environment Variables manually (so we don't need external deps like dotenv)
function loadEnv() {
  const envPath = path.resolve(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    console.error('❌ Error: .env file not found.');
    process.exit(1);
  }
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split('\n').forEach((line) => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, ''); // Remove quotes
    }
  });
}

// 2. Open URL helper (Cross-platform)
function openUrl(url) {
  const start = (process.platform == 'darwin' ? 'open' : process.platform == 'win32' ? 'start' : 'xdg-open');
  exec(`${start} "${url}"`, (error) => {
    if (error) {
      console.error('❌ Could not open browser:', error);
    }
  });
}

// --- Main Execution ---

// Load vars
loadEnv();

const apiKey = process.env.SHOPIFY_APP_KEY;
const storeArg = process.argv[2]; // Get store from command line argument

if (!apiKey) {
  console.error('❌ Error: SHOPIFY_APP_KEY not found in .env');
  process.exit(1);
}

if (!storeArg) {
  console.error('❌ Error: Please provide your store domain.');
  console.log('   Usage: node install-app.js <store-subdomain>');
  console.log('   Example: node install-app.js my-test-store');
  process.exit(1);
}

// Handle "my-store" vs "my-store.myshopify.com"
const storeDomain = storeArg.includes('.myshopify.com') ? storeArg : `${storeArg}.myshopify.com`;

const installUrl = `https://${storeDomain}/admin/oauth/install?client_id=${apiKey}`;

console.log(`\n🚀 Install link for store: ${storeDomain}`);
console.log(`🔗 URL: ${installUrl}\n`);

