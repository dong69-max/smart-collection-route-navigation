export type TaskStatus =
  | "pending"
  | "in_progress"
  | "done"
  | "unpaid"
  | "partial"
  | "not_found"
  | "bad_address"
  | "refused"
  | "other";

export interface Customer {
  _row_id: number;
  name: string;
  phone: string | null;
  address: string;
  amount: number;
  priority: number;
  lat: number | null;
  lng: number | null;
  geo_status: string;
  status: TaskStatus;
  notes: string | null;
  task_date: string | null;
  route_order: number | null;
  pinned_next: number;
  completed_at: number | null;
  collected_amount: number | null;
  archived: number;
}

export interface HistoryRow {
  _row_id: number;
  customer_id: number;
  customer_name: string | null;
  result: string | null;
  collected_amount: number | null;
  notes: string | null;
  lat: number | null;
  lng: number | null;
  recorded_at: number | null;
}

export interface RouteLeg {
  id: number;
  distance_m: number;
  duration_s: number;
}

export interface RoutePlan {
  provider: string;
  mode: RouteMode;
  legs: RouteLeg[];
  total_distance_m: number;
  total_duration_s: number;
  return_leg?: { distance_m: number; duration_s: number } | null;
  manual?: boolean;
  createdAt: number;
}

export type RouteMode = "fastest" | "shortest" | "priority";

export interface Coords {
  lat: number;
  lng: number;
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "待处理",
  in_progress: "进行中",
  done: "已收款",
  partial: "部分收款",
  unpaid: "未收款",
  not_found: "找不到人",
  bad_address: "地址错误",
  refused: "客户拒绝",
  other: "其他",
};

export const OPEN_STATUSES: TaskStatus[] = ["pending", "in_progress"];

export const PRIORITY_LABELS: Record<number, string> = {
  1: "高",
  2: "中",
  3: "低",
};

export function isOpen(c: Customer) {
  return OPEN_STATUSES.includes(c.status) && c.archived !== 1;
}

export function km(m: number) {
  return `${(m / 1000).toFixed(1)} km`;
}

export function mins(s: number) {
  const m = Math.round(s / 60);
  if (m < 60) return `${m} 分钟`;
  return `${Math.floor(m / 60)} 小时 ${m % 60} 分`;
}

export function money(v: number | null | undefined) {
  return `RM ${Number(v ?? 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function haversineKm(a: Coords, b: Coords) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 把已保存的路线计划同步到「仍在待处理清单里的客户」：
// 客户被完成/删除/归档后，对应路段剔除并重算总距离时间；
// 一个都不剩时返回 null（首页的预计距离/时间随之归零）。
export function syncPlanToOpenCustomers(
  plan: RoutePlan,
  openIds: number[],
): RoutePlan | null {
  const kept = plan.legs.filter((l) => openIds.includes(l.id));
  if (kept.length === 0) return null;
  if (kept.length === plan.legs.length) return plan;
  const ret = plan.return_leg ?? null;
  return {
    ...plan,
    legs: kept,
    total_distance_m: kept.reduce((a, l) => a + l.distance_m, 0) + (ret?.distance_m ?? 0),
    total_duration_s: kept.reduce((a, l) => a + l.duration_s, 0) + (ret?.duration_s ?? 0),
  };
}

export interface SavedPosition extends Coords {
  label: string;
}

// 上次定位只在 3 小时内有效：定位关闭/过期后，
// 地图不再显示旧图钉，路线规划自动改用大本营作为起点。
export const POSITION_TTL_MS = 3 * 60 * 60 * 1000;

export function restoreSavedPosition(
  raw: string | null,
  now: number = Date.now(),
): SavedPosition | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<SavedPosition> & { ts?: number };
    if (typeof p.lat !== "number" || typeof p.lng !== "number" || !p.label) return null;
    if (typeof p.ts !== "number" || now - p.ts > POSITION_TTL_MS) return null;
    return { lat: p.lat, lng: p.lng, label: p.label };
  } catch {
    return null;
  }
}
