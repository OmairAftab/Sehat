import { useEffect, useState } from "react";
export function useServiceStatus() {
  const [status, S] = useState<
    "checking" | "connected" | "unconfigured" | "unavailable"
  >("checking");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/status", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((data) => S(data.aiConfigured ? "connected" : "unconfigured"))
      .catch(() => {
        if (!controller.signal.aborted) S("unavailable");
      });
    return () => controller.abort();
  }, []);
  return status;
}
