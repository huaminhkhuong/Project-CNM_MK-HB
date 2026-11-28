import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

import { useAuth } from "../../hooks/useAuth";
import { useSocket } from "../../hooks/useSocket";
import {
  addTicketMessage,
  getManageTickets,
  getTicketDetail,
  getTicketStats,
  updateTicket
} from "../../services/ticket.service";
import {
  TICKET_REPLY_TEMPLATES,
  downloadAttachment,
  extractAttachmentMentions,
  getAttachmentUrl,
  getTicketPriorityMeta,
  getTicketStatusMeta,
  isImageAttachment,
  isTechSender,
  isVideoAttachment,
  normalizeTicketText
} from "../../utils/ticketTech";
import "../../styles/admin-ai-studio.css";
import "../../styles/admin-catalog-studio.css";

const STORAGE_SELECTED_TICKET = "pcmall_tech_selected_ticket";
const STORAGE_INTERNAL_NOTES = "pcmall_tech_internal_notes";

const STATUS_OPTIONS = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
const PRIORITY_OPTIONS = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const SCOPE_OPTIONS = [
  { value: "ALL", label: "Tất cả" },
  { value: "UNASSIGNED", label: "Chưa giao" },
  { value: "ASSIGNED", label: "Của tôi" }
];
const SORT_OPTIONS = [
  { value: "newest", label: "Mới nhất" },
  { value: "oldest", label: "Cũ nhất" },
  { value: "priority", label: "Ưu tiên cao" }
];

function getErrorMessage(error, fallback) {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || fallback;
  }
  return error?.message || fallback;
}

function getEnvelopeData(response, fallback) {
  if (!response || typeof response !== "object") {
    return response ?? fallback;
  }
  if ("data" in response) {
    const data = response.data;
    if (data && typeof data === "object" && "data" in data) {
      return data.data ?? fallback;
    }
    return data ?? fallback;
  }
  return response;
}

function formatDateTime(value) {
  if (!value) return "Chưa có";
  return new Date(value).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function formatTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function TicketAttachmentPreview({ attachment, compact = false }) {
  const fileUrl = getAttachmentUrl(attachment);

  if (!fileUrl) {
    return <div className="hd-att-icon">FILE</div>;
  }

  if (isImageAttachment(attachment)) {
    return (
      <a className={`hd-att-preview${compact ? " is-compact" : ""}`} href={fileUrl} target="_blank" rel="noreferrer">
        <img src={fileUrl} alt={attachment.name} loading="lazy" />
      </a>
    );
  }

  if (isVideoAttachment(attachment)) {
    return (
      <a className={`hd-att-preview${compact ? " is-compact" : ""}`} href={fileUrl} target="_blank" rel="noreferrer">
        <video src={fileUrl} muted preload="metadata" />
      </a>
    );
  }

  return <a className="hd-att-icon" href={fileUrl} target="_blank" rel="noreferrer">FILE</a>;
}

function isToday(value) {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function getPriorityWeight(priority) {
  return (
    {
      URGENT: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1
    }[String(priority || "").toUpperCase()] || 0
  );
}

function extractTicketContext(ticket) {
  const combinedText = [ticket?.title, ticket?.description, ...(ticket?.messages || []).map((message) => message.message)]
    .filter(Boolean)
    .join("\n");

  const serialMatch = combinedText.match(/serial[:\s#-]*([A-Z0-9._-]+)/i);
  const orderMatch = combinedText.match(/(?:mã đơn|đơn hàng|order)[#:\s-]*([A-Z0-9_-]+)/i);
  const warrantyMatch = combinedText.match(/(?:mã bảo hành|warranty)[#:\s-]*([A-Z0-9_-]+)/i);
  const isWarrantyRelated = /bảo hành|warranty|serial/i.test(combinedText);

  return {
    serial: serialMatch?.[1] || "",
    orderCode: orderMatch?.[1] || "",
    warrantyCode: warrantyMatch?.[1] || "",
    isWarrantyRelated
  };
}

function buildTicketStageState(ticket) {
  const lastMessage = ticket?.messages?.[ticket.messages.length - 1];
  const waitingCustomer = ticket?.status === "IN_PROGRESS" && lastMessage && isTechSender(lastMessage.sender?.role);
  const status = String(ticket?.status || "OPEN").toUpperCase();

  const stageTimestamps = {
    NEW: ticket?.createdAt || null,
    RECEIVED: ticket?.assignedToId ? ticket?.updatedAt || ticket?.createdAt : null,
    IN_PROGRESS: ["IN_PROGRESS", "RESOLVED", "CLOSED"].includes(status) ? ticket?.updatedAt || ticket?.createdAt : null,
    WAITING_CUSTOMER: waitingCustomer ? lastMessage?.createdAt || ticket?.updatedAt : null,
    RESOLVED: ["RESOLVED", "CLOSED"].includes(status) ? ticket?.updatedAt : null,
    CLOSED: status === "CLOSED" ? ticket?.updatedAt : null
  };

  const currentKey =
    status === "CLOSED"
      ? "CLOSED"
      : status === "RESOLVED"
        ? "RESOLVED"
        : waitingCustomer
          ? "WAITING_CUSTOMER"
          : status === "IN_PROGRESS"
            ? "IN_PROGRESS"
            : ticket?.assignedToId
              ? "RECEIVED"
              : "NEW";

  const steps = [
    { key: "NEW", label: "Mới", helper: "Vừa khởi tạo", timestamp: stageTimestamps.NEW },
    { key: "RECEIVED", label: "Đã tiếp nhận", helper: ticket?.assignee?.fullName || "Chưa phân công", timestamp: stageTimestamps.RECEIVED },
    { key: "IN_PROGRESS", label: "Đang xử lý", helper: "Đang kiểm tra", timestamp: stageTimestamps.IN_PROGRESS },
    { key: "WAITING_CUSTOMER", label: "Chờ khách", helper: "Đã gửi hướng dẫn", timestamp: stageTimestamps.WAITING_CUSTOMER },
    { key: "RESOLVED", label: "Đã giải quyết", helper: "Có kết quả xử lý", timestamp: stageTimestamps.RESOLVED },
    { key: "CLOSED", label: "Đóng ticket", helper: "Hoàn tất", timestamp: stageTimestamps.CLOSED }
  ];

  const currentIndex = steps.findIndex((step) => step.key === currentKey);
  return steps.map((step, index) => ({
    ...step,
    active: index <= currentIndex,
    current: index === currentIndex
  }));
}

function buildActivityFeed(ticket) {
  if (!ticket) return [];
  const events = [
    {
      id: `created-${ticket.id}`,
      label: "Ticket được tạo",
      helper: ticket.reporter?.fullName || ticket.reporter?.email || "Khách hàng",
      timestamp: ticket.createdAt
    }
  ];

  if (ticket.assignee?.fullName) {
    events.push({
      id: `assignee-${ticket.id}`,
      label: "Đã giao cho kỹ thuật xử lý",
      helper: ticket.assignee.fullName,
      timestamp: ticket.updatedAt || ticket.createdAt
    });
  }

  if (ticket.messages?.length) {
    const latest = ticket.messages[ticket.messages.length - 1];
    events.push({
      id: `message-${latest.id}`,
      label: isTechSender(latest.sender?.role) ? "Kỹ thuật đã phản hồi" : "Khách hàng vừa nhắn",
      helper: latest.sender?.fullName || latest.sender?.email || "Người dùng",
      timestamp: latest.createdAt
    });
  }

  if (ticket.status === "RESOLVED") {
    events.push({
      id: `resolved-${ticket.id}`,
      label: "Ticket được đánh dấu đã giải quyết",
      helper: ticket.assignee?.fullName || "Bộ phận kỹ thuật",
      timestamp: ticket.updatedAt
    });
  }

  if (ticket.status === "CLOSED") {
    events.push({
      id: `closed-${ticket.id}`,
      label: "Ticket đã đóng",
      helper: ticket.assignee?.fullName || "Bộ phận kỹ thuật",
      timestamp: ticket.updatedAt
    });
  }

  return events.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
}

function TicketListSkeleton() {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          style={{
            height: 112,
            borderRadius: 14,
            border: "1px solid #e2e8f0",
            background: "linear-gradient(90deg, #f8fafc 25%, #f1f5f9 50%, #f8fafc 75%)",
            backgroundSize: "200% 100%",
            animation: "hdShimmer 1.4s ease-in-out infinite"
          }}
        />
      ))}
    </div>
  );
}

function WorkspaceSkeleton() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          height: 210,
          borderRadius: 18,
          background: "linear-gradient(90deg, #0f172a 25%, #1e293b 50%, #0f172a 75%)",
          backgroundSize: "200% 100%",
          animation: "hdShimmer 1.4s ease-in-out infinite"
        }}
      />
      <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 16 }}>
        <div style={{ height: 320, borderRadius: 16, border: "1px solid #e2e8f0", background: "#f8fafc" }} />
        <div style={{ height: 320, borderRadius: 16, border: "1px solid #e2e8f0", background: "#f8fafc" }} />
      </div>
    </div>
  );
}

export function TechTicketsPage() {
  const { authState } = useAuth();
  const currentUserId = authState?.user?.id;
  const techName = authState?.user?.fullName || "Nhân viên kỹ thuật";
  const { joinRoom, leaveRoom, on } = useSocket();

  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedTicketId, setSelectedTicketId] = useState(() => {
    const stored = window.localStorage.getItem(STORAGE_SELECTED_TICKET);
    return stored ? Number(stored) : null;
  });
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [scope, setScope] = useState("ALL");
  const [sortBy, setSortBy] = useState("newest");
  const [keyword, setKeyword] = useState("");
  const [replyMessage, setReplyMessage] = useState("");
  const [replyFiles, setReplyFiles] = useState([]);
  const [internalNotes, setInternalNotes] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem(STORAGE_INTERNAL_NOTES) || "{}");
    } catch {
      return {};
    }
  });
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showCloseModal, setShowCloseModal] = useState(false);
  const messageListRef = useRef(null);
  const replyTextareaRef = useRef(null);
  const replyFileInputRef = useRef(null);

  const loadStats = useCallback(async () => {
    try {
      const response = await getTicketStats();
      setStats(getEnvelopeData(response, null));
    } catch {
      setStats(null);
    }
  }, []);

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage("");
      const response = await getManageTickets({
        scope,
        keyword: keyword.trim() || undefined,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined
      });
      const list = getEnvelopeData(response, []);
      const normalized = Array.isArray(list) ? list : [];
      setTickets(normalized);

      if (normalized.length === 0) {
        setSelectedTicketId(null);
        setSelectedTicket(null);
      }
      return normalized;
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Không thể tải danh sách ticket."));
      return [];
    } finally {
      setLoading(false);
    }
  }, [keyword, scope, statusFilter, priorityFilter]);

  useEffect(() => {
    loadTickets();
    loadStats();
  }, [loadTickets, loadStats]);

  const normalizedTickets = useMemo(() => {
    return tickets.map((ticket) => {
      const messages = Array.isArray(ticket.messages) ? ticket.messages : [];
      const attachmentMentions = [
        ...extractAttachmentMentions(ticket.description),
        ...messages.flatMap((message) => extractAttachmentMentions(message.message))
      ];
      const latestMessage = messages[messages.length - 1] || null;
      const waitingCustomer = ticket.status === "IN_PROGRESS" && latestMessage && isTechSender(latestMessage.sender?.role);
      const needsTechAttention = ticket.status !== "CLOSED" && latestMessage && !isTechSender(latestMessage.sender?.role);

      return { ...ticket, attachmentMentions, waitingCustomer, needsTechAttention };
    });
  }, [tickets]);

  const visibleTickets = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    const ticketIdKeyword = normalizedKeyword.match(/^(?:#|ticket\s*)?(\d+)$/i)?.[1] || "";
    let list = normalizedTickets.filter((ticket) => {
      if (!normalizedKeyword) return true;
      if (ticketIdKeyword) return String(ticket.id) === ticketIdKeyword;
      const haystack = [
        `#${ticket.id}`,
        `ticket ${ticket.id}`,
        ticket.id,
        ticket.title,
        ticket.description,
        ticket.reporter?.fullName,
        ticket.reporter?.email,
        ticket.assignee?.fullName
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedKeyword);
    });

    list = [...list].sort((a, b) => {
      if (sortBy === "priority") {
        return getPriorityWeight(b.priority) - getPriorityWeight(a.priority) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === "oldest") {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return list;
  }, [keyword, normalizedTickets, sortBy]);

  useEffect(() => {
    if (!visibleTickets.length) {
      setSelectedTicketId(null);
      setSelectedTicket(null);
      return;
    }
    if (selectedTicketId && visibleTickets.some((ticket) => ticket.id === selectedTicketId)) return;
    setSelectedTicketId(visibleTickets[0].id);
  }, [keyword, selectedTicketId, visibleTickets]);

  useEffect(() => {
    if (selectedTicketId) {
      window.localStorage.setItem(STORAGE_SELECTED_TICKET, String(selectedTicketId));
    } else {
      window.localStorage.removeItem(STORAGE_SELECTED_TICKET);
    }
  }, [selectedTicketId]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_INTERNAL_NOTES, JSON.stringify(internalNotes));
  }, [internalNotes]);

  useEffect(() => {
    if (!selectedTicketId) {
      setSelectedTicket(null);
      return;
    }

    async function loadDetail() {
      try {
        setDetailLoading(true);
        const response = await getTicketDetail(selectedTicketId);
        setSelectedTicket(getEnvelopeData(response, null));
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          window.localStorage.removeItem(STORAGE_SELECTED_TICKET);
          setSelectedTicketId(null);
          setSelectedTicket(null);
        } else {
          setErrorMessage(getErrorMessage(error, "Không thể tải chi tiết ticket."));
        }
      } finally {
        setDetailLoading(false);
      }
    }

    loadDetail();
  }, [selectedTicketId]);

  // Socket.io: Tech queue real-time listeners
  useEffect(() => {
    joinRoom("join_tech_queue");

    const unsubNewTicket = on("tickets:new_ticket", (newTicket) => {
      setTickets((prev) => {
        const exists = prev.some((t) => Number(t.id) === Number(newTicket.id));
        if (exists) return prev;
        return [newTicket, ...prev];
      });
      loadStats();
    });

    const unsubQueueUpdated = on("tickets:queue_updated", ({ ticketId, status }) => {
      setTickets((prev) =>
        prev.map((t) => (Number(t.id) === Number(ticketId) ? { ...t, status: status || t.status } : t))
      );
      if (ticketId) {
        getTicketDetail(ticketId)
          .then((response) => {
            const detail = getEnvelopeData(response, null);
            if (!detail) return;
            setTickets((prev) => prev.map((t) => (Number(t.id) === Number(ticketId) ? { ...t, ...detail } : t)));
            if (Number(ticketId) === Number(selectedTicketId)) {
              setSelectedTicket(detail);
            }
          })
          .catch(() => {});
      }
      loadStats();
    });

    return () => {
      if (typeof unsubNewTicket === "function") unsubNewTicket();
      if (typeof unsubQueueUpdated === "function") unsubQueueUpdated();
    };
  }, [joinRoom, on, loadStats, selectedTicketId]);

  // Socket.io: Active ticket detail real-time listeners
  useEffect(() => {
    if (!selectedTicketId) return undefined;

    joinRoom("join_ticket", selectedTicketId);

    const unsubNewMessage = on("ticket:new_message", ({ ticketId }) => {
      if (String(ticketId) !== String(selectedTicketId)) return;
      getTicketDetail(selectedTicketId)
        .then((response) => {
          const detail = getEnvelopeData(response, null);
          setSelectedTicket(detail);
          if (detail) {
            setTickets((prev) => prev.map((t) => (Number(t.id) === Number(selectedTicketId) ? { ...t, ...detail } : t)));
          }
        })
        .catch(() => {});
    });

    const unsubStatusChanged = on("ticket:status_changed", (updatedTicket) => {
      if (Number(updatedTicket?.id) === Number(selectedTicketId)) {
        getTicketDetail(selectedTicketId)
          .then((response) => setSelectedTicket(getEnvelopeData(response, updatedTicket)))
          .catch(() => setSelectedTicket(updatedTicket));
      }
    });

    return () => {
      if (typeof unsubNewMessage === "function") unsubNewMessage();
      if (typeof unsubStatusChanged === "function") unsubStatusChanged();
      leaveRoom("leave_ticket", selectedTicketId);
    };
  }, [selectedTicketId, joinRoom, leaveRoom, on]);

  useEffect(() => {
    if (!successMessage) return undefined;
    const timer = setTimeout(() => setSuccessMessage(""), 3500);
    return () => clearTimeout(timer);
  }, [successMessage]);

  useEffect(() => {
    if (!messageListRef.current) return;
    const node = messageListRef.current;
    const nearBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 80;
    if (!nearBottom) return;
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [selectedTicket?.messages, actionLoading]);

  const selectedTicketResolved = useMemo(() => {
    if (!selectedTicket) return null;
    const listTicket = normalizedTickets.find((ticket) => ticket.id === selectedTicket.id);
    const mergedTicket = listTicket
      ? {
          ...listTicket,
          ...selectedTicket,
          messages: selectedTicket.messages || [],
          attachmentMentions: [
            ...(listTicket.attachmentMentions || []),
            ...extractAttachmentMentions(selectedTicket.description),
            ...(selectedTicket.messages || []).flatMap((message) => extractAttachmentMentions(message.message))
          ]
        }
      : {
          ...selectedTicket,
          attachmentMentions: [
            ...extractAttachmentMentions(selectedTicket.description),
            ...(selectedTicket.messages || []).flatMap((message) => extractAttachmentMentions(message.message))
          ]
        };

    return {
      ...mergedTicket,
      attachmentMentions: [...new Map((mergedTicket.attachmentMentions || []).map((att) => [att.id, att])).values()]
    };
  }, [normalizedTickets, selectedTicket]);

  const selectedStatusMeta = getTicketStatusMeta(selectedTicketResolved?.status);
  const selectedPriorityMeta = getTicketPriorityMeta(selectedTicketResolved?.priority);
  const canAssignSelf = selectedTicketResolved && !selectedTicketResolved.assignedToId;
  const isMine = Number(selectedTicketResolved?.assignedToId) === Number(currentUserId);
  const stageSteps = useMemo(() => buildTicketStageState(selectedTicketResolved), [selectedTicketResolved]);
  const activityFeed = useMemo(() => buildActivityFeed(selectedTicketResolved), [selectedTicketResolved]);
  const ticketContext = useMemo(() => extractTicketContext(selectedTicketResolved), [selectedTicketResolved]);

  const kpiStats = useMemo(() => {
    const waitingCustomer = normalizedTickets.filter((ticket) => ticket.waitingCustomer).length;
    const resolvedToday = normalizedTickets.filter(
      (ticket) => ["RESOLVED", "CLOSED"].includes(String(ticket.status || "").toUpperCase()) && isToday(ticket.updatedAt)
    ).length;

    return {
      open: stats?.open ?? normalizedTickets.filter((ticket) => ticket.status === "OPEN").length,
      inProgress: stats?.inProgress ?? normalizedTickets.filter((ticket) => ticket.status === "IN_PROGRESS").length,
      waitingCustomer,
      resolvedToday
    };
  }, [normalizedTickets, stats]);

  async function refreshAll() {
    if (refreshing) return;

    try {
      setRefreshing(true);
      setErrorMessage("");
      setSuccessMessage("");

      const previousIds = new Set(normalizedTickets.map((ticket) => Number(ticket.id)));
      const [freshTickets] = await Promise.all([loadTickets(), loadStats()]);
      const freshList = Array.isArray(freshTickets) ? freshTickets : [];
      const newTickets = freshList.filter((ticket) => !previousIds.has(Number(ticket.id)));

      if (newTickets.length > 0) {
        const newestTicket = [...newTickets].sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        )[0];
        setSelectedTicketId(newestTicket.id);
        setSuccessMessage(`Đã cập nhật. Có ${newTickets.length} ticket mới, đã mở ticket #${newestTicket.id}.`);
        return;
      }

      const newestOpenTicket = [...freshList]
        .filter((ticket) => String(ticket.status || "").toUpperCase() === "OPEN")
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0];

      if (newestOpenTicket && Number(selectedTicketId) !== Number(newestOpenTicket.id)) {
        setSelectedTicketId(newestOpenTicket.id);
        setSuccessMessage(`Đã cập nhật. Đã mở ticket mới #${newestOpenTicket.id} đang chờ tiếp nhận.`);
        return;
      }

      if (selectedTicketId) {
        const response = await getTicketDetail(selectedTicketId);
        setSelectedTicket(getEnvelopeData(response, null));
      }

      setSuccessMessage(`Đã làm mới danh sách. Hiện có ${freshList.length} ticket phù hợp bộ lọc.`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Không thể làm mới danh sách ticket."));
    } finally {
      setRefreshing(false);
    }
  }

  async function handleAction(type, data) {
    if (!selectedTicketResolved) return;

    try {
      setActionLoading(type);
      setErrorMessage("");
      let response;

      if (type === "reply") {
        let replyPayload = {
          message: data,
          visibility: "PUBLIC"
        };
        if (Array.isArray(replyFiles) && replyFiles.length > 0) {
          const formData = new FormData();
          formData.append("message", String(data || "Kỹ thuật viên đã gửi tệp đính kèm."));
          formData.append("visibility", "PUBLIC");
          replyFiles.forEach((file) => formData.append("attachments", file));
          replyPayload = formData;
        }
        response = await addTicketMessage(selectedTicketResolved.id, replyPayload);
        setReplyMessage("");
        setReplyFiles([]);
        if (replyFileInputRef.current) replyFileInputRef.current.value = "";
      } else if (type === "internal_note") {
        response = await addTicketMessage(selectedTicketResolved.id, {
          message: data,
          visibility: "INTERNAL"
        });
        setInternalNotes((prev) => ({ ...prev, [selectedTicketResolved.id]: "" }));
      } else {
        response = await updateTicket(selectedTicketResolved.id, data);
      }

      const updated = getEnvelopeData(response, null);
      setSelectedTicket(updated);
      setTickets((prev) => prev.map((ticket) => (ticket.id === selectedTicketResolved.id ? { ...ticket, ...updated } : ticket)));
      setSuccessMessage(
        type === "reply"
          ? "Đã gửi phản hồi cho khách hàng."
          : type === "internal_note"
            ? "Đã lưu và đồng bộ ghi chú nội bộ lên hệ thống."
            : "Đã cập nhật ticket thành công."
      );
      await loadStats();
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Không thể thực hiện thao tác này."));
    } finally {
      setActionLoading("");
    }
  }

  function handleSendReply() {
    const trimmed = replyMessage.trim();
    if (!trimmed && replyFiles.length === 0) return;
    handleAction("reply", trimmed || "Kỹ thuật viên đã gửi tệp đính kèm.");
  }

  function handleAssignToMe() {
    handleAction("assign", { assignedToId: currentUserId, status: "IN_PROGRESS" });
  }

  function handleTransferOrUnassign() {
    if (!selectedTicketResolved) return;
    if (isMine) {
      handleAction("unassign", { assignedToId: null, status: "OPEN" });
    } else {
      handleAction("assign", { assignedToId: currentUserId, status: "IN_PROGRESS" });
    }
  }

  function handleResolve() {
    handleAction("resolve", { status: "RESOLVED" });
  }

  function handleClose() {
    setShowCloseModal(true);
  }

  function saveInternalNote() {
    if (!selectedTicketResolved) return;
    const draft = String(internalNotes[selectedTicketResolved.id] || "").trim();
    if (!draft) {
      setErrorMessage("Vui lòng nhập nội dung ghi chú nội bộ trước khi lưu.");
      return;
    }
    handleAction("internal_note", draft);
  }

  function setNeedMoreInfoTemplate() {
    setReplyMessage("Bạn vui lòng gửi thêm ảnh lỗi, video hoặc thông tin cấu hình để kỹ thuật kiểm tra chính xác hơn.");
    replyTextareaRef.current?.focus();
  }

  return (
    <div className="hd-shell">
      <style>{`
        @keyframes hdShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .hd-shell { width: 100%; display: flex; flex-direction: column; gap: 20px; }
        .hd-kpi-btn { text-align: left; cursor: pointer; font-family: inherit; width: 100%; }
        .hd-workspace { display: grid; grid-template-columns: 385px minmax(0, 1fr); gap: 20px; align-items: start; }
        .hd-inbox { position: sticky; top: 82px; border-radius: 18px; border: 1px solid #e2e8f0; background: #ffffff; box-shadow: 0 12px 30px -22px rgba(15, 23, 42, 0.25); overflow: hidden; display: flex; flex-direction: column; }
        .hd-inbox-head { padding: 18px 18px 14px; border-bottom: 1px solid #f1f5f9; background: #fafcff; display: flex; flex-direction: column; gap: 11px; }
        .hd-inbox-head h2 { margin: 0; font-size: 16px; font-weight: 800; color: #0f172a; }
        .hd-inbox-head p { margin: 2px 0 0; font-size: 12px; color: #64748b; }
        .hd-scope-seg { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 3px; border-radius: 10px; background: #f1f5f9; border: 1px solid #e2e8f0; }
        .hd-scope-btn { padding: 6px 8px; border-radius: 7px; border: none; background: transparent; color: #475569; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.14s ease; }
        .hd-scope-btn.is-active { background: #ffffff; color: #0f172a; box-shadow: 0 2px 6px rgba(15, 23, 42, 0.08); }
        .hd-filter-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .hd-select { width: 100%; padding: 8px 10px; border-radius: 9px; border: 1px solid #cbd5e1; background: #ffffff; color: #0f172a; font-size: 12px; font-weight: 600; outline: none; }
        .hd-select:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.11); }
        .hd-quick-tabs { display: flex; gap: 5px; flex-wrap: wrap; }
        .hd-quick-tab { padding: 5px 10px; border-radius: 999px; border: 1px solid #e2e8f0; background: #ffffff; color: #475569; font-size: 11.5px; font-weight: 700; cursor: pointer; }
        .hd-quick-tab.is-active { background: #0f172a; border-color: #0f172a; color: #ffffff; }
        .hd-inbox-list { padding: 14px; display: flex; flex-direction: column; gap: 10px; max-height: calc(100vh - 330px); overflow-y: auto; }
        .hd-ticket-item { position: relative; width: 100%; text-align: left; padding: 13px 14px; border-radius: 13px; border: 1px solid #e2e8f0; background: #ffffff; display: flex; flex-direction: column; gap: 7px; cursor: pointer; transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease; }
        .hd-ticket-item:hover { border-color: #93c5fd; transform: translateY(-1px); box-shadow: 0 10px 20px -14px rgba(37, 99, 235, 0.25); }
        .hd-ticket-item.is-active { border-color: #2563eb; background: linear-gradient(180deg, #ffffff 0%, #f5f9ff 100%); box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.14); }
        .hd-ticket-item.is-active::before { content: ""; position: absolute; left: 0; top: 10px; bottom: 10px; width: 3.5px; border-radius: 0 4px 4px 0; background: #2563eb; }
        .hd-row-between { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
        .hd-ticket-id { font-family: ui-monospace, monospace; font-size: 12px; font-weight: 800; color: #0f172a; background: #f1f5f9; border: 1px solid #e2e8f0; padding: 2px 7px; border-radius: 6px; }
        .hd-ticket-title { font-size: 13.5px; font-weight: 750; color: #0f172a; line-height: 1.4; }
        .hd-ticket-sub { font-size: 12px; color: #64748b; }
        .hd-pill { display: inline-flex; align-items: center; justify-content: center; padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 750; white-space: nowrap; }
        .hd-pill--info { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
        .hd-pill--warning { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
        .hd-pill--success { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
        .hd-pill--danger { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
        .hd-pill--neutral { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
        .hd-canvas { min-width: 0; display: flex; flex-direction: column; gap: 16px; }
        .hd-detail-hero { position: relative; overflow: hidden; border-radius: 18px; padding: 22px 24px; background: radial-gradient(500px 220px at 90% 0%, rgba(56, 189, 248, 0.16), transparent 65%), linear-gradient(135deg, #0b1220 0%, #16233d 60%, #1e293b 100%); border: 1px solid rgba(148, 163, 184, 0.2); color: #f8fafc; display: flex; flex-direction: column; gap: 18px; box-shadow: 0 18px 36px -22px rgba(9, 15, 30, 0.55); }
        .hd-detail-hero__top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
        .hd-detail-hero h2 { margin: 10px 0 0; font-size: 22px; font-weight: 800; color: #ffffff; line-height: 1.25; }
        .hd-detail-hero p { margin: 5px 0 0; font-size: 12.5px; color: #94a3b8; }
        .hd-detail-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .hd-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 13px; border-radius: 10px; border: 1px solid transparent; font-size: 12.5px; font-weight: 700; cursor: pointer; transition: all 0.15s ease; }
        .hd-btn:hover:not(:disabled) { transform: translateY(-1px); }
        .hd-btn:disabled { opacity: 0.42; cursor: not-allowed; }
        .hd-btn--glass { background: rgba(255, 255, 255, 0.09); border-color: rgba(255, 255, 255, 0.16); color: #f8fafc; }
        .hd-btn--glass:hover:not(:disabled) { background: rgba(255, 255, 255, 0.16); }
        .hd-btn--primary { background: linear-gradient(135deg, #2563eb, #4f46e5); color: #ffffff; box-shadow: 0 8px 18px -8px rgba(37, 99, 235, 0.6); }
        .hd-btn--emerald { background: linear-gradient(135deg, #059669, #10b981); color: #ffffff; }
        .hd-btn--light { background: #ffffff; color: #0f172a; border-color: #cbd5e1; }
        .hd-btn--danger { background: rgba(239, 68, 68, 0.18); border-color: rgba(248, 113, 113, 0.45); color: #fecaca; }
        .hd-btn--danger-solid { background: #dc2626; color: #ffffff; }
        .hd-progress-track { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; padding-top: 14px; border-top: 1px solid rgba(148, 163, 184, 0.16); }
        .hd-step { padding: 10px 11px; border-radius: 12px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .hd-step.is-done { background: rgba(16, 185, 129, 0.1); border-color: rgba(52, 211, 153, 0.35); }
        .hd-step.is-current { background: rgba(56, 189, 248, 0.14); border-color: rgba(56, 189, 248, 0.55); box-shadow: 0 8px 20px -12px rgba(56, 189, 248, 0.6); }
        .hd-step.is-pending { opacity: 0.52; }
        .hd-step__dot { width: 22px; height: 22px; border-radius: 999px; display: grid; place-items: center; font-size: 11px; font-weight: 800; background: rgba(255,255,255,0.12); color: #e2e8f0; }
        .hd-step.is-done .hd-step__dot { background: #10b981; color: #ffffff; }
        .hd-step.is-current .hd-step__dot { background: #38bdf8; color: #090f1e; }
        .hd-step strong { font-size: 12px; color: #ffffff; line-height: 1.25; }
        .hd-step span { font-size: 11px; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .hd-step small { font-size: 10px; color: #64748b; }
        .hd-main-grid { display: grid; grid-template-columns: minmax(0, 1.2fr) 330px; gap: 16px; align-items: start; }
        .hd-col-stack { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
        .hd-card { border-radius: 16px; border: 1px solid #e2e8f0; background: #ffffff; padding: 18px 20px; box-shadow: 0 10px 24px -22px rgba(15, 23, 42, 0.22); display: flex; flex-direction: column; gap: 14px; min-width: 0; }
        .hd-card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
        .hd-card-head h3 { margin: 0; font-size: 15px; font-weight: 800; color: #0f172a; }
        .hd-card-head p { margin: 3px 0 0; font-size: 12px; color: #64748b; }
        .hd-data-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .hd-data-tile { padding: 11px 13px; border-radius: 11px; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .hd-data-tile span { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; }
        .hd-data-tile strong { font-size: 13.5px; font-weight: 700; color: #0f172a; word-break: break-word; }
        .hd-messages { max-height: 420px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; padding: 4px 4px 4px 0; }
        .hd-msg-row { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
        .hd-msg-row.is-tech { align-items: flex-end; }
        .hd-msg-meta { font-size: 11.5px; font-weight: 700; color: #64748b; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .hd-msg-bubble { max-width: min(82%, 640px); padding: 12px 15px; border-radius: 14px; background: #f8fafc; border: 1px solid #e2e8f0; color: #1e293b; font-size: 13.5px; line-height: 1.6; white-space: pre-wrap; }
        .hd-msg-bubble.is-tech { background: #eff6ff; border-color: #bfdbfe; color: #0f172a; }
        .hd-msg-bubble.is-internal { background: #fffbeb; border-color: #fcd34d; color: #78350f; }
        .hd-reply-grid { display: grid; grid-template-columns: minmax(0, 1fr) 210px; gap: 12px; align-items: start; }
        .hd-att-item { display: flex; gap: 11px; align-items: center; padding: 10px 12px; border-radius: 12px; background: #f8fafc; border: 1px solid #e2e8f0; }
        .hd-att-icon { width: 46px; height: 46px; flex: 0 0 46px; border-radius: 10px; display: grid; place-items: center; background: #eff6ff; color: #1d4ed8; font-size: 11px; font-weight: 800; text-decoration: none; }
        .hd-att-preview { width: 58px; height: 58px; flex: 0 0 58px; border-radius: 10px; overflow: hidden; border: 1px solid #cbd5e1; background: #fff; display: block; }
        .hd-att-preview.is-compact { width: 42px; height: 42px; flex-basis: 42px; }
        .hd-att-preview img, .hd-att-preview video { width: 100%; height: 100%; object-fit: cover; display: block; }
        .hd-activity-list { display: flex; flex-direction: column; gap: 12px; }
        .hd-activity-item { display: grid; grid-template-columns: 12px minmax(0, 1fr); gap: 11px; align-items: start; }
        .hd-activity-dot { width: 10px; height: 10px; margin-top: 4px; border-radius: 999px; background: #2563eb; box-shadow: 0 0 0 4px #eff6ff; }
        .hd-empty { padding: 28px 18px; border-radius: 12px; background: #f8fafc; border: 1px dashed #cbd5e1; color: #64748b; text-align: center; font-size: 13px; }
        .hd-alert { padding: 12px 16px; border-radius: 12px; font-size: 13px; font-weight: 700; }
        .hd-alert--error { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
        .hd-alert--success { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
        @media (max-width: 1280px) {
          .hd-workspace { grid-template-columns: 335px minmax(0, 1fr); }
          .hd-main-grid { grid-template-columns: 1fr; }
          .hd-progress-track { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .hd-reply-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 960px) {
          .hd-workspace { grid-template-columns: 1fr; }
          .hd-inbox { position: static; }
          .hd-inbox-list { max-height: 440px; }
          .hd-data-grid, .hd-progress-track { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      {/* ==================== EXECUTIVE TECH HELPDESK HERO ==================== */}
      <section className="ai-studio-hero">
        <div className="ai-studio-hero-top">
          <div>
            <div className="ai-studio-hero-badges">
              <span className="ai-studio-live-pill">
                <span className="ai-studio-live-dot" />
                Technical Helpdesk • Socket.io Live
              </span>
              <span className="ai-studio-tech-pill">Hỗ trợ phần cứng • Chẩn đoán • Bảo hành</span>
            </div>
            <h1 className="ai-studio-hero-title">Trung Tâm Hỗ Trợ Kỹ Thuật &amp; Helpdesk</h1>
            <p className="ai-studio-hero-desc">
              Theo dõi hộp thư ticket theo thời gian thực, tiếp nhận yêu cầu từ khách hàng, phản hồi kèm hình ảnh/video và kiểm soát toàn bộ tiến độ xử lý trên một workspace tập trung.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Link
              to="/tech/compatibility"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "10px 15px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.08)",
                color: "#f8fafc",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
                backdropFilter: "blur(8px)"
              }}
            >
              Luật tương thích ↗
            </Link>
            <button
              type="button"
              className="ai-studio-hero-cta"
              onClick={refreshAll}
              disabled={Boolean(actionLoading) || refreshing}
            >
              <svg className={refreshing ? "ai-studio-spin" : ""} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
              <span>{refreshing ? "Đang cập nhật..." : "Làm Mới Inbox"}</span>
            </button>
          </div>
        </div>

        <div className="ai-studio-kpi-grid">
          <button
            type="button"
            className="ai-studio-kpi hd-kpi-btn"
            style={{ "--kpi-accent": "#38bdf8" }}
            onClick={() => setStatusFilter("OPEN")}
          >
            <div className="ai-studio-kpi-head">
              <span className="ai-studio-kpi-label">Ticket mới</span>
              <span className="ai-studio-kpi-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
              </span>
            </div>
            <div className="ai-studio-kpi-value" style={{ color: kpiStats.open > 0 ? "#7dd3fc" : "#ffffff" }}>
              {kpiStats.open}
            </div>
            <div className="ai-studio-kpi-hint">Ưu tiên tiếp nhận xử lý</div>
          </button>

          <button
            type="button"
            className="ai-studio-kpi hd-kpi-btn"
            style={{ "--kpi-accent": "#fbbf24" }}
            onClick={() => setStatusFilter("IN_PROGRESS")}
          >
            <div className="ai-studio-kpi-head">
              <span className="ai-studio-kpi-label">Đang xử lý</span>
              <span className="ai-studio-kpi-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              </span>
            </div>
            <div className="ai-studio-kpi-value">{kpiStats.inProgress}</div>
            <div className="ai-studio-kpi-hint">Đội kỹ thuật đang phụ trách</div>
          </button>

          <div className="ai-studio-kpi" style={{ "--kpi-accent": "#a78bfa" }}>
            <div className="ai-studio-kpi-head">
              <span className="ai-studio-kpi-label">Chờ phản hồi khách</span>
              <span className="ai-studio-kpi-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              </span>
            </div>
            <div className="ai-studio-kpi-value">{kpiStats.waitingCustomer}</div>
            <div className="ai-studio-kpi-hint">Đã gửi hướng dẫn khắc phục</div>
          </div>

          <div className="ai-studio-kpi" style={{ "--kpi-accent": "#34d399" }}>
            <div className="ai-studio-kpi-head">
              <span className="ai-studio-kpi-label">Giải quyết hôm nay</span>
              <span className="ai-studio-kpi-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="20 6 9 17 4 12" /></svg>
              </span>
            </div>
            <div className="ai-studio-kpi-value" style={{ color: "#6ee7b7" }}>{kpiStats.resolvedToday}</div>
            <div className="ai-studio-kpi-hint">Hoàn tất trong ngày</div>
          </div>
        </div>
      </section>

      {errorMessage ? <div className="hd-alert hd-alert--error">{errorMessage}</div> : null}
      {successMessage ? <div className="hd-alert hd-alert--success">{successMessage}</div> : null}

      {/* ==================== SPLIT HELPDESK WORKSPACE ==================== */}
      <div className="hd-workspace">
        <aside className="hd-inbox">
          <div className="hd-inbox-head">
            <div className="hd-row-between">
              <div>
                <h2>Inbox Ticket</h2>
                <p>Chọn ticket để mở khung chẩn đoán &amp; hội thoại.</p>
              </div>
              <span className="hd-pill hd-pill--info">{visibleTickets.length}</span>
            </div>

            {/* Scope segmented switch */}
            <div className="hd-scope-seg" role="tablist" aria-label="Phạm vi ticket">
              {SCOPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`hd-scope-btn${scope === opt.value ? " is-active" : ""}`}
                  onClick={() => setScope(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="cat-search-wrap" style={{ width: "100%", minWidth: 0 }}>
              <svg className="cat-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                className="cat-input cat-input--search"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="Tìm #ticket, tiêu đề, khách hàng..."
                aria-label="Tìm ticket"
              />
            </div>

            {/* Non-truncated 2-col dropdowns */}
            <div className="hd-filter-row">
              <select className="hd-select" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} aria-label="Lọc ưu tiên">
                <option value="">Ưu tiên: Tất cả</option>
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>{getTicketPriorityMeta(p).label}</option>
                ))}
              </select>
              <select className="hd-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sắp xếp ticket">
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Status quick pills */}
            <div className="hd-quick-tabs" role="tablist" aria-label="Lọc trạng thái nhanh">
              {[
                { value: "", label: "Tất cả" },
                { value: "OPEN", label: "Mới" },
                { value: "IN_PROGRESS", label: "Đang xử lý" },
                { value: "RESOLVED", label: "Đã giải quyết" },
                { value: "CLOSED", label: "Đã đóng" }
              ].map((tab) => (
                <button
                  key={tab.value || "all"}
                  type="button"
                  className={`hd-quick-tab${statusFilter === tab.value ? " is-active" : ""}`}
                  onClick={() => setStatusFilter(tab.value)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="hd-inbox-list">
            {loading ? (
              <TicketListSkeleton />
            ) : visibleTickets.length === 0 ? (
              <div className="hd-empty">Không có ticket nào khớp bộ lọc hiện tại.</div>
            ) : (
              visibleTickets.map((ticket) => {
                const statusMeta = getTicketStatusMeta(ticket.status);
                const priorityMeta = getTicketPriorityMeta(ticket.priority);
                const isActive = ticket.id === selectedTicketId;
                const lastMessage = ticket.messages?.[ticket.messages.length - 1];

                return (
                  <button
                    key={ticket.id}
                    type="button"
                    className={`hd-ticket-item${isActive ? " is-active" : ""}`}
                    onClick={() => setSelectedTicketId(ticket.id)}
                  >
                    <div className="hd-row-between">
                      <span className="hd-ticket-id">#{ticket.id}</span>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {ticket.attachmentMentions.length > 0 && (
                          <span className="hd-pill hd-pill--neutral">{ticket.attachmentMentions.length} tệp</span>
                        )}
                        {ticket.needsTechAttention && (
                          <span className="hd-pill hd-pill--warning">Tin mới</span>
                        )}
                        <span className={`hd-pill hd-pill--${priorityMeta.tone}`}>{priorityMeta.label}</span>
                      </div>
                    </div>

                    <div className="hd-ticket-title">{normalizeTicketText(ticket.title)}</div>
                    <div className="hd-ticket-sub">{ticket.reporter?.fullName || ticket.reporter?.email || "Khách hàng"}</div>

                    <div className="hd-row-between" style={{ paddingTop: 6, borderTop: "1px solid #f1f5f9", marginTop: 2 }}>
                      <span className={`hd-pill hd-pill--${statusMeta.tone}`}>{statusMeta.label}</span>
                      <span className="hd-ticket-sub" style={{ fontSize: 11 }}>{formatDateTime(lastMessage?.createdAt || ticket.createdAt)}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <main className="hd-canvas">
          {detailLoading ? (
            <WorkspaceSkeleton />
          ) : !selectedTicketResolved ? (
            <div className="hd-card">
              <div className="hd-empty">
                <strong style={{ display: "block", color: "#0f172a", marginBottom: 4, fontSize: 15 }}>Chưa chọn ticket</strong>
                Chọn một ticket từ danh sách Inbox bên trái để mở workspace hỗ trợ kỹ thuật.
              </div>
            </div>
          ) : (
            <>
              {/* ==================== OBSIDIAN TICKET COMMAND HEADER ==================== */}
              <section className="hd-detail-hero">
                <div className="hd-detail-hero__top">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
                      <span className={`hd-pill hd-pill--${selectedStatusMeta.tone}`}>{selectedStatusMeta.label}</span>
                      <span className={`hd-pill hd-pill--${selectedPriorityMeta.tone}`}>{selectedPriorityMeta.label}</span>
                      <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "rgba(255,255,255,0.1)", color: "#e2e8f0", border: "1px solid rgba(255,255,255,0.16)" }}>
                        {selectedTicketResolved.assignee?.fullName ? `Phụ trách: ${selectedTicketResolved.assignee.fullName}` : "Chưa có kỹ thuật nhận"}
                      </span>
                    </div>
                    <h2>{normalizeTicketText(selectedTicketResolved.title)}</h2>
                    <p>
                      Ticket #{selectedTicketResolved.id} · Tạo lúc {formatDateTime(selectedTicketResolved.createdAt)} · Cập nhật {formatDateTime(selectedTicketResolved.updatedAt)}
                    </p>
                  </div>

                  <div className="hd-detail-actions">
                    <button
                      type="button"
                      className="hd-btn hd-btn--glass"
                      onClick={handleAssignToMe}
                      disabled={!canAssignSelf || Boolean(actionLoading)}
                      title={canAssignSelf ? "Nhận ticket này để xử lý" : "Ticket đã có người nhận"}
                    >
                      Nhận xử lý
                    </button>
                    <button
                      type="button"
                      className="hd-btn hd-btn--glass"
                      onClick={setNeedMoreInfoTemplate}
                      disabled={selectedTicketResolved.status === "CLOSED"}
                    >
                      Cần thêm thông tin
                    </button>
                    <button
                      type="button"
                      className="hd-btn hd-btn--glass"
                      onClick={() => replyTextareaRef.current?.focus()}
                      disabled={selectedTicketResolved.status === "CLOSED"}
                    >
                      Phản hồi nhanh
                    </button>
                    <button
                      type="button"
                      className="hd-btn hd-btn--emerald"
                      onClick={handleResolve}
                      disabled={!isMine || ["RESOLVED", "CLOSED"].includes(selectedTicketResolved.status) || Boolean(actionLoading)}
                      title={isMine ? "Đánh dấu ticket đã xử lý xong" : "Chỉ kỹ thuật đang phụ trách mới có thể giải quyết ticket"}
                    >
                      ✓ Đã xử lý xong
                    </button>
                    <button
                      type="button"
                      className="hd-btn hd-btn--light"
                      onClick={handleTransferOrUnassign}
                      disabled={!selectedTicketResolved.assignedToId || selectedTicketResolved.status === "CLOSED" || Boolean(actionLoading)}
                    >
                      {isMine ? "Trả về hàng chờ" : "Nhận tiếp quản"}
                    </button>
                    <button
                      type="button"
                      className="hd-btn hd-btn--danger"
                      onClick={handleClose}
                      disabled={selectedTicketResolved.status === "CLOSED" || Boolean(actionLoading)}
                    >
                      Đóng ticket
                    </button>
                  </div>
                </div>

                {/* Compact 6-step Progress Track */}
                <div className="hd-progress-track" aria-label="Tiến độ xử lý ticket">
                  {stageSteps.map((step, index) => {
                    const cls = step.current ? "is-current" : step.active ? "is-done" : "is-pending";
                    return (
                      <article key={step.key} className={`hd-step ${cls}`}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <span className="hd-step__dot">{step.active && !step.current ? "✓" : index + 1}</span>
                          <strong>{step.label}</strong>
                        </div>
                        <span title={step.helper}>{step.helper}</span>
                        <small>{step.timestamp ? formatDateTime(step.timestamp) : "—"}</small>
                      </article>
                    );
                  })}
                </div>
              </section>

              {/* ==================== WORKSPACE DETAIL GRID ==================== */}
              <div className="hd-main-grid">
                <div className="hd-col-stack">
                  {/* Summary */}
                  <section className="hd-card">
                    <div className="hd-card-head">
                      <div>
                        <h3>Tóm Tắt Yêu Cầu</h3>
                        <p>Thông tin khách hàng, phụ trách kỹ thuật và mức ưu tiên.</p>
                      </div>
                    </div>
                    <div className="hd-data-grid">
                      <div className="hd-data-tile">
                        <span>Khách hàng</span>
                        <strong>{selectedTicketResolved.reporter?.fullName || "Khách hàng"}</strong>
                      </div>
                      <div className="hd-data-tile">
                        <span>Email liên hệ</span>
                        <strong>{selectedTicketResolved.reporter?.email || "Chưa có"}</strong>
                      </div>
                      <div className="hd-data-tile">
                        <span>Người phụ trách</span>
                        <strong>{selectedTicketResolved.assignee?.fullName || "Chưa phân công"}</strong>
                      </div>
                      <div className="hd-data-tile">
                        <span>Mức ưu tiên</span>
                        <strong>{selectedPriorityMeta.label}</strong>
                      </div>
                    </div>
                  </section>

                  {/* Error Description */}
                  <section className="hd-card">
                    <div className="hd-card-head">
                      <div>
                        <h3>Mô Tả Lỗi Từ Khách Hàng</h3>
                        <p>Nội dung phản ánh ban đầu và bối cảnh phát sinh sự cố.</p>
                      </div>
                    </div>
                    <div style={{ padding: "13px 15px", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", color: "#1e293b", fontSize: 13.5, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                      {normalizeTicketText(selectedTicketResolved.description) || "Khách hàng chưa mô tả chi tiết."}
                    </div>
                  </section>

                  {/* Support Thread */}
                  <section className="hd-card">
                    <div className="hd-card-head">
                      <div>
                        <h3>Hội Thoại Hỗ Trợ</h3>
                        <p>Trao đổi trực tiếp thời gian thực với khách hàng, hỗ trợ gửi tệp đính kèm.</p>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <span className="hd-pill hd-pill--info">{selectedTicketResolved.messages?.length || 0} tin nhắn</span>
                        {selectedTicketResolved.status === "CLOSED" && (
                          <span className="hd-pill hd-pill--danger">Đã khóa</span>
                        )}
                      </div>
                    </div>

                    <div className="hd-messages" ref={messageListRef}>
                      {(selectedTicketResolved.messages || []).length === 0 ? (
                        <div className="hd-empty">Chưa có hội thoại phát sinh.</div>
                      ) : (
                        (selectedTicketResolved.messages || []).map((message) => {
                          const isTech = isTechSender(message.sender?.role);
                          const isInternal = String(message.visibility || "PUBLIC").toUpperCase() === "INTERNAL";
                          const attachmentMentions = extractAttachmentMentions(message.message);

                          return (
                            <article key={message.id} className={`hd-msg-row${isTech ? " is-tech" : ""}`}>
                              <div className="hd-msg-meta">
                                <span>{message.sender?.fullName || message.sender?.email || "Người dùng"} · {formatTime(message.createdAt)}</span>
                                {isInternal && (
                                  <span style={{ padding: "2px 8px", borderRadius: 999, background: "#fef3c7", color: "#b45309", fontSize: 10.5, fontWeight: 800 }}>
                                    Ghi chú nội bộ (Ẩn với khách)
                                  </span>
                                )}
                              </div>

                              <div className={`hd-msg-bubble${isInternal ? " is-internal" : isTech ? " is-tech" : ""}`}>
                                {normalizeTicketText(message.message) || "Khách hàng đã gửi tệp đính kèm."}
                                {attachmentMentions.length > 0 && (
                                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                                    {attachmentMentions.map((att) => {
                                      const fileUrl = getAttachmentUrl(att);
                                      return (
                                        <div key={att.id} className="hd-att-item">
                                          <TicketAttachmentPreview attachment={att} compact />
                                          <div style={{ minWidth: 0 }}>
                                            <strong style={{ display: "block", fontSize: 12.5, color: "#0f172a" }}>{att.name}</strong>
                                            <span style={{ fontSize: 11.5, color: "#64748b" }}>{att.sizeLabel || "Tệp đính kèm"}</span>
                                            {fileUrl && (
                                              <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
                                                <a href={fileUrl} target="_blank" rel="noreferrer" className="cat-warranty-chip" style={{ textDecoration: "none" }}>Xem</a>
                                                <button type="button" className="cat-warranty-chip" onClick={() => downloadAttachment(att)}>Tải xuống</button>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </article>
                          );
                        })
                      )}
                    </div>

                    {selectedTicketResolved.status !== "CLOSED" ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
                        <div className="cat-warranty-presets" style={{ marginTop: 0 }}>
                          {TICKET_REPLY_TEMPLATES.map((text) => (
                            <button key={text} type="button" className="cat-warranty-chip" onClick={() => setReplyMessage(text)}>
                              {text}
                            </button>
                          ))}
                        </div>

                        <div className="hd-reply-grid">
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            <textarea
                              ref={replyTextareaRef}
                              className="cat-input"
                              style={{ minHeight: 108, resize: "vertical", fontFamily: "inherit" }}
                              value={replyMessage}
                              onChange={(event) => setReplyMessage(event.target.value)}
                              placeholder={`Phản hồi khách hàng với tư cách ${techName}...`}
                              disabled={Boolean(actionLoading)}
                            />
                            <div className="hd-row-between">
                              <input
                                ref={replyFileInputRef}
                                type="file"
                                multiple
                                accept=".jpg,.jpeg,.png,.gif,.mp4,.webm,.mov,.pdf,image/*,video/*,application/pdf"
                                style={{ display: "none" }}
                                onChange={(event) => {
                                  const files = Array.from(event.target.files || []).slice(0, 5);
                                  setReplyFiles(files);
                                }}
                              />
                              <button
                                type="button"
                                className="ai-action-btn ai-action-btn--ghost"
                                onClick={() => replyFileInputRef.current?.click()}
                                disabled={Boolean(actionLoading)}
                              >
                                Đính kèm tệp {replyFiles.length > 0 ? `(${replyFiles.length})` : ""}
                              </button>
                              <button
                                type="button"
                                className="hd-btn hd-btn--primary"
                                onClick={handleSendReply}
                                disabled={(!replyMessage.trim() && replyFiles.length === 0) || actionLoading === "reply"}
                              >
                                {actionLoading === "reply" ? "Đang gửi..." : "Gửi phản hồi"}
                              </button>
                            </div>

                            {replyFiles.length > 0 && (
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                                {replyFiles.map((f) => (
                                  <span key={`${f.name}-${f.size}`} className="hd-pill hd-pill--info">{f.name}</span>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReplyFiles([]);
                                    if (replyFileInputRef.current) replyFileInputRef.current.value = "";
                                  }}
                                  style={{ border: "none", background: "transparent", color: "#dc2626", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                                >
                                  ✕ Xóa tệp
                                </button>
                              </div>
                            )}
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 12, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                            <div>
                              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>
                                Trạng thái
                              </label>
                              <select
                                className="hd-select"
                                value={selectedTicketResolved.status}
                                onChange={(event) => handleAction("status", { status: event.target.value })}
                                disabled={Boolean(actionLoading)}
                              >
                                {STATUS_OPTIONS.map((status) => (
                                  <option key={status} value={status}>{getTicketStatusMeta(status).label}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>
                                Độ ưu tiên
                              </label>
                              <select
                                className="hd-select"
                                value={selectedTicketResolved.priority}
                                onChange={(event) => handleAction("priority", { priority: event.target.value })}
                                disabled={Boolean(actionLoading)}
                              >
                                {PRIORITY_OPTIONS.map((priority) => (
                                  <option key={priority} value={priority}>{getTicketPriorityMeta(priority).label}</option>
                                ))}
                              </select>
                            </div>
                            <span style={{ fontSize: 11.5, color: "#64748b", lineHeight: 1.45 }}>
                              Thay đổi trạng thái hoặc ưu tiên sẽ đồng bộ tức thì vào Inbox.
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="hd-empty">Ticket đã đóng. Không thể gửi thêm phản hồi.</div>
                    )}
                  </section>
                </div>

                {/* ==================== RIGHT CONTEXT SIDEBAR ==================== */}
                <aside className="hd-col-stack">
                  <section className="hd-card">
                    <div className="hd-card-head">
                      <div>
                        <h3>Tệp Đính Kèm ({selectedTicketResolved.attachmentMentions.length})</h3>
                        <p>Ảnh chụp lỗi, video hoặc nhật ký do khách gửi.</p>
                      </div>
                    </div>
                    {selectedTicketResolved.attachmentMentions.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {selectedTicketResolved.attachmentMentions.map((att) => {
                          const fileUrl = getAttachmentUrl(att);
                          return (
                            <article key={att.id} className="hd-att-item">
                              <TicketAttachmentPreview attachment={att} />
                              <div style={{ minWidth: 0 }}>
                                <strong style={{ display: "block", fontSize: 12.5, color: "#0f172a", wordBreak: "break-word" }}>{att.name}</strong>
                                <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>
                                  {att.sizeLabel || "Không rõ dung lượng"}
                                </div>
                                {fileUrl && (
                                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                                    <a href={fileUrl} target="_blank" rel="noreferrer" className="cat-warranty-chip" style={{ textDecoration: "none" }}>Xem tệp</a>
                                    <button type="button" className="cat-warranty-chip" onClick={() => downloadAttachment(att)}>Tải xuống</button>
                                  </div>
                                )}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="hd-empty">Chưa có tệp đính kèm trong ticket này.</div>
                    )}
                  </section>

                  <section className="hd-card">
                    <div className="hd-card-head">
                      <div>
                        <h3>Ghi Chú Nội Bộ</h3>
                        <p>Đồng bộ hệ thống và ẩn hoàn toàn với khách hàng.</p>
                      </div>
                    </div>
                    <textarea
                      className="cat-input"
                      style={{ minHeight: 96, resize: "vertical", fontFamily: "inherit" }}
                      value={internalNotes[selectedTicketResolved.id] || ""}
                      onChange={(event) =>
                        setInternalNotes((prev) => ({
                          ...prev,
                          [selectedTicketResolved.id]: event.target.value
                        }))
                      }
                      placeholder="VD: Đã hướng dẫn khách cập nhật BIOS, chờ xác nhận lại..."
                    />
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        className="cat-btn-dark"
                        onClick={saveInternalNote}
                        disabled={Boolean(actionLoading)}
                      >
                        {actionLoading === "internal_note" ? "Đang lưu..." : "Lưu ghi chú nội bộ"}
                      </button>
                    </div>
                  </section>

                  <section className="hd-card">
                    <div className="hd-card-head">
                      <div>
                        <h3>Lịch Sử Xử Lý</h3>
                        <p>Dòng thời gian cập nhật của ticket.</p>
                      </div>
                    </div>
                    <div className="hd-activity-list">
                      {activityFeed.map((event) => (
                        <article key={event.id} className="hd-activity-item">
                          <div className="hd-activity-dot" />
                          <div>
                            <strong style={{ display: "block", fontSize: 13, color: "#0f172a" }}>{event.label}</strong>
                            <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>
                              {event.helper} · {formatDateTime(event.timestamp)}
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>

                  <section className="hd-card">
                    <div className="hd-card-head">
                      <div>
                        <h3>Liên Kết Bảo Hành</h3>
                        <p>Tự động trích xuất Serial / Mã bảo hành từ nội dung.</p>
                      </div>
                    </div>
                    {ticketContext.isWarrantyRelated ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                        <div className="hd-data-tile">
                          <span>Mã bảo hành</span>
                          <strong>{ticketContext.warrantyCode || "Chưa có trong nội dung"}</strong>
                        </div>
                        <div className="hd-data-tile">
                          <span>Serial Number</span>
                          <strong>{ticketContext.serial || "Chưa có trong nội dung"}</strong>
                        </div>
                        <div className="hd-data-tile">
                          <span>Mã đơn hàng</span>
                          <strong>{ticketContext.orderCode || "Chưa có trong nội dung"}</strong>
                        </div>
                        <Link to="/tech/warranties" className="ai-action-btn ai-action-btn--ghost" style={{ justifyContent: "center", textDecoration: "none" }}>
                          Mở hồ sơ bảo hành ↗
                        </Link>
                      </div>
                    ) : (
                      <div className="hd-empty">Ticket hiện không chứa dữ liệu Serial hoặc bảo hành liên kết.</div>
                    )}
                  </section>
                </aside>
              </div>
            </>
          )}
        </main>
      </div>

      {/* ==================== OBSIDIAN CLOSE TICKET MODAL ==================== */}
      {showCloseModal ? (
        <div className="ai-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="tech-close-ticket-title" onClick={() => setShowCloseModal(false)}>
          <div className="ai-chunk-modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="ai-chunk-modal-head">
              <div>
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 9px", borderRadius: 999, background: "rgba(248,113,113,0.2)", color: "#fca5a5", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  Kết thúc hỗ trợ
                </span>
                <h3 id="tech-close-ticket-title" style={{ margin: "6px 0 0", fontSize: 18, fontWeight: 800, color: "#ffffff" }}>
                  Đóng Ticket #{selectedTicketResolved?.id}?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCloseModal(false)}
                style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.1)", color: "#e2e8f0", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ margin: 0, fontSize: 13.5, color: "#475569", lineHeight: 1.6 }}>
                Ticket sẽ chuyển sang trạng thái <strong>Đã đóng</strong> và khóa khung hội thoại để khách hàng không thể gửi thêm tin nhắn mới.
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="cat-btn-clear" onClick={() => setShowCloseModal(false)}>
                  Quay lại
                </button>
                <button
                  type="button"
                  className="hd-btn hd-btn--danger-solid"
                  onClick={() => {
                    setShowCloseModal(false);
                    handleAction("close", { status: "CLOSED" });
                  }}
                >
                  Xác nhận đóng ticket
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
