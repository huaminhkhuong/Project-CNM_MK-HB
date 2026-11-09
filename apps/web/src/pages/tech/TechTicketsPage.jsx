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

const STORAGE_SELECTED_TICKET = "pcmall_tech_selected_ticket";
const STORAGE_INTERNAL_NOTES = "pcmall_tech_internal_notes";

const STATUS_OPTIONS = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
const PRIORITY_OPTIONS = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const SCOPE_OPTIONS = [
  { value: "UNASSIGNED", label: "Chưa giao" },
  { value: "ASSIGNED", label: "Ticket của tôi" },
  { value: "ALL", label: "Tất cả ticket" }
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
    return <div className="tech-ticket-attachment__icon">FILE</div>;
  }

  if (isImageAttachment(attachment)) {
    return (
      <a className={`tech-ticket-attachment__preview${compact ? " tech-ticket-attachment__preview--compact" : ""}`} href={fileUrl} target="_blank" rel="noreferrer">
        <img src={fileUrl} alt={attachment.name} loading="lazy" />
      </a>
    );
  }

  if (isVideoAttachment(attachment)) {
    return (
      <a className={`tech-ticket-attachment__preview${compact ? " tech-ticket-attachment__preview--compact" : ""}`} href={fileUrl} target="_blank" rel="noreferrer">
        <video src={fileUrl} muted preload="metadata" />
      </a>
    );
  }

  return <a className="tech-ticket-attachment__icon" href={fileUrl} target="_blank" rel="noreferrer">FILE</a>;
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
  return {
    URGENT: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1
  }[String(priority || "").toUpperCase()] || 0;
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

  const currentKey = status === "CLOSED"
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
    { key: "NEW", label: "Mới", helper: "Ticket vừa được tạo", timestamp: stageTimestamps.NEW },
    { key: "RECEIVED", label: "Đã tiếp nhận", helper: ticket?.assignee?.fullName || "Chưa có kỹ thuật nhận", timestamp: stageTimestamps.RECEIVED },
    { key: "IN_PROGRESS", label: "Đang xử lý", helper: "Đang kiểm tra và phản hồi", timestamp: stageTimestamps.IN_PROGRESS },
    { key: "WAITING_CUSTOMER", label: "Chờ khách phản hồi", helper: "Đã gửi hướng dẫn cho khách", timestamp: stageTimestamps.WAITING_CUSTOMER },
    { key: "RESOLVED", label: "Đã giải quyết", helper: "Đã có kết quả xử lý", timestamp: stageTimestamps.RESOLVED },
    { key: "CLOSED", label: "Đóng ticket", helper: "Kết thúc hội thoại", timestamp: stageTimestamps.CLOSED }
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
    <div className="tech-ticket-skeleton-list">
      {Array.from({ length: 6 }).map((_, index) => (
        <article key={index} className="tech-ticket-skeleton-card">
          <div className="tech-ticket-skeleton-card__line tech-ticket-skeleton-card__line--short" />
          <div className="tech-ticket-skeleton-card__line" />
          <div className="tech-ticket-skeleton-card__line" />
          <div className="tech-ticket-skeleton-card__line tech-ticket-skeleton-card__line--tiny" />
        </article>
      ))}
    </div>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className="tech-ticket-workspace-skeleton">
      <div className="tech-ticket-workspace-skeleton__hero" />
      <div className="tech-ticket-workspace-skeleton__grid">
        <div className="tech-ticket-workspace-skeleton__panel" />
        <div className="tech-ticket-workspace-skeleton__panel" />
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

      return {
        ...ticket,
        attachmentMentions,
        waitingCustomer,
        needsTechAttention
      };
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

  // 🔌 Socket.io: Đăng ký nhận thông báo real-time cho kỹ thuật viên
  useEffect(() => {
    joinRoom("join_tech_queue");

    // Ticket mới được tạo → cập nhật danh sách
    const unsubNewTicket = on("tickets:new_ticket", (newTicket) => {
      setTickets((prev) => {
        const exists = prev.some((t) => Number(t.id) === Number(newTicket.id));
        if (exists) return prev;
        return [newTicket, ...prev];
      });
      loadStats();
    });

    // Trạng thái / tin nhắn ticket thay đổi → cập nhật trong danh sách
    const unsubQueueUpdated = on("tickets:queue_updated", ({ ticketId, status }) => {
      setTickets((prev) =>
        prev.map((t) =>
          Number(t.id) === Number(ticketId) ? { ...t, status: status || t.status } : t
        )
      );
      if (ticketId) {
        getTicketDetail(ticketId)
          .then((response) => {
            const detail = getEnvelopeData(response, null);
            if (!detail) return;
            setTickets((prev) =>
              prev.map((t) => (Number(t.id) === Number(ticketId) ? { ...t, ...detail } : t))
            );
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

  // 🔌 Socket.io: Lắng nghe cập nhật real-time khi đang xem chi tiết ticket
  useEffect(() => {
    if (!selectedTicketId) return undefined;

    joinRoom("join_ticket", selectedTicketId);

    // Tin nhắn mới trong ticket → cập nhật ngay
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

    // Trạng thái ticket thay đổi → cập nhật selectedTicket
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
      attachmentMentions: [
        ...new Map((mergedTicket.attachmentMentions || []).map((attachment) => [attachment.id, attachment])).values()
      ]
    };
  }, [normalizedTickets, selectedTicket]);

  const selectedStatusMeta = getTicketStatusMeta(selectedTicketResolved?.status);
  const selectedPriorityMeta = getTicketPriorityMeta(selectedTicketResolved?.priority);
  const canAssignSelf = selectedTicketResolved && !selectedTicketResolved.assignedToId;
  const isMine = Number(selectedTicketResolved?.assignedToId) === Number(currentUserId);
  const stageSteps = useMemo(() => buildTicketStageState(selectedTicketResolved), [selectedTicketResolved]);
  const activityFeed = useMemo(() => buildActivityFeed(selectedTicketResolved), [selectedTicketResolved]);
  const ticketContext = useMemo(() => extractTicketContext(selectedTicketResolved), [selectedTicketResolved]);

  const statsCards = useMemo(() => {
    const waitingCustomer = normalizedTickets.filter((ticket) => ticket.waitingCustomer).length;
    const resolvedToday = normalizedTickets.filter(
      (ticket) => ["RESOLVED", "CLOSED"].includes(String(ticket.status || "").toUpperCase()) && isToday(ticket.updatedAt)
    ).length;

    return [
      {
        label: "Ticket mới",
        value: stats?.open ?? normalizedTickets.filter((ticket) => ticket.status === "OPEN").length,
        tone: "info",
        icon: "✦",
        helper: "Ưu tiên tiếp nhận"
      },
      {
        label: "Đang xử lý",
        value: stats?.inProgress ?? normalizedTickets.filter((ticket) => ticket.status === "IN_PROGRESS").length,
        tone: "warning",
        icon: "⌘",
        helper: "Đội kỹ thuật đang làm"
      },
      {
        label: "Chờ phản hồi khách",
        value: waitingCustomer,
        tone: "neutral",
        icon: "↺",
        helper: "Đã gửi hướng dẫn"
      },
      {
        label: "Đã giải quyết hôm nay",
        value: resolvedToday,
        tone: "success",
        icon: "✓",
        helper: "Hoàn tất trong ngày"
      }
    ];
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
        const newestTicket = [...newTickets].sort((a, b) => {
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        })[0];
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
        response = await addTicketMessage(selectedTicketResolved.id, {
          message: data,
          attachments: replyFiles,
          visibility: "PUBLIC"
        });
        setReplyMessage("");
        setReplyFiles([]);
        if (replyFileInputRef.current) replyFileInputRef.current.value = "";
      } else if (type === "internal_note") {
        response = await addTicketMessage(selectedTicketResolved.id, {
          message: data,
          visibility: "INTERNAL"
        });
        setInternalNotes((prev) => ({
          ...prev,
          [selectedTicketResolved.id]: ""
        }));
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
            : "Đã cập nhật ticket."
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
    <div className="tech-ticket-center">
      <style>{`
        .tech-ticket-center { display: grid; gap: 24px; }
        .tech-ticket-center .tech-page-head { align-items: center; }
        .tech-ticket-center .tech-page-head h1 { font-size: 34px; letter-spacing: 0; }
        .tech-ticket-center .tech-page-head p { max-width: 860px; }
        .tech-ticket-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
        .tech-ticket-stat { padding: 20px; border-radius: 22px; background: #ffffff; border: 1px solid #e7def7; box-shadow: 0 18px 42px rgba(88, 28, 135, 0.06); display: grid; gap: 10px; }
        .tech-ticket-stat__top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .tech-ticket-stat__icon { width: 42px; height: 42px; border-radius: 14px; display: grid; place-items: center; font-size: 18px; font-weight: 900; }
        .tech-ticket-stat__icon--info { background: #eef2ff; color: #4f46e5; }
        .tech-ticket-stat__icon--warning { background: #fff7ed; color: #c2410c; }
        .tech-ticket-stat__icon--neutral { background: #f5f3ff; color: #7c3aed; }
        .tech-ticket-stat__icon--success { background: #ecfdf5; color: #047857; }
        .tech-ticket-stat span { color: #6b6280; font-size: 13px; font-weight: 800; }
        .tech-ticket-stat strong { color: #1a1625; font-size: 32px; line-height: 1; }
        .tech-ticket-stat small { color: #8b7fa4; line-height: 1.45; }
        .tech-ticket-workspace { display: grid; grid-template-columns: 360px minmax(0, 1fr); gap: 24px; align-items: start; }
        .tech-ticket-inbox, .tech-ticket-canvas, .tech-ticket-card { background: #ffffff; border: 1px solid #e7def7; border-radius: 24px; box-shadow: 0 18px 42px rgba(88, 28, 135, 0.06); }
        .tech-ticket-inbox { position: sticky; top: 88px; overflow: hidden; }
        .tech-ticket-inbox__head { padding: 22px 22px 18px; border-bottom: 1px solid #f0e9fb; }
        .tech-ticket-inbox__head h2, .tech-ticket-section__title h3 { margin: 0; font-size: 18px; color: #1a1625; }
        .tech-ticket-inbox__head p, .tech-ticket-section__title p, .tech-ticket-muted { margin: 6px 0 0; color: #7a718e; line-height: 1.55; }
        .tech-ticket-filters { padding: 18px 22px; display: grid; gap: 12px; border-bottom: 1px solid #f0e9fb; }
        .tech-ticket-field, .tech-ticket-select, .tech-ticket-textarea { width: 100%; min-height: 46px; padding: 0 14px; border-radius: 14px; border: 1px solid #dcd3ee; background: #fbfaff; color: #1a1625; }
        .tech-ticket-textarea { min-height: 120px; padding: 14px; resize: vertical; }
        .tech-ticket-filter-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .tech-ticket-tabs { display: flex; gap: 8px; flex-wrap: wrap; }
        .tech-ticket-tab { min-height: 34px; padding: 0 12px; border-radius: 999px; border: 1px solid #e7def7; background: #ffffff; color: #6b6280; font-size: 12px; font-weight: 900; cursor: pointer; }
        .tech-ticket-tab.is-active { background: #f3e8ff; border-color: #c4b5fd; color: #7c3aed; }
        .tech-ticket-list { max-height: calc(100vh - 320px); overflow-y: auto; display: grid; gap: 10px; padding: 16px; }
        .tech-ticket-inbox-item { width: 100%; padding: 16px; border-radius: 18px; border: 1px solid #ede5fb; background: #ffffff; display: grid; gap: 10px; text-align: left; cursor: pointer; transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
        .tech-ticket-inbox-item:hover { transform: translateY(-1px); border-color: #c4b5fd; box-shadow: 0 14px 30px rgba(76, 29, 149, 0.09); }
        .tech-ticket-inbox-item--active { border-color: #8b5cf6; background: linear-gradient(180deg, #ffffff 0%, #faf5ff 100%); box-shadow: 0 18px 34px rgba(124, 58, 237, 0.12); }
        .tech-ticket-inbox-item__top, .tech-ticket-inline { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
        .tech-ticket-id { font-size: 12px; font-weight: 900; color: #7c3aed; letter-spacing: 0.05em; text-transform: uppercase; }
        .tech-ticket-title { font-size: 16px; line-height: 1.45; font-weight: 900; color: #1a1625; }
        .tech-ticket-sub { font-size: 13px; color: #7a718e; }
        .tech-ticket-pill, .tech-ticket-badge, .tech-ticket-priority { display: inline-flex; align-items: center; justify-content: center; min-height: 28px; padding: 0 10px; border-radius: 999px; font-size: 12px; font-weight: 900; }
        .tech-ticket-badge { background: #eef2ff; color: #4338ca; }
        .tech-ticket-badge--warn { background: #fff7ed; color: #c2410c; }
        .tech-ticket-badge--danger { background: #fef2f2; color: #b91c1c; }
        .tech-ticket-pill--info { background: #eef2ff; color: #4338ca; }
        .tech-ticket-pill--warning { background: #fff7ed; color: #c2410c; }
        .tech-ticket-pill--success { background: #ecfdf5; color: #047857; }
        .tech-ticket-pill--neutral { background: #f5f3ff; color: #6d28d9; }
        .tech-ticket-priority--danger { color: #b91c1c; background: #fef2f2; }
        .tech-ticket-priority--warning { color: #c2410c; background: #fff7ed; }
        .tech-ticket-priority--info { color: #1d4ed8; background: #eff6ff; }
        .tech-ticket-priority--neutral { color: #64748b; background: #f8fafc; }
        .tech-ticket-canvas { padding: 24px; display: grid; gap: 18px; }
        .tech-ticket-detail-head { padding: 24px; border-radius: 22px; background: linear-gradient(135deg, #1e1b4b 0%, #7c3aed 100%); color: #ffffff; display: grid; gap: 18px; }
        .tech-ticket-detail-head__top { display: flex; justify-content: space-between; gap: 18px; flex-wrap: wrap; align-items: flex-start; }
        .tech-ticket-detail-head__top h2 { margin: 8px 0 0; font-size: 30px; line-height: 1.08; letter-spacing: 0; }
        .tech-ticket-detail-head__top p { margin: 8px 0 0; color: rgba(255,255,255,0.82); line-height: 1.6; }
        .tech-ticket-meta-cluster { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
        .tech-ticket-detail-actions { display: flex; flex-wrap: wrap; gap: 10px; }
        .tech-ticket-btn { min-height: 42px; padding: 0 14px; border-radius: 12px; border: 1px solid transparent; cursor: pointer; font-weight: 900; display: inline-flex; align-items: center; justify-content: center; gap: 8px; transition: transform .18s ease, box-shadow .18s ease, opacity .18s ease; }
        .tech-ticket-btn:hover:not(:disabled) { transform: translateY(-1px); }
        .tech-ticket-btn:disabled { opacity: .55; cursor: not-allowed; }
        .tech-ticket-btn__spinner { width: 15px; height: 15px; border-radius: 999px; border: 2px solid currentColor; border-right-color: transparent; animation: techTicketSpin .75s linear infinite; }
        .tech-ticket-btn--primary { color: #fff; background: linear-gradient(135deg, #2563eb, #1d4ed8); box-shadow: 0 10px 22px rgba(37, 99, 235, 0.18); }
        .tech-ticket-btn--secondary { color: #1a1625; background: #ffffff; border-color: #ddd6fe; }
        .tech-ticket-btn--ghost { color: #fff; background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.18); }
        .tech-ticket-btn--danger { color: #fff; background: linear-gradient(135deg, #dc2626, #b91c1c); box-shadow: 0 10px 22px rgba(220, 38, 38, 0.18); }
        .tech-ticket-progress { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; }
        .tech-ticket-progress-step { position: relative; overflow: hidden; padding: 14px 12px; border-radius: 16px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.16); display: grid; gap: 8px; min-height: 118px; color: rgba(255,255,255,0.88); transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease, background .18s ease; }
        .tech-ticket-progress-step::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: rgba(255,255,255,0.18); transition: background .18s ease; }
        .tech-ticket-progress-step > * { position: relative; z-index: 1; }
        .tech-ticket-progress-step__top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .tech-ticket-progress-step__icon { width: 30px; height: 30px; border-radius: 999px; display: grid; place-items: center; font-weight: 950; background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.22); color: rgba(255,255,255,0.86); }
        .tech-ticket-progress-step__state { padding: 4px 8px; border-radius: 999px; font-size: 10px; font-weight: 950; letter-spacing: .04em; text-transform: uppercase; background: rgba(255,255,255,0.12); color: rgba(255,255,255,0.76); white-space: nowrap; }
        .tech-ticket-progress-step strong { font-size: 14px; line-height: 1.25; }
        .tech-ticket-progress-step span, .tech-ticket-progress-step small { color: rgba(255,255,255,0.78); line-height: 1.4; }
        .tech-ticket-progress-step--completed { background: rgba(255,255,255,0.14); border-color: rgba(167,243,208,0.5); }
        .tech-ticket-progress-step--completed::before { background: #34d399; }
        .tech-ticket-progress-step--completed .tech-ticket-progress-step__icon { background: #dcfce7; color: #047857; border-color: rgba(255,255,255,0.76); }
        .tech-ticket-progress-step--completed .tech-ticket-progress-step__state { background: rgba(220,252,231,0.95); color: #047857; }
        .tech-ticket-progress-step--current { transform: translateY(-1px); background: rgba(37,99,235,0.2); border-color: rgba(147,197,253,0.9); box-shadow: 0 12px 28px rgba(37,99,235,0.18); }
        .tech-ticket-progress-step--current::before { background: #60a5fa; }
        .tech-ticket-progress-step--current .tech-ticket-progress-step__icon { background: #ffffff; color: #2563eb; border-color: rgba(255,255,255,0.88); }
        .tech-ticket-progress-step--current .tech-ticket-progress-step__state { background: #eff6ff; color: #1d4ed8; }
        .tech-ticket-progress-step--pending { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.12); opacity: .72; }
        .tech-ticket-progress-step--pending .tech-ticket-progress-step__icon { color: rgba(255,255,255,0.66); }
        .tech-ticket-grid { display: grid; grid-template-columns: minmax(0, 1.15fr) 340px; gap: 18px; align-items: start; }
        .tech-ticket-stack { display: grid; gap: 18px; }
        .tech-ticket-card { padding: 20px; }
        .tech-ticket-section__title { display: flex; justify-content: space-between; gap: 12px; align-items: start; margin-bottom: 14px; }
        .tech-ticket-rich-text { color: #433b55; line-height: 1.7; }
        .tech-ticket-rich-text--soft { color: #7a718e; }
        .tech-ticket-data-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .tech-ticket-data-card { padding: 14px 16px; border-radius: 16px; background: #faf8ff; border: 1px solid #eee6fb; display: grid; gap: 6px; }
        .tech-ticket-data-card span { font-size: 12px; font-weight: 900; letter-spacing: .04em; text-transform: uppercase; color: #7a718e; }
        .tech-ticket-data-card strong { color: #1a1625; line-height: 1.5; }
        .tech-ticket-attachments { display: grid; gap: 12px; }
        .tech-ticket-attachment { padding: 14px 16px; border-radius: 16px; background: #faf8ff; border: 1px solid #eee6fb; display: flex; gap: 12px; align-items: center; }
        .tech-ticket-attachment__icon { width: 56px; height: 56px; flex: 0 0 56px; border-radius: 14px; display: grid; place-items: center; background: #ede9fe; color: #6d28d9; font-weight: 900; text-decoration: none; }
        .tech-ticket-attachment__preview { width: 72px; height: 72px; flex: 0 0 72px; border-radius: 16px; overflow: hidden; border: 1px solid #e4dcfb; background: #fff; display: block; box-shadow: 0 10px 24px rgba(109,40,217,0.12); }
        .tech-ticket-attachment__preview--compact { width: 44px; height: 44px; flex-basis: 44px; border-radius: 12px; box-shadow: none; }
        .tech-ticket-attachment__preview img,
        .tech-ticket-attachment__preview video { width: 100%; height: 100%; object-fit: cover; display: block; }
        .tech-ticket-attachment__actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
        .tech-ticket-attachment__actions a, .tech-ticket-attachment__actions button { padding: 7px 10px; border-radius: 999px; background: #fff; border: 1px solid #ddd6fe; color: #5b21b6; font-size: 12px; font-family: inherit; font-weight: 900; text-decoration: none; cursor: pointer; }
        .tech-ticket-thread { display: grid; gap: 14px; }
        .tech-ticket-thread__meta { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .tech-ticket-messages { max-height: 440px; overflow-y: auto; display: grid; gap: 12px; padding-right: 4px; }
        .tech-ticket-message-row { display: grid; gap: 6px; justify-items: start; }
        .tech-ticket-message-row--tech { justify-items: end; }
        .tech-ticket-message-meta { font-size: 12px; color: #7a718e; font-weight: 800; }
        .tech-ticket-message-bubble { max-width: min(78%, 680px); padding: 14px 16px; border-radius: 18px; background: #f8f5ff; border: 1px solid #ede5fb; color: #31293f; line-height: 1.65; white-space: pre-wrap; }
        .tech-ticket-message-bubble--tech { background: linear-gradient(135deg, #ede9fe, #eff6ff); border-color: #c7d2fe; }
        .tech-ticket-quick-replies { display: flex; gap: 8px; flex-wrap: wrap; }
        .tech-ticket-quick-reply { padding: 8px 12px; border-radius: 999px; border: 1px solid #e6def5; background: #faf8ff; color: #5c5470; font-size: 12px; font-weight: 800; cursor: pointer; }
        .tech-ticket-quick-reply:hover { border-color: #c4b5fd; color: #7c3aed; background: #f5f3ff; }
        .tech-ticket-reply-grid { display: grid; grid-template-columns: 1fr 220px; gap: 14px; align-items: start; }
        .tech-ticket-reply-sidebar { display: grid; gap: 12px; }
        .tech-ticket-status-selects { display: grid; gap: 10px; }
        .tech-ticket-empty { padding: 34px; border-radius: 20px; background: #faf8ff; border: 1px dashed #d8ccf1; color: #7a718e; text-align: center; }
        .tech-ticket-empty__icon { width: 68px; height: 68px; margin: 0 auto 12px; border-radius: 20px; display: grid; place-items: center; background: #f3e8ff; color: #7c3aed; font-size: 26px; }
        .tech-ticket-side-stack { display: grid; gap: 18px; }
        .tech-ticket-activity { display: grid; gap: 12px; }
        .tech-ticket-activity-item { display: grid; grid-template-columns: 14px minmax(0, 1fr); gap: 12px; align-items: start; }
        .tech-ticket-activity-dot { width: 12px; height: 12px; margin-top: 5px; border-radius: 999px; background: linear-gradient(135deg, #7c3aed, #2563eb); box-shadow: 0 0 0 5px #f3e8ff; }
        .tech-ticket-note-caption { font-size: 12px; color: #8b7fa4; line-height: 1.5; }
        .tech-ticket-modal { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.48); display: grid; place-items: center; padding: 20px; z-index: 80; }
        .tech-ticket-modal__panel { width: min(420px, 100%); padding: 22px; border-radius: 22px; background: #fff; border: 1px solid #ece3fb; box-shadow: 0 28px 60px rgba(15, 23, 42, 0.22); display: grid; gap: 12px; }
        .tech-ticket-modal__panel h3 { margin: 0; font-size: 22px; color: #1a1625; }
        .tech-ticket-modal__panel p { margin: 0; color: #6b6280; line-height: 1.65; }
        .tech-ticket-modal__actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 6px; }
        .tech-ticket-skeleton-list, .tech-ticket-workspace-skeleton { display: grid; gap: 12px; }
        .tech-ticket-skeleton-card, .tech-ticket-workspace-skeleton__hero, .tech-ticket-workspace-skeleton__panel { border-radius: 18px; background: linear-gradient(90deg, #f4effb 25%, #fbf8ff 50%, #f4effb 75%); background-size: 240px 100%; animation: techTicketShimmer 1.3s linear infinite; }
        .tech-ticket-skeleton-card { padding: 16px; min-height: 138px; border: 1px solid #efe7fb; }
        .tech-ticket-skeleton-card__line { height: 12px; border-radius: 999px; background: rgba(255,255,255,0.7); margin-top: 10px; }
        .tech-ticket-skeleton-card__line--short { width: 42%; margin-top: 0; }
        .tech-ticket-skeleton-card__line--tiny { width: 28%; }
        .tech-ticket-workspace-skeleton__hero { min-height: 240px; }
        .tech-ticket-workspace-skeleton__grid { display: grid; grid-template-columns: 1.15fr .85fr; gap: 18px; }
        .tech-ticket-workspace-skeleton__panel { min-height: 320px; }
        @keyframes techTicketShimmer { 0% { background-position: -240px 0; } 100% { background-position: calc(100% + 240px) 0; } }
        @keyframes techTicketSpin { to { transform: rotate(360deg); } }
        @media (max-width: 1280px) {
          .tech-ticket-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .tech-ticket-workspace { grid-template-columns: 320px minmax(0, 1fr); }
          .tech-ticket-grid { grid-template-columns: 1fr; }
          .tech-ticket-progress { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .tech-ticket-reply-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 1080px) {
          .tech-ticket-workspace { grid-template-columns: 1fr; }
          .tech-ticket-inbox { position: static; }
          .tech-ticket-list { max-height: 520px; }
          .tech-ticket-workspace-skeleton__grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 768px) {
          .tech-ticket-stats, .tech-ticket-filter-grid, .tech-ticket-data-grid, .tech-ticket-modal__actions, .tech-ticket-progress { grid-template-columns: 1fr; }
          .tech-ticket-detail-head, .tech-ticket-card, .tech-ticket-canvas, .tech-ticket-inbox__head, .tech-ticket-filters { padding-left: 16px; padding-right: 16px; }
          .tech-ticket-detail-head__top h2 { font-size: 24px; }
          .tech-ticket-message-bubble { max-width: 100%; }
        }
      `}</style>

      <section className="tech-page-head">
        <div>
          <p className="tech-eyebrow">Nhân viên kỹ thuật</p>
          <h1>Ticket Center / Helpdesk</h1>
          <p>Theo dõi inbox kỹ thuật, tiếp nhận ticket, phản hồi khách hàng và cập nhật tiến độ xử lý trên cùng một workspace.</p>
        </div>
        <div className="tech-head-actions">
          <button
            type="button"
            className="tech-ticket-btn tech-ticket-btn--secondary"
            onClick={refreshAll}
            disabled={Boolean(actionLoading) || refreshing}
          >
            {refreshing ? (
              <>
                <span className="tech-ticket-btn__spinner" />
                Đang cập nhật...
              </>
            ) : (
              "Làm mới"
            )}
          </button>
          <Link to="/tech/compatibility" className="tech-ticket-btn tech-ticket-btn--secondary">
            Luật tương thích
          </Link>
        </div>
      </section>

      <section className="tech-ticket-stats" aria-label="Thống kê ticket kỹ thuật">
        {statsCards.map((card) => (
          <article key={card.label} className="tech-ticket-stat">
            <div className="tech-ticket-stat__top">
              <div>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
              </div>
              <div className={`tech-ticket-stat__icon tech-ticket-stat__icon--${card.tone}`}>{card.icon}</div>
            </div>
            <small>{card.helper}</small>
          </article>
        ))}
      </section>

      {errorMessage ? <div className="tech-alert tech-alert--error">{errorMessage}</div> : null}
      {successMessage ? <div className="tech-alert tech-alert--success">{successMessage}</div> : null}

      <div className="tech-ticket-workspace">
        <aside className="tech-ticket-inbox">
          <div className="tech-ticket-inbox__head">
            <h2>Inbox ticket</h2>
            <p>Chọn ticket để mở workspace kỹ thuật chi tiết.</p>
          </div>

          <div className="tech-ticket-filters">
            <input
              className="tech-ticket-field"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Tìm mã ticket, tiêu đề, khách hàng, email..."
              aria-label="Tìm ticket"
            />
            <div className="tech-ticket-filter-grid">
              <select className="tech-ticket-select" value={scope} onChange={(event) => setScope(event.target.value)} aria-label="Phạm vi ticket">
                {SCOPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select className="tech-ticket-select" value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Sắp xếp ticket">
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="tech-ticket-filter-grid">
              <select className="tech-ticket-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Lọc trạng thái">
                <option value="">Tất cả trạng thái</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {getTicketStatusMeta(status).label}
                  </option>
                ))}
              </select>
              <select className="tech-ticket-select" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} aria-label="Lọc ưu tiên">
                <option value="">Tất cả ưu tiên</option>
                {PRIORITY_OPTIONS.map((priority) => (
                  <option key={priority} value={priority}>
                    {getTicketPriorityMeta(priority).label}
                  </option>
                ))}
              </select>
            </div>
            <div className="tech-ticket-tabs" role="tablist" aria-label="Quick filters">
              {[
                { value: "", label: "Tất cả" },
                { value: "OPEN", label: "Mới" },
                { value: "IN_PROGRESS", label: "Đang xử lý" },
                { value: "RESOLVED", label: "Đã giải quyết" }
              ].map((tab) => (
                <button
                  key={tab.value || "all"}
                  type="button"
                  className={`tech-ticket-tab${statusFilter === tab.value ? " is-active" : ""}`}
                  onClick={() => setStatusFilter(tab.value)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="tech-ticket-list">
            {loading ? (
              <TicketListSkeleton />
            ) : visibleTickets.length === 0 ? (
              <div className="tech-ticket-empty">
                <div className="tech-ticket-empty__icon">⌂</div>
                Không có ticket phù hợp với bộ lọc hiện tại.
              </div>
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
                    className={`tech-ticket-inbox-item${isActive ? " tech-ticket-inbox-item--active" : ""}`}
                    onClick={() => setSelectedTicketId(ticket.id)}
                  >
                    <div className="tech-ticket-inbox-item__top">
                      <span className="tech-ticket-id">#{ticket.id}</span>
                      <div className="tech-ticket-inline">
                        {ticket.attachmentMentions.length ? <span className="tech-ticket-badge">{ticket.attachmentMentions.length} tệp</span> : null}
                        {ticket.needsTechAttention ? <span className="tech-ticket-badge tech-ticket-badge--warn">Tin nhắn mới</span> : null}
                        <span className={`tech-ticket-priority tech-ticket-priority--${priorityMeta.tone}`}>{priorityMeta.label}</span>
                      </div>
                    </div>
                    <div className="tech-ticket-title">{normalizeTicketText(ticket.title)}</div>
                    <div className="tech-ticket-sub">{ticket.reporter?.fullName || ticket.reporter?.email || "Khách hàng"}</div>
                    <div className="tech-ticket-inline">
                      <span className={`tech-ticket-pill tech-ticket-pill--${statusMeta.tone}`}>{statusMeta.label}</span>
                      <span className="tech-ticket-sub">{formatDateTime(lastMessage?.createdAt || ticket.createdAt)}</span>
                    </div>
                    <div className="tech-ticket-sub">
                      {ticket.assignee?.fullName ? `Phụ trách: ${ticket.assignee.fullName}` : "Chưa có kỹ thuật nhận xử lý"}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <main className="tech-ticket-canvas">
          {detailLoading ? (
            <WorkspaceSkeleton />
          ) : !selectedTicketResolved ? (
            <div className="tech-ticket-empty">
              <div className="tech-ticket-empty__icon">🎫</div>
              Chọn một ticket từ inbox để mở workspace xử lý.
            </div>
          ) : (
            <>
              <section className="tech-ticket-detail-head">
                <div className="tech-ticket-detail-head__top">
                  <div>
                    <div className="tech-ticket-meta-cluster">
                      <span className={`tech-ticket-pill tech-ticket-pill--${selectedStatusMeta.tone}`}>{selectedStatusMeta.label}</span>
                      <span className={`tech-ticket-priority tech-ticket-priority--${selectedPriorityMeta.tone}`}>{selectedPriorityMeta.label}</span>
                      <span className="tech-ticket-pill tech-ticket-pill--neutral">
                        {selectedTicketResolved.assignee?.fullName ? `Phụ trách: ${selectedTicketResolved.assignee.fullName}` : "Chưa có kỹ thuật nhận"}
                      </span>
                    </div>
                    <h2>{normalizeTicketText(selectedTicketResolved.title)}</h2>
                    <p>
                      Ticket #{selectedTicketResolved.id} · tạo lúc {formatDateTime(selectedTicketResolved.createdAt)} · cập nhật {formatDateTime(selectedTicketResolved.updatedAt)}
                    </p>
                  </div>
                  <div className="tech-ticket-detail-actions">
                    <button
                      type="button"
                      className="tech-ticket-btn tech-ticket-btn--ghost"
                      onClick={handleAssignToMe}
                      disabled={!canAssignSelf || Boolean(actionLoading)}
                      title={canAssignSelf ? "Nhận ticket này để xử lý" : "Ticket đã có người nhận hoặc không hợp lệ"}
                    >
                      Nhận xử lý
                    </button>
                    <button
                      type="button"
                      className="tech-ticket-btn tech-ticket-btn--ghost"
                      onClick={setNeedMoreInfoTemplate}
                      disabled={selectedTicketResolved.status === "CLOSED"}
                      title="Chèn nhanh phản hồi cần thêm thông tin"
                    >
                      Cần thêm thông tin
                    </button>
                    <button
                      type="button"
                      className="tech-ticket-btn tech-ticket-btn--ghost"
                      onClick={() => replyTextareaRef.current?.focus()}
                      disabled={selectedTicketResolved.status === "CLOSED"}
                      title="Chuyển nhanh xuống vùng hội thoại để phản hồi"
                    >
                      Gửi phản hồi
                    </button>
                    <button
                      type="button"
                      className="tech-ticket-btn tech-ticket-btn--primary"
                      onClick={handleResolve}
                      disabled={!isMine || ["RESOLVED", "CLOSED"].includes(selectedTicketResolved.status) || Boolean(actionLoading)}
                      title={isMine ? "Đánh dấu ticket đã xử lý xong" : "Chỉ kỹ thuật đang phụ trách mới có thể giải quyết ticket"}
                    >
                      Đã xử lý xong
                    </button>
                    <button
                      type="button"
                      className="tech-ticket-btn tech-ticket-btn--secondary"
                      onClick={handleTransferOrUnassign}
                      disabled={!selectedTicketResolved.assignedToId || selectedTicketResolved.status === "CLOSED" || Boolean(actionLoading)}
                      title={
                        !selectedTicketResolved.assignedToId
                          ? "Ticket đang ở hàng chờ chung"
                          : isMine
                            ? "Trả ticket về hàng chờ chung để kỹ thuật viên khác tiếp nhận"
                            : "Nhận tiếp quản ticket này từ kỹ thuật viên khác"
                      }
                    >
                      {isMine ? "Trả về hàng chờ" : "Nhận tiếp quản"}
                    </button>
                    <button
                      type="button"
                      className="tech-ticket-btn tech-ticket-btn--danger"
                      onClick={handleClose}
                      disabled={selectedTicketResolved.status === "CLOSED" || Boolean(actionLoading)}
                      title={selectedTicketResolved.status === "CLOSED" ? "Ticket đã đóng" : "Đóng ticket sau khi đã xử lý xong"}
                    >
                      Đóng ticket
                    </button>
                  </div>
                </div>

                <div className="tech-ticket-progress" aria-label="Trạng thái xử lý ticket">
                  {stageSteps.map((step, index) => {
                    const visualState = step.current ? "current" : step.active ? "completed" : "pending";
                    const stateLabel = step.current ? "Đang xử lý" : step.active ? "Hoàn tất" : "Chưa tới";
                    const stateIcon = step.current ? index + 1 : step.active ? "✓" : index + 1;

                    return (
                    <article
                      key={step.key}
                      className={`tech-ticket-progress-step tech-ticket-progress-step--${visualState}`}
                    >
                      <div className="tech-ticket-progress-step__top">
                        <span className="tech-ticket-progress-step__icon">{stateIcon}</span>
                        <span className="tech-ticket-progress-step__state">{stateLabel}</span>
                      </div>
                      <strong>{step.label}</strong>
                      <span>{step.helper}</span>
                      <small>{step.timestamp ? formatDateTime(step.timestamp) : "Chưa có mốc thời gian"}</small>
                    </article>
                    );
                  })}
                </div>
              </section>

              <div className="tech-ticket-grid">
                <div className="tech-ticket-stack">
                  <section className="tech-ticket-card">
                    <div className="tech-ticket-section__title">
                      <div>
                        <h3>Tóm tắt ticket</h3>
                        <p>Tầng thông tin chính để kỹ thuật nắm nhanh tình trạng và khách hàng liên quan.</p>
                      </div>
                    </div>

                    <div className="tech-ticket-data-grid">
                      <article className="tech-ticket-data-card">
                        <span>Khách hàng</span>
                        <strong>{selectedTicketResolved.reporter?.fullName || "Khách hàng"}</strong>
                      </article>
                      <article className="tech-ticket-data-card">
                        <span>Email liên hệ</span>
                        <strong>{selectedTicketResolved.reporter?.email || "Chưa có"}</strong>
                      </article>
                      <article className="tech-ticket-data-card">
                        <span>Người xử lý</span>
                        <strong>{selectedTicketResolved.assignee?.fullName || "Chưa phân công"}</strong>
                      </article>
                      <article className="tech-ticket-data-card">
                        <span>Mức ưu tiên</span>
                        <strong>{selectedPriorityMeta.label}</strong>
                      </article>
                    </div>
                  </section>

                  <section className="tech-ticket-card">
                    <div className="tech-ticket-section__title">
                      <div>
                        <h3>Mô tả lỗi</h3>
                        <p>Nội dung khách hàng gửi ban đầu và bối cảnh lỗi.</p>
                      </div>
                    </div>
                    <div className="tech-ticket-rich-text">
                      {normalizeTicketText(selectedTicketResolved.description) || "Khách hàng chưa mô tả chi tiết."}
                    </div>
                  </section>

                  <section className="tech-ticket-card">
                    <div className="tech-ticket-section__title">
                      <div>
                        <h3>Hội thoại hỗ trợ</h3>
                        <p>Phản hồi khách hàng ngay trong ticket, không reload toàn trang.</p>
                      </div>
                      <div className="tech-ticket-thread__meta">
                        <span className="tech-ticket-badge">
                          {selectedTicketResolved.messages?.length || 0} tin nhắn
                        </span>
                        {selectedTicketResolved.status === "CLOSED" ? <span className="tech-ticket-badge tech-ticket-badge--danger">Đã khóa hội thoại</span> : null}
                      </div>
                    </div>

                    <div className="tech-ticket-thread">
                      <div className="tech-ticket-messages" ref={messageListRef}>
                        {(selectedTicketResolved.messages || []).length === 0 ? (
                          <div className="tech-ticket-empty">Chưa có hội thoại phát sinh.</div>
                        ) : (
                          (selectedTicketResolved.messages || []).map((message) => {
                            const isTech = isTechSender(message.sender?.role);
                            const isInternal = String(message.visibility || "PUBLIC").toUpperCase() === "INTERNAL";
                            const attachmentMentions = extractAttachmentMentions(message.message);
                            return (
                              <article key={message.id} className={`tech-ticket-message-row${isTech ? " tech-ticket-message-row--tech" : ""}`}>
                                <div className="tech-ticket-message-meta">
                                  {message.sender?.fullName || message.sender?.email || "Người dùng"} · {formatTime(message.createdAt)}
                                  {isInternal ? (
                                    <span
                                      style={{
                                        marginLeft: 8,
                                        padding: "2px 8px",
                                        borderRadius: 999,
                                        background: "#fef3c7",
                                        color: "#b45309",
                                        fontSize: 11,
                                        fontWeight: 900
                                      }}
                                    >
                                      🔒 Ghi chú nội bộ (Khách không thấy)
                                    </span>
                                  ) : null}
                                </div>
                                <div
                                  className={`tech-ticket-message-bubble${isTech ? " tech-ticket-message-bubble--tech" : ""}`}
                                  style={
                                    isInternal
                                      ? {
                                          background: "#fffbeb",
                                          borderColor: "#fcd34d",
                                          color: "#78350f"
                                        }
                                      : undefined
                                  }
                                >
                                  {normalizeTicketText(message.message) || "Khách hàng đã gửi metadata tệp đính kèm."}
                                  {attachmentMentions.length ? (
                                    <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                                      {attachmentMentions.map((attachment) => {
                                        const fileUrl = getAttachmentUrl(attachment);
                                        return (
                                          <div key={attachment.id} className="tech-ticket-attachment">
                                            <TicketAttachmentPreview attachment={attachment} compact />
                                            <div style={{ minWidth: 0 }}>
                                              <strong style={{ display: "block", color: "#1a1625" }}>{attachment.name}</strong>
                                              <div className="tech-ticket-rich-text--soft">
                                                {attachment.sizeLabel || "Không có dung lượng"}
                                              </div>
                                              {fileUrl ? (
                                                  <div className="tech-ticket-attachment__actions">
                                                    <a href={fileUrl} target="_blank" rel="noreferrer">Xem</a>
                                                    <button type="button" onClick={() => downloadAttachment(attachment)}>Tải xuống</button>
                                                  </div>
                                              ) : null}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : null}
                                </div>
                              </article>
                            );
                          })
                        )}
                      </div>

                      {selectedTicketResolved.status !== "CLOSED" ? (
                        <>
                          <div className="tech-ticket-quick-replies">
                            {TICKET_REPLY_TEMPLATES.map((text) => (
                              <button key={text} type="button" className="tech-ticket-quick-reply" onClick={() => setReplyMessage(text)}>
                                {text}
                              </button>
                            ))}
                          </div>

                          <div className="tech-ticket-reply-grid">
                            <div style={{ display: "grid", gap: 10 }}>
                              <textarea
                                ref={replyTextareaRef}
                                className="tech-ticket-textarea"
                                value={replyMessage}
                                onChange={(event) => setReplyMessage(event.target.value)}
                                placeholder={`Phản hồi khách hàng với tư cách ${techName}...`}
                                disabled={Boolean(actionLoading)}
                              />
                              <div className="tech-ticket-inline">
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
                                  className="tech-ticket-btn tech-ticket-btn--secondary"
                                  onClick={() => replyFileInputRef.current?.click()}
                                  disabled={Boolean(actionLoading)}
                                  title="Đính kèm ảnh, video hoặc tài liệu PDF (tối đa 5 tệp)"
                                >
                                  📎 Đính kèm tệp {replyFiles.length > 0 ? `(${replyFiles.length})` : ""}
                                </button>
                                <button
                                  type="button"
                                  className="tech-ticket-btn tech-ticket-btn--primary"
                                  onClick={handleSendReply}
                                  disabled={(!replyMessage.trim() && replyFiles.length === 0) || actionLoading === "reply"}
                                >
                                  {actionLoading === "reply" ? "Đang gửi..." : "Gửi phản hồi"}
                                </button>
                              </div>
                              {replyFiles.length > 0 ? (
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12, color: "#5b21b6", fontWeight: 700 }}>
                                  {replyFiles.map((f) => (
                                    <span key={`${f.name}-${f.size}`} style={{ padding: "4px 10px", background: "#f3e8ff", borderRadius: 999 }}>
                                      {f.name}
                                    </span>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReplyFiles([]);
                                      if (replyFileInputRef.current) replyFileInputRef.current.value = "";
                                    }}
                                    style={{ border: "none", background: "transparent", color: "#dc2626", cursor: "pointer", fontWeight: 800 }}
                                  >
                                    ✕ Xóa tệp
                                  </button>
                                </div>
                              ) : null}
                            </div>

                            <div className="tech-ticket-reply-sidebar">
                              <div className="tech-ticket-status-selects">
                                <select
                                  className="tech-ticket-select"
                                  value={selectedTicketResolved.status}
                                  onChange={(event) => handleAction("status", { status: event.target.value })}
                                  disabled={Boolean(actionLoading)}
                                  aria-label="Chuyển trạng thái ticket"
                                >
                                  {STATUS_OPTIONS.map((status) => (
                                    <option key={status} value={status}>
                                      {getTicketStatusMeta(status).label}
                                    </option>
                                  ))}
                                </select>
                                <select
                                  className="tech-ticket-select"
                                  value={selectedTicketResolved.priority}
                                  onChange={(event) => handleAction("priority", { priority: event.target.value })}
                                  disabled={Boolean(actionLoading)}
                                  aria-label="Cập nhật độ ưu tiên"
                                >
                                  {PRIORITY_OPTIONS.map((priority) => (
                                    <option key={priority} value={priority}>
                                      {getTicketPriorityMeta(priority).label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="tech-ticket-note-caption">
                                Thao tác đổi trạng thái hoặc ưu tiên sẽ cập nhật ngay vào inbox mà không reload toàn trang.
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="tech-ticket-empty">Ticket đã đóng. Không thể gửi thêm phản hồi.</div>
                      )}
                    </div>
                  </section>
                </div>

                <aside className="tech-ticket-side-stack">
                  <section className="tech-ticket-card">
                    <div className="tech-ticket-section__title">
                      <div>
                        <h3>Tệp đính kèm</h3>
                        <p>Hiển thị các tệp khách đã khai báo trong ticket hiện có.</p>
                      </div>
                    </div>
                    {selectedTicketResolved.attachmentMentions.length ? (
                      <div className="tech-ticket-attachments">
                        {selectedTicketResolved.attachmentMentions.map((attachment) => {
                          const fileUrl = getAttachmentUrl(attachment);
                          return (
                            <article key={attachment.id} className="tech-ticket-attachment">
                              <TicketAttachmentPreview attachment={attachment} />
                              <div style={{ minWidth: 0 }}>
                                <strong style={{ display: "block", color: "#1a1625" }}>{attachment.name}</strong>
                                <div className="tech-ticket-rich-text--soft">
                                  {attachment.sizeLabel || "Không có dung lượng"}
                                  {fileUrl ? " · Có thể xem/tải xuống" : " · chỉ có metadata, chưa có file thật"}
                                </div>
                                {fileUrl ? (
                                  <div className="tech-ticket-attachment__actions">
                                    <a href={fileUrl} target="_blank" rel="noreferrer">Xem tệp</a>
                                    <button type="button" onClick={() => downloadAttachment(attachment)}>Tải xuống</button>
                                  </div>
                                ) : null}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="tech-ticket-empty">Chưa có tệp đính kèm được đồng bộ trong ticket này.</div>
                    )}
                  </section>

                  <section className="tech-ticket-card">
                    <div className="tech-ticket-section__title">
                      <div>
                        <h3>Ghi chú nội bộ</h3>
                        <p>Ghi chú chỉ hiển thị cho bộ phận kỹ thuật trên trình duyệt hiện tại.</p>
                      </div>
                    </div>
                    <textarea
                      className="tech-ticket-textarea"
                      value={internalNotes[selectedTicketResolved.id] || ""}
                      onChange={(event) =>
                        setInternalNotes((prev) => ({
                          ...prev,
                          [selectedTicketResolved.id]: event.target.value
                        }))
                      }
                      placeholder="Ví dụ: đã hướng dẫn khách cập nhật BIOS, chờ khách xác nhận lại..."
                    />
                    <div className="tech-ticket-inline">
                      <span className="tech-ticket-note-caption">Ghi chú nội bộ được đồng bộ lên hệ thống và ẩn hoàn toàn với khách hàng.</span>
                      <button
                        type="button"
                        className="tech-ticket-btn tech-ticket-btn--secondary"
                        onClick={saveInternalNote}
                        disabled={Boolean(actionLoading)}
                      >
                        {actionLoading === "internal_note" ? "Đang lưu..." : "Lưu ghi chú nội bộ"}
                      </button>
                    </div>
                  </section>

                  <section className="tech-ticket-card">
                    <div className="tech-ticket-section__title">
                      <div>
                        <h3>Lịch sử xử lý</h3>
                        <p>Các mốc chính được suy ra từ trạng thái ticket và hội thoại hiện có.</p>
                      </div>
                    </div>
                    <div className="tech-ticket-activity">
                      {activityFeed.map((event) => (
                        <article key={event.id} className="tech-ticket-activity-item">
                          <div className="tech-ticket-activity-dot" />
                          <div>
                            <strong style={{ display: "block", color: "#1a1625" }}>{event.label}</strong>
                            <div className="tech-ticket-rich-text--soft">
                              {event.helper} · {formatDateTime(event.timestamp)}
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>

                  <section className="tech-ticket-card">
                    <div className="tech-ticket-section__title">
                      <div>
                        <h3>Liên quan bảo hành</h3>
                        <p>Chỉ hiển thị khi ticket có dấu hiệu liên quan serial hoặc bảo hành.</p>
                      </div>
                    </div>
                    {ticketContext.isWarrantyRelated ? (
                      <div className="tech-ticket-data-grid" style={{ gridTemplateColumns: "1fr" }}>
                        <article className="tech-ticket-data-card">
                          <span>Mã bảo hành</span>
                          <strong>{ticketContext.warrantyCode || "Chưa có trong nội dung ticket"}</strong>
                        </article>
                        <article className="tech-ticket-data-card">
                          <span>Serial</span>
                          <strong>{ticketContext.serial || "Chưa có trong nội dung ticket"}</strong>
                        </article>
                        <article className="tech-ticket-data-card">
                          <span>Mã đơn</span>
                          <strong>{ticketContext.orderCode || "Chưa có trong nội dung ticket"}</strong>
                        </article>
                        <Link to="/tech/warranties" className="tech-ticket-btn tech-ticket-btn--secondary">
                          Mở hồ sơ bảo hành
                        </Link>
                      </div>
                    ) : (
                      <div className="tech-ticket-empty">Ticket này hiện không có dữ liệu bảo hành hoặc serial để liên kết.</div>
                    )}
                  </section>
                </aside>
              </div>
            </>
          )}
        </main>
      </div>

      {showCloseModal ? (
        <div className="tech-ticket-modal" role="dialog" aria-modal="true" aria-labelledby="tech-close-ticket-title">
          <div className="tech-ticket-modal__panel">
            <h3 id="tech-close-ticket-title">Đóng ticket này?</h3>
            <p>Ticket sẽ chuyển sang trạng thái đóng và khách hàng không thể tiếp tục trao đổi trong hội thoại hiện tại.</p>
            <div className="tech-ticket-modal__actions">
              <button type="button" className="tech-ticket-btn tech-ticket-btn--secondary" onClick={() => setShowCloseModal(false)}>
                Quay lại
              </button>
              <button
                type="button"
                className="tech-ticket-btn tech-ticket-btn--danger"
                onClick={() => {
                  setShowCloseModal(false);
                  handleAction("close", { status: "CLOSED" });
                }}
              >
                Xác nhận đóng
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
