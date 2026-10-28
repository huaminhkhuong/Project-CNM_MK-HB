import { httpClient } from "./http";

export async function createOrder(payload) {
  const response = await httpClient.post("/orders/checkout", payload);
  return response.data;
}

export async function getMyOrders() {
  const response = await httpClient.get("/orders/my");
  return response.data;
}

export async function getOrderDetail(orderId) {
  const response = await httpClient.get(`/orders/${orderId}`);
  return response.data;
}

export async function uploadPaymentProof(orderId, file) {
  const formData = new FormData();
  formData.append("paymentProof", file);
  formData.append("proof_image", file);

  const response = await httpClient.post(`/orders/${orderId}/payment-proof`, formData, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  return response.data;
}

export async function uploadPaymentReceipt(orderId, file) {
  const formData = new FormData();
  formData.append("proof_image", file);
  formData.append("paymentProof", file);

  const response = await httpClient.post(`/payments/${orderId}/proof`, formData, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  return response.data;
}

export async function approvePaymentProof(orderId, payload) {
  const response = await httpClient.patch(`/orders/${orderId}/payment-proof/approve`, payload);
  return response.data;
}

export async function createVnpayUrl(orderId, payload = {}) {
  const response = await httpClient.post(`/orders/${orderId}/vnpay-url`, payload);
  return response.data;
}

export async function createMomoUrl(orderId, payload = {}) {
  const response = await httpClient.post(`/orders/${orderId}/momo-url`, payload);
  return response.data;
}

export async function confirmMockPayment(orderId) {
  const response = await httpClient.post(`/orders/${orderId}/mock-pay`);
  return response.data;
}

export async function cancelMockPayment(orderId) {
  const response = await httpClient.post(`/orders/${orderId}/mock-cancel`);
  return response.data;
}

export async function cancelMyOrder(orderId) {
  const response = await httpClient.post(`/orders/${orderId}/cancel`);
  return response.data;
}

export async function confirmOrderReceived(orderId) {
  const response = await httpClient.post(`/orders/${orderId}/confirm-received`);
  return response.data;
}
