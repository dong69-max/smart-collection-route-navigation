import { describe, it, expect } from "vitest";
import { haversineKm, isOpen, km, mins, money, nearestZone, restoreSavedPosition, STATUS_LABELS, syncPlanToOpenCustomers } from "./types";
import type { Customer, Zone } from "./types";

function make(partial: Partial<Customer>): Customer {
  return {
    _row_id: 1,
    name: "Test",
    phone: null,
    address: "Johor Bahru",
    amount: 100,
    priority: 2,
    lat: 1.5,
    lng: 103.7,
    geo_status: "ok",
    status: "pending",
    notes: null,
    task_date: "2026-09-14",
    route_order: null,
    pinned_next: 0,
    zone_id: null,
    completed_at: null,
    collected_amount: null,
    archived: 0,
    ...partial,
  };
}

// @kliv-spec-derived — 用户要求：完成后的客户要从待处理列表移除；「找不到人」也算已处理
describe("待处理判断", () => {
  it("待处理与进行中仍在列表内", () => {
    expect(isOpen(make({ status: "pending" }))).toBe(true);
    expect(isOpen(make({ status: "in_progress" }))).toBe(true);
  });

  it("已收款、未收款、找不到人都不再是待处理", () => {
    expect(isOpen(make({ status: "done" }))).toBe(false);
    expect(isOpen(make({ status: "unpaid" }))).toBe(false);
    expect(isOpen(make({ status: "not_found" }))).toBe(false);
    expect(isOpen(make({ status: "partial" }))).toBe(false);
  });
});

// @kliv-spec-derived — 用户要求：显示真实距离与时间，不得编造
describe("距离与时间格式", () => {
  it("4200 米显示为 4.2 km", () => {
    expect(km(4200)).toBe("4.2 km");
  });

  it("540 秒显示为 9 分钟", () => {
    expect(mins(540)).toBe("9 分钟");
  });

  it("超过一小时显示小时与分钟", () => {
    expect(mins(3900)).toBe("1 小时 5 分");
  });
});

describe("金额格式", () => {
  it("显示 RM 与两位小数", () => {
    expect(money(500)).toBe("RM 500.00");
  });

  it("空值显示 RM 0.00", () => {
    expect(money(null)).toBe("RM 0.00");
  });
});

describe("直线距离", () => {
  it("同一点距离为 0", () => {
    expect(haversineKm({ lat: 1.5, lng: 103.7 }, { lat: 1.5, lng: 103.7 })).toBe(0);
  });

  it("新山两地距离在合理范围", () => {
    const d = haversineKm({ lat: 1.5285, lng: 103.7908 }, { lat: 1.4959, lng: 103.8164 });
    expect(d).toBeGreaterThan(3);
    expect(d).toBeLessThan(7);
  });
});

describe("状态中文标签", () => {
  it("每个状态都有中文说明", () => {
    expect(STATUS_LABELS.partial).toBe("部分收款");
    expect(STATUS_LABELS.bad_address).toBe("地址错误");
  });
});

describe("路线计划随任务清单同步", () => {
  const plan: import("./types").RoutePlan = {
    provider: "osrm",
    mode: "fastest",
    legs: [
      { id: 1, distance_m: 5000, duration_s: 300 },
      { id: 2, distance_m: 3000, duration_s: 200 },
    ],
    total_distance_m: 8000,
    total_duration_s: 500,
    return_leg: { distance_m: 4000, duration_s: 240 },
    createdAt: 1,
  };

  // @kliv-spec-derived — from user intent: "重置/完成后，首页的预计驾驶距离和时间要跟着归零或更新"
  it("所有客户都不在清单时返回 null（预计距离/时间归零）", () => {
    expect(syncPlanToOpenCustomers(plan, [])).toBeNull();
  });

  // @kliv-spec-derived — from user intent: "完成任务后数字应更新而不是停留在旧值"
  it("剔除已完成的路段并重算总量（含返回大本营段）", () => {
    const synced = syncPlanToOpenCustomers(plan, [2]);
    expect(synced).not.toBeNull();
    expect(synced!.legs.map((l) => l.id)).toEqual([2]);
    expect(synced!.total_distance_m).toBe(3000 + 4000);
    expect(synced!.total_duration_s).toBe(200 + 240);
  });

  it("清单没变时原样返回同一对象", () => {
    expect(syncPlanToOpenCustomers(plan, [1, 2])).toBe(plan);
  });
});

// @kliv-spec-derived — 用户要求：录入客户后按地址自动归入最近的区
describe("自动分区", () => {
  const zones: Zone[] = [
    { _row_id: 1, name: "东区", address: "Taman Molek", lat: 1.5285, lng: 103.7908 },
    { _row_id: 2, name: "南区", address: "Permas Jaya", lat: 1.45, lng: 103.75 },
    { _row_id: 3, name: "无坐标区", address: "x", lat: null, lng: null },
  ];

  it("东边的客户归入东区，南边的归入南区", () => {
    expect(nearestZone(zones, 1.52, 103.78)?.name).toBe("东区");
    expect(nearestZone(zones, 1.46, 103.76)?.name).toBe("南区");
  });

  it("离所有区都很远则不归入任何区", () => {
    expect(nearestZone(zones, 2.5, 104.5)).toBeNull();
  });

  it("没有区时返回 null", () => {
    expect(nearestZone([], 1.5, 103.7)).toBeNull();
  });
});

// @kliv-spec-derived — 用户要求：定位关闭后地图不应再显示旧位置图钉
describe("上次定位还原", () => {
  const now = 1_000_000_000_000;
  const raw = JSON.stringify({ lat: 1.5, lng: 103.7, label: "GPS 1.5,103.7", ts: now - 60_000 });

  it("3 小时内的定位可以还原", () => {
    const p = restoreSavedPosition(raw, now);
    expect(p).not.toBeNull();
    expect(p!.lat).toBe(1.5);
  });

  it("超过 3 小时的定位不还原（图钉消失）", () => {
    const stale = JSON.stringify({ lat: 1.5, lng: 103.7, label: "GPS", ts: now - 4 * 60 * 60 * 1000 });
    expect(restoreSavedPosition(stale, now)).toBeNull();
  });

  it("旧格式（无时间戳）不还原", () => {
    const legacy = JSON.stringify({ lat: 1.5, lng: 103.7, label: "GPS" });
    expect(restoreSavedPosition(legacy, now)).toBeNull();
    expect(restoreSavedPosition(null, now)).toBeNull();
  });
});
