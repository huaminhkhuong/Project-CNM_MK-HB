/**
 * useSocket — React hook để dùng Socket.io trong components
 * 
 * Usage:
 *   const { joinRoom, leaveRoom, on, emit } = useSocket();
 *   joinRoom("staff_queue");
 *   on("queue:new_session", (data) => setSessions(prev => [data, ...prev]));
 */
import { useEffect, useRef, useCallback } from "react";
import { getSocket } from "../services/socket.service";

/**
 * @returns {{ joinRoom, leaveRoom, emit, on, socket }}
 */
export function useSocket() {
  const socket = getSocket();
  const listenersRef = useRef([]);

  /**
   * Tham gia 1 Socket.io room
   * @param {string} roomEvent - tên event join (ví dụ: "join_chat", "join_staff_queue")
   * @param {string|number|undefined} id - ID đi kèm (nếu có)
   */
  const joinRoom = useCallback(
    (roomEvent, id) => {
      if (id !== undefined && id !== null) {
        socket.emit(roomEvent, id);
      } else {
        socket.emit(roomEvent);
      }
    },
    [socket]
  );

  /**
   * Rời khỏi 1 Socket.io room
   * @param {string} roomEvent - tên event leave (ví dụ: "leave_chat")
   * @param {string|number|undefined} id - ID đi kèm
   */
  const leaveRoom = useCallback(
    (roomEvent, id) => {
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

  // Cleanup: xóa tất cả listeners khi component unmount
  useEffect(() => {
    return () => {
      listenersRef.current.forEach(({ event, handler }) => {
        socket.off(event, handler);
      });
      listenersRef.current = [];
    };
  }, [socket]);

  return { socket, joinRoom, leaveRoom, on, emit };
}

export default useSocket;
