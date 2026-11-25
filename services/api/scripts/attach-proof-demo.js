const { query } = require("../src/config/database");
const fs = require("fs");
const path = require("path");

async function run() {
  // 1x1 png base64
  const dummyBuffer = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64"
  );
  const fileName = "proof-order243-demo.png";
  const destDir = path.resolve(__dirname, "../uploads/payment-proofs");
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  fs.writeFileSync(path.join(destDir, fileName), dummyBuffer);

  const proofUrl = "/uploads/payment-proofs/" + fileName;
  await query("UPDATE orders SET payment_proof = ?, payment_status = 'AWAITING_ADMIN_CONFIRMATION' WHERE id = 243", [proofUrl]);
  await query("UPDATE payments SET proof_image_url = ? WHERE order_id = 243", [proofUrl]);
  console.log("Successfully attached demo receipt to order #243:", proofUrl);
  process.exit(0);
}

run();
