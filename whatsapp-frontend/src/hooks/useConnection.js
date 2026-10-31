import { useState, useEffect, useCallback, useRef } from "react";
import connectionApi from "../api/connectionApi.js";

export function useConnection() {
  const [status, setStatus] = useState(null);
  const [qr, setQr] = useState({ available: false, qr: null, status: "disconnected" });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [sseActive, setSseActive] = useState(false);

  const eventSourceRef = useRef(null);
  const fallbackTimerRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await connectionApi.getStatus();
      setStatus(data);
      if (data.status === "qr" || data.qrAvailable) {
        fetchQr();
      } else {
        setQr((prev) => ({ ...prev, available: false, qr: null, status: data.status }));
      }
      setError("");
      return data;
    } catch (err) {
      setError(err.message || "Failed to fetch status");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchQr = useCallback(async () => {
    try {
      const qrData = await connectionApi.getQr();
      setQr(qrData);
      return qrData;
    } catch (err) {
      console.warn("Failed to fetch QR code:", err.message);
      return null;
    }
  }, []);

  // Setup Server-Sent Events (SSE) with auto-reconnect and fallback polling
  useEffect(() => {
    let isMounted = true;

    function initSSE() {
      if (eventSourceRef.current) {
        try {
          eventSourceRef.current.close();
        } catch {}
      }

      const eventsUrl = connectionApi.getEventsUrl();
      const es = new EventSource(eventsUrl);
      eventSourceRef.current = es;

      es.onopen = () => {
        if (!isMounted) return;
        setSseActive(true);
        setError("");
      };

      es.addEventListener("status", (event) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(event.data);
          setStatus(data);
          if (data.status !== "qr" && !data.qrAvailable) {
            setQr((prev) => ({ ...prev, available: false, qr: null, status: data.status }));
          }
        } catch (e) {
          console.error("Failed to parse status SSE event", e);
        }
      });

      es.addEventListener("qr", (event) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(event.data);
          setQr(data);
        } catch (e) {
          console.error("Failed to parse qr SSE event", e);
        }
      });

      es.addEventListener("connected", (event) => {
        if (!isMounted) return;
        setQr({ available: false, qr: null, status: "connected" });
        fetchStatus();
      });

      es.addEventListener("disconnected", (event) => {
        if (!isMounted) return;
        fetchStatus();
      });

      es.addEventListener("reconnecting", (event) => {
        if (!isMounted) return;
        setStatus((prev) => (prev ? { ...prev, status: "reconnecting", connecting: true } : prev));
      });

      es.addEventListener("logout", (event) => {
        if (!isMounted) return;
        setQr({ available: false, qr: null, status: "logged_out" });
        fetchStatus();
        window.dispatchEvent(new CustomEvent("whatsapp:data_cleared"));
      });

      es.addEventListener("data_cleared", (event) => {
        if (!isMounted) return;
        fetchStatus();
        window.dispatchEvent(new CustomEvent("whatsapp:data_cleared"));
      });

      es.addEventListener("login_changed", (event) => {
        if (!isMounted) return;
        fetchStatus();
        let payload = null;
        try {
          payload = JSON.parse(event.data);
        } catch {}
        window.dispatchEvent(new CustomEvent("whatsapp:login_changed", { detail: payload }));
      });

      es.addEventListener("error", (event) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(event.data);
          if (data.error) setError(data.error);
        } catch {}
      });

      es.onerror = () => {
        if (!isMounted) return;
        setSseActive(false);
        try {
          es.close();
        } catch {}
        // Retry SSE after 5 seconds
        fallbackTimerRef.current = setTimeout(initSSE, 5000);
      };
    }

    fetchStatus().then(() => {
      if (isMounted) initSSE();
    });

    // Periodic safety sync (every 10s)
    const interval = setInterval(() => {
      fetchStatus();
    }, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
      if (eventSourceRef.current) {
        try {
          eventSourceRef.current.close();
        } catch {}
      }
    };
  }, [fetchStatus]);

  const connect = async () => {
    setActionLoading(true);
    setError("");
    try {
      const res = await connectionApi.connect();
      await fetchStatus();
      await fetchQr();
      return res;
    } catch (err) {
      setError(err.message || "Failed to start connection");
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const reconnect = async () => {
    setActionLoading(true);
    setError("");
    try {
      const res = await connectionApi.reconnect();
      await fetchStatus();
      return res;
    } catch (err) {
      setError(err.message || "Failed to reconnect");
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const logout = async () => {
    setActionLoading(true);
    setError("");
    try {
      const res = await connectionApi.logout();
      setQr({ available: false, qr: null, status: "logged_out" });
      await fetchStatus();
      window.dispatchEvent(new CustomEvent("whatsapp:data_cleared"));
      return res;
    } catch (err) {
      setError(err.message || "Failed to log out");
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const clearData = async () => {
    setActionLoading(true);
    setError("");
    try {
      const res = await connectionApi.clearData();
      await fetchStatus();
      window.dispatchEvent(new CustomEvent("whatsapp:data_cleared"));
      return res;
    } catch (err) {
      setError(err.message || "Failed to clear stored data");
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  return {
    status,
    qr,
    loading,
    actionLoading,
    error,
    sseActive,
    refreshStatus: fetchStatus,
    refreshQr: fetchQr,
    connect,
    reconnect,
    logout,
    clearData,
  };
}

export default useConnection;
