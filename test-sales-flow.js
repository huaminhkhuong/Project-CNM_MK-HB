const http = require("http");

const API_HOST = process.env.API_HOST || "localhost";
const API_PORT = Number(process.env.API_PORT || 4000);
const SALES_EMAIL = process.env.SALES_EMAIL || "sales@cnm.local";
const SALES_PASSWORD = process.env.SALES_PASSWORD || "Sales@123";
const CUSTOMER_EMAIL = process.env.CUSTOMER_EMAIL || "customer@cnm.local";
const CUSTOMER_PASSWORD = process.env.CUSTOMER_PASSWORD || "Customer@123";
const TRACKING_CODE = process.env.TRACKING_CODE || `TRACK-${Date.now()}`;
const TARGET_ORDER_ID = process.env.ORDER_ID ? Number(process.env.ORDER_ID) : null;

function request(method, path, body = null, token = "") {
  const payload = body ? JSON.stringify(body) : null;

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: API_HOST,
        port: API_PORT,
        path,
        method,
        headers: {
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          const parsed = data ? JSON.parse(data) : null;
          if (res.statusCode >= 400) {
            reject(new Error(parsed?.message || `Request failed: ${method} ${path} (${res.statusCode})`));
            return;
          }
          resolve(parsed);
        });
      }
    );

    req.on("error", reject);

    if (payload) {
      req.write(payload);
    }

    req.end();
  });
}

async function login(email, password) {
  const response = await request("POST", "/api/auth/login", { email, password });
  return response?.data?.accessToken;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function findTargetOrder(salesToken) {
  const response = await request("GET", "/api/staff/orders", null, salesToken);
  const orders = response?.data || [];

  if (TARGET_ORDER_ID) {
    const matched = orders.find((order) => Number(order.id) === TARGET_ORDER_ID);
    assert(matched, `Order #${TARGET_ORDER_ID} was not found in /api/staff/orders`);
    return matched;
  }

  const pendingOrder = orders.find(
    (order) => order.status === "PENDING" && order.customer?.email === CUSTOMER_EMAIL
  );

  assert(
    pendingOrder,
    `No PENDING order found for ${CUSTOMER_EMAIL}. Create a customer order first or pass ORDER_ID=<id>.`
  );

  return pendingOrder;
}

async function run() {
  console.log("1. Logging in Sales Staff...");
  const salesToken = await login(SALES_EMAIL, SALES_PASSWORD);
  assert(salesToken, "Sales login did not return an access token");

  console.log("2. Logging in Customer...");
  const customerToken = await login(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
  assert(customerToken, "Customer login did not return an access token");

  console.log("3. Finding target order...");
  const targetOrder = await findTargetOrder(salesToken);
  console.log(`   Using order #${targetOrder.id} for ${targetOrder.customer?.email || "unknown customer"}`);

  console.log("4. Moving order to PROCESSING...");
  const processing = await request(
    "PATCH",
    `/api/staff/orders/${targetOrder.id}/status`,
    { status: "PROCESSING" },
    salesToken
  );
  assert(processing?.data?.status === "PROCESSING", "Order did not move to PROCESSING");

  console.log("5. Creating shipment and marking order SHIPPED...");
  await request(
    "POST",
    `/api/staff/orders/${targetOrder.id}/shipment`,
    { trackingCode: TRACKING_CODE, status: "IN_TRANSIT" },
    salesToken
  );
  const shipped = await request(
    "PATCH",
    `/api/staff/orders/${targetOrder.id}/status`,
    { status: "SHIPPED" },
    salesToken
  );
  assert(shipped?.data?.status === "SHIPPED", "Order did not move to SHIPPED");
  assert(shipped?.data?.shipment?.trackingCode === TRACKING_CODE, "Tracking code was not attached to the order");

  console.log("6. Marking shipment DELIVERED and order DELIVERED...");
  await request(
    "POST",
    `/api/staff/orders/${targetOrder.id}/shipment`,
    { trackingCode: TRACKING_CODE, status: "DELIVERED" },
    salesToken
  );
  const delivered = await request(
    "PATCH",
    `/api/staff/orders/${targetOrder.id}/status`,
    { status: "DELIVERED" },
    salesToken
  );
  assert(delivered?.data?.status === "DELIVERED", "Order did not move to DELIVERED");

  console.log("7. Verifying customer order detail...");
  const customerOrder = await request("GET", `/api/orders/${targetOrder.id}`, null, customerToken);
  const customerData = customerOrder?.data;

  assert(customerData?.status === "DELIVERED", "Customer order detail did not reflect DELIVERED status");
  assert(customerData?.shipment?.trackingCode === TRACKING_CODE, "Customer order detail did not reflect tracking code");
  assert(customerData?.shipment?.status === "DELIVERED", "Customer shipment status did not reflect DELIVERED");

  console.log("Sales Staff smoke test passed.");
  console.log(
    JSON.stringify(
      {
        orderId: targetOrder.id,
        customerEmail: customerData?.customer?.email || CUSTOMER_EMAIL,
        status: customerData?.status,
        trackingCode: customerData?.shipment?.trackingCode,
        shipmentStatus: customerData?.shipment?.status
      },
      null,
      2
    )
  );
}

run().catch((error) => {
  console.error("Sales Staff smoke test failed:");
  console.error(error.message || error);
  process.exitCode = 1;
});
