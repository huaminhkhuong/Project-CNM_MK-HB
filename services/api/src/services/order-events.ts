import { Response } from "express";

const clientsByUserId = new Map<string, Set<Response>>();

function getClientSet(userId: string | number): Set<Response> {
  const key = String(userId);
  let clients = clientsByUserId.get(key);
  if (!clients) {
    clients = new Set<Response>();
    clientsByUserId.set(key, clients);
  }
  return clients;
}

export function subscribeOrderEvents(userId: string | number, res: Response): () => void {
  const key = String(userId);
  const clients = getClientSet(key);
  clients.add(res);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });
  res.write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);

  const keepAlive = setInterval(() => {
    res.write(`event: ping\ndata: ${JSON.stringify({ at: Date.now() })}\n\n`);
  }, 25000);

  const cleanup = () => {
    clearInterval(keepAlive);
    clients.delete(res);
    if (clients.size === 0) {
      clientsByUserId.delete(key);
    }
  };

  res.on("close", cleanup);
  return cleanup;
}

export function publishOrderEvent(userId: string | number, payload: any): void {
  if (!userId) return;
  const clients = clientsByUserId.get(String(userId));
  if (!clients || clients.size === 0) return;

  const data = JSON.stringify({
    type: "order.updated",
    ...payload,
    at: new Date().toISOString()
  });

  for (const res of clients) {
    res.write(`event: order.updated\ndata: ${data}\n\n`);
  }
}

export default {
  publishOrderEvent,
  subscribeOrderEvents
};
