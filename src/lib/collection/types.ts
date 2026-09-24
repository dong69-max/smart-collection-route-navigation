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
  zone_id: number | null;
  completed_at: number | null;
  collected_amount: number | null;
  archived: number;
  hidden: number;
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
  photos: string | null;
}

// 拜访照片存的是 JSON 字符串数组（照片路径）；坏数据当作没有照片
export function parseHistoryPhotos(row: Pick<HistoryRow, "photos">): string[] {
  if (!row.photos) return [];
  try {
    const arr = JSON.parse(row.photos) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter((p): p is string => typeof p === "string" && p.length > 0);
  } catch {
    return [];
  }
}

export interface ShareVisitInfo {
  name: string;
  address: string;
  resultLabel: string;
  collected: number;
  notes: string;
  at: Date;
}

// 生成发到微信/WhatsApp 的交差摘要
export function buildShareText(v: ShareVisitInfo): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const t = v.at;
  const time = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())} ${pad(t.getHours())}:${pad(t.getMinutes())}`;
  const lines = [`📋 收账记录 · ${time}`, `客户：${v.name}`, `结果：${v.resultLabel}`];
  if (v.collected > 0) lines.push(`收款：RM ${v.collected.toFixed(2)}`);
  if (v.notes) lines.push(`备注：${v.notes}`);
  lines.push(`地址：${v.address}`);
  return lines.join("\n");
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

// 隐藏的客户今天不去：不进任务清单、路线、地图和统计，任务页可随时恢复
export function isShown(c: Customer) {
  return isOpen(c) && c.hidden !== 1;
}

// 固定编号：规划时写进客户的 route_order 就是它的终身号码。
// 完成任务、删除别人、收工都不会改号；只有重新规划或手动调序才重新编号。
// 还没规划过（route_order 为空）时，待处理客户用列表位置当临时编号，
// 已完成的显示 null（地图上显示 ✓）。
export function displaySeq(c: Customer, fallbackIndex: number): number | null {
  return c.route_order ?? (isOpen(c) ? fallbackIndex : null);
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

export interface Zone {
  _row_id: number;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  // 包含地区清单（逗号分隔）：地址里出现这些地名就直接归入该区
  keywords?: string | null;
  // 边界多边形（[[lat,lng],...]）：客户坐标落在里面就归入该区
  polygon?: string | null;
}

// 区的有效半径：离最近的区中心超过这个距离则不归入任何区
export const ZONE_MAX_KM = 15;

export function zoneKeywords(z: Zone): string[] {
  return (z.keywords ?? "")
    .split(/[,，、\n]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function zonePolygon(z: Zone): Array<[number, number]> {
  const raw = (z.polygon ?? "").trim();
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as Array<[number, number]>;
    return Array.isArray(arr) && arr.every((p) => Array.isArray(p) && typeof p[0] === "number" && typeof p[1] === "number")
      ? arr
      : [];
  } catch {
    return [];
  }
}

// 射线法：判断坐标是否落在多边形边界内
export function pointInPolygon(
  lat: number,
  lng: number,
  poly: ReadonlyArray<readonly [number, number]>,
): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const yi = poly[i][0];
    const xi = poly[i][1];
    const yj = poly[j][0];
    const xj = poly[j][1];
    if ((xi > lng) !== (xj > lng) && lat < ((yj - yi) * (lng - xi)) / (xj - xi) + yi) {
      inside = !inside;
    }
  }
  return inside;
}

// 地址对号：地址里包含区清单中的地名就归入该区（更具体/更长的地名赢）
export function matchZoneByAddress(zones: Zone[], address: string): Zone | null {
  const a = address.toLowerCase();
  let best: Zone | null = null;
  let bestLen = 0;
  for (const z of zones) {
    for (const k of zoneKeywords(z)) {
      if (a.includes(k) && k.length > bestLen) {
        bestLen = k.length;
        best = z;
      }
    }
  }
  return best;
}

// 自动分区（客户地址 → 定位经纬度 → 区域边界多边形 → 自动归区）：
// ① 坐标落在哪个区的边界内就归哪个区（同时落在多个区时取区中心最近的）
// ② 不在任何边界内时按地址里的地名对号
// ③ 再不行按坐标归最近的区中心（ZONE_MAX_KM 内）
export function assignZone(
  zones: Zone[],
  address: string,
  lat: number,
  lng: number,
  maxKm: number = ZONE_MAX_KM,
): Zone | null {
  const containing = zones.filter((z) => {
    const p = zonePolygon(z);
    return p.length >= 3 && pointInPolygon(lat, lng, p);
  });
  if (containing.length > 0) {
    if (containing.length === 1) return containing[0];
    let best = containing[0];
    let bestD = Infinity;
    for (const z of containing) {
      if (z.lat == null || z.lng == null) continue;
      const d = haversineKm({ lat, lng }, { lat: z.lat, lng: z.lng });
      if (d < bestD) {
        bestD = d;
        best = z;
      }
    }
    return best;
  }
  return matchZoneByAddress(zones, address) ?? nearestZone(zones, lat, lng, maxKm);
}

// 自动分区：把客户坐标归入最近的区（直线距离，ZONE_MAX_KM 内才算）
export function nearestZone(
  zones: Zone[],
  lat: number,
  lng: number,
  maxKm: number = ZONE_MAX_KM,
): Zone | null {
  let best: Zone | null = null;
  let bestD = Infinity;
  for (const z of zones) {
    if (z.lat == null || z.lng == null) continue;
    const d = haversineKm({ lat, lng }, { lat: z.lat, lng: z.lng });
    if (d < bestD) {
      bestD = d;
      best = z;
    }
  }
  return bestD <= maxKm ? best : null;
}

// ---- 今日目标区 ----

export interface TodayZone {
  zoneId: number | "none";
  name: string;
  date: string;
}

// 只认「今天」的今日目标：隔天自动失效
export function parseTodayZone(raw: string | null, today: string): TodayZone | null {
  if (!raw) return null;
  try {
    const t = JSON.parse(raw) as Partial<TodayZone>;
    if (t.date !== today) return null;
    if (t.zoneId !== "none" && typeof t.zoneId !== "number") return null;
    if (typeof t.name !== "string" || !t.name) return null;
    return { zoneId: t.zoneId, name: t.name, date: t.date };
  } catch {
    return null;
  }
}

// ---- 重复客户检测 ----

// 地址归一化：去标点/多余空格/大小写差异，让「22, Jalan Pancasila 1」和「22 jalan pancasila 1」算同一地址
export function normalizeAddress(a: string): string {
  return a
    .toLowerCase()
    .replace(/[,，.。;；:：!！?？\-_/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// 重复 = 同名 + 同地址（归一化后比较）。
// 同名但不同地址不算重复（客户可能有两间家），同地址不同名也不算（同屋不同欠款人）。
export function isDuplicateCustomer(
  name: string,
  address: string,
  existing: Array<Pick<Customer, "name" | "address">>,
): boolean {
  const n = name.trim().toLowerCase();
  const a = normalizeAddress(address);
  if (!n || !a) return false;
  return existing.some(
    (c) => c.name.trim().toLowerCase() === n && normalizeAddress(c.address) === a,
  );
}

// ---- 地图同地点合并 ----

export interface SpotGroup {
  lat: number;
  lng: number;
  items: Array<{ c: Customer; idx: number }>;
}

// 同一坐标的客户合并成一组：同地址多个欠款人画在一个图钉里，
// 编号并列显示（如 1·2），弹窗列出每个人——不再有人被叠在下面看不见
export function groupSameSpot(points: Customer[]): SpotGroup[] {
  const byKey = new Map<string, SpotGroup>();
  points.forEach((c, idx) => {
    const lat = c.lat as number;
    const lng = c.lng as number;
    const key = `${lat},${lng}`;
    const g = byKey.get(key);
    if (g) g.items.push({ c, idx });
    else byKey.set(key, { lat, lng, items: [{ c, idx }] });
  });
  return [...byKey.values()];
}
