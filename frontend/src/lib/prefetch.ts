import { analyticsApi, transactionsApi } from "@/lib/api";

// Dashboard data requested in parallel with the auth check and the Home
// chunk download, then handed to Home once on its first fetch.
let pending: Promise<[any, any]> | null = null;

export function prefetchHome() {
  if (pending || !localStorage.getItem("token")) return;
  pending = Promise.all([analyticsApi.summary(12), transactionsApi.list({ limit: 500 })]);
  pending.catch(() => {});
}

export function takePrefetch() {
  const p = pending;
  pending = null;
  return p;
}
