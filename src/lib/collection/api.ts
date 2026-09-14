import db from "@/lib/shared/kliv-database.js";
import type { RecordData } from "@/lib/shared/kliv-database.js";
import functions from "@/lib/shared/kliv-functions.js";
import type { Coords, Customer, HistoryRow, RouteLeg, RouteMode } from "./types";

export interface GeocodeHit {
  address: string;
  ok: boolean;
  lat?: number;
  lng?: number;
  formatted?: string;
  precise?: boolean;
  error?: string;
}

export async function geocodeAddresses(addresses: string[]) {
  const res = await functions.post<{ provider: string; results: GeocodeHit[] }>(
    "geocode",
    { addresses },
  );
  return res;
}

export async function requestRoute(params: {
  start: Coords;
  stops: Array<{ id: number; lat: number; lng: number; priority?: number; amount?: number }>;
  mode: RouteMode;
  pinnedFirstId?: number;
  returnTo?: Coords;
}) {
  return functions.post<{
    provider: string;
    mode: string;
    legs: RouteLeg[];
    return_leg?: { distance_m: number; duration_s: number } | null;
    total_distance_m: number;
    total_duration_s: number;
  }>("optimize-route", {
    start: { id: 0, lat: params.start.lat, lng: params.start.lng },
    stops: params.stops,
    mode: params.mode,
    pinnedFirstId: params.pinnedFirstId,
    returnTo: params.returnTo,
  });
}

export async function listCustomers(): Promise<Customer[]> {
  return (await db.query("customers", {
    archived: "eq.0",
    order: "route_order.asc,_row_id.asc",
    limit: "1000",
  })) as unknown as Customer[];
}

export async function listHistory(): Promise<HistoryRow[]> {
  return (await db.query("collection_history", {
    order: "recorded_at.desc",
    limit: "500",
  })) as unknown as HistoryRow[];
}

export async function insertCustomer(data: RecordData) {
  return db.insert("customers", data);
}

export async function updateCustomer(id: number, data: RecordData) {
  return db.update("customers", { _row_id: `eq.${id}` }, data);
}

export async function deleteCustomer(id: number) {
  return db.delete("customers", { _row_id: `eq.${id}` });
}

export async function insertHistory(data: RecordData) {
  return db.insert("collection_history", data);
}

export function errorText(e: unknown): string {
  if (e && typeof e === "object") {
    const anyE = e as { details?: { error?: string }; message?: string };
    if (anyE.details?.error) return anyE.details.error;
    if (anyE.message) return anyE.message;
  }
  return String(e);
}

export async function deleteHistory(id: number) {
  return db.delete("collection_history", { _row_id: `eq.${id}` });
}

export async function getSetting(key: string): Promise<string | null> {
  const rows = (await db.query("app_settings", { key: `eq.${key}`, limit: "1" })) as unknown as Array<{ value: string }>;
  return rows[0]?.value ?? null;
}

export async function saveSetting(key: string, value: string) {
  const rows = (await db.query("app_settings", { key: `eq.${key}`, limit: "1" })) as unknown as Array<{ _row_id: number }>;
  if (rows.length > 0) {
    return db.update("app_settings", { _row_id: `eq.${rows[0]._row_id}` }, { value });
  }
  return db.insert("app_settings", { key, value });
}
