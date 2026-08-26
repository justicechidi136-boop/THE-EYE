"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const DASHBOARD_REFRESH_INTERVAL_MS = 10_000;

export function DashboardLiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, DASHBOARD_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [router]);

  return null;
}
