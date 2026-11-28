/**
 * useSocket — React hook để dùng Socket.io trong components
 * Tự động đăng ký room subscription để re-join khi reconnect/refresh JWT
 * và cleanup toàn bộ listeners + room subscriptions khi unmount.
 *
 * Usage:
 *   const { joinRoom, leaveRoom, on, emit } = useSocket();
 *   joinRoom("join_staff_queue", { staffId, staffName, role });
 *   on("queue:new_session", (data) => setSessions(prev => [data, ...prev]));
 */
import { useEffect, useRef, useCallback } from "react";
import {
  getSocket,
  registerRoomSubscription,
  unregisterRoomSubscription
} from "../services/socket.service";

/**
 * @returns {{ joinRoom, leaveRoom, emit, on, socket }}
 */
export function useSocket() {
  const socket = getSocket();
  const listenersRef = useRef([]);
  const joinedRoomsRef = useRef([]);

  /**
   * Tham gia 1 Socket.io room và lưu vào registry để tự re-join khi reconnect
   * @param {string} roomEvent - tên event join (ví dụ: "join_chat", "join_staff_queue")
   * @param {string|number|object|undefined} id - ID hoặc payload đi kèm (nếu có)
   */
  const joinRoom = useCallback(
    (roomEvent, id) => {
      registerRoomSubscription(roomEvent, id);
      joinedRoomsRef.current.push({ roomEvent, id });

      if (socket.connected) {
        if (id !== undefined && id !== null) {
          socket.emit(roomEvent, id);
        } else {
          socket.emit(roomEvent);
        }
      }
    },
    [socket]
  );

  /**
   * Rời khỏi 1 Socket.io room và gỡ khỏi registry re-join
   * @param {string} roomEvent - tên event leave (ví dụ: "leave_chat", "leave_staff_queue")
   * @param {string|number|object|undefined} id - ID đi kèm
   */
  const leaveRoom = useCallback(
    (roomEvent, id) => {
      const correspondingJoin = String(roomEvent || "").replace(/^leave_/, "join_");
      const matchIdx = joinedRoomsRef.current.findIndex(
        (entry) =>
          entry.roomEvent === correspondingJoin &&
          (entry.id === id || JSON.stringify(entry.id ?? null) === JSON.stringify(id ?? null))
      );
      if (matchIdx >= 0) {
        const [removed] = joinedRoomsRef.current.splice(matchIdx, 1);
        unregisterRoomSubscription(removed.roomEvent, removed.id);
      } else {
        unregisterRoomSubscription(correspondingJoin, id);
      }

      if (id !== undefined && id !== null) {
        socket.emit(roomEvent, id);
      } else {
        socket.emit(roomEvent);
      }
    },
    [socket]
  );

  /**
   * Đăng ký lắng nghe 1 socket event, tự cleanup khi component unmount
   * hoặc khi gọi hàm unsubscribe trả về
   * @param {string} event - tên event
   * @param {Function} handler - callback khi nhận event
   * @returns {Function} unsubscribe function
   */
  const on = useCallback(
    (event, handler) => {
      socket.on(event, handler);
      listenersRef.current.push({ event, handler });
      return () => {
        socket.off(event, handler);
        listenersRef.current = listenersRef.current.filter(
          (item) => !(item.event === event && item.handler === handler)
        );
      };
    },
    [socket]
  );

  /**
   * Gửi 1 event đến server
   * @param {string} event
   * @param {*} data
   */
  const emit = useCallback(
    (event, data) => {
      socket.emit(event, data);
    },
    [socket]
  );

  // Cleanup: xóa tất cả listeners & room subscriptions khi component unmount
  useEffect(() => {
    return () => {
      listenersRef.current.forEach(({ event, handler }) => {
        socket.off(event, handler);
      });
      listenersRef.current = [];

      joinedRoomsRef.current.forEach(({ roomEvent, id }) => {
        unregisterRoomSubscription(roomEvent, id);
      });
      joinedRoomsRef.current = [];
    };
  }, [socket]);

  return { socket, joinRoom, leaveRoom, on, emit };
}

export default useSocket;
