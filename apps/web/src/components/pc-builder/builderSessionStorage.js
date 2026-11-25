/* ── WORKSPACE SESSION PERSISTENCE ─────────────────────────────
   Lưu / khôi phục trạng thái workspace giữa các phiên làm việc.
   Key: pcmall_workspace_session_v1
   Dữ liệu: activeComponent, searchTerm, suggestionForm, selectedPresetId
   ──────────────────────────────────────────────────────────────── */
export const WORKSPACE_SESSION_KEY = "pcmall_workspace_session_v1";

/** Đọc session 1 lần — cache để tránh nhiều lần truy cập localStorage */
let _cachedWsSession = null;
export function loadWorkspaceSession() {
  if (_cachedWsSession !== null) return _cachedWsSession;
  try {
    const raw = localStorage.getItem(WORKSPACE_SESSION_KEY);
    _cachedWsSession = raw ? JSON.parse(raw) : {};
  } catch {
    _cachedWsSession = {};
  }
  return _cachedWsSession;
}

/** Ghi session vào localStorage và cập nhật cache */
export function saveWorkspaceSession(data) {
  try {
    const toSave = { ...data, savedAt: Date.now() };
    localStorage.setItem(WORKSPACE_SESSION_KEY, JSON.stringify(toSave));
    _cachedWsSession = toSave;
  } catch (_) { /* ignore QuotaExceededError */ }
}

/** Format thời gian tương đối: "vừa xong", "5 phút trước", "2 giờ trước", "Hôm qua" */
export function formatSessionTimeAgo(ts) {
  if (!ts) return "";
  const diffMs  = Date.now() - ts;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin <  1)   return "vừa xong";
  if (diffMin < 60)   return `${diffMin} phút trước`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24)   return `${diffHrs} giờ trước`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return "hôm qua";
  return `${diffDays} ngày trước`;
}
