import { describe, it, expect } from "vitest";
import { assignZone, displaySeq, haversineKm, isOpen, km, matchZoneByAddress, mins, money, nearestZone, restoreSavedPosition, STATUS_LABELS, syncPlanToOpenCustomers, zoneKeywords } from "./types";
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

// @kliv-spec-derived — 用户要求：1号完成任务后还是1号，2号还是2号，任何人都不重新编号
describe("固定编号", () => {
  it("完成后的客户保持原编号", () => {
    expect(displaySeq(make({ status: "done", route_order: 1 }), 1)).toBe(1);
  });

  it("1号完成后，2号3号仍是2号3号，不变成1号2号", () => {
    expect(displaySeq(make({ status: "pending", route_order: 2 }), 1)).toBe(2);
    expect(displaySeq(make({ status: "pending", route_order: 3 }), 2)).toBe(3);
  });

  it("未规划过的待处理客户用列表位置，已完成且无编号返回 null（地图显示勾）", () => {
    expect(displaySeq(make({ status: "pending", route_order: null }), 2)).toBe(2);
    expect(displaySeq(make({ status: "done", route_order: null }), 2)).toBeNull();
  });
});

// @kliv-spec-derived — 用户给出 7 区清单：地址含 Taman Molek 归东区，含 Senai 归北区，地名优先于距离
describe("按地址地名分区", () => {
  const zones: Zone[] = [
    { _row_id: 1, name: "北区", address: "Senai", lat: 1.6012, lng: 103.6447, keywords: "Senai,Kulai,Bandar Putra,Indahpura,Saleng" },
    { _row_id: 2, name: "西区", address: "Skudai", lat: 1.5377, lng: 103.6286, keywords: "Skudai,Taman Universiti,Mutiara Rini" },
    { _row_id: 3, name: "西南区", address: "Bukit Indah", lat: 1.4801, lng: 103.6596, keywords: "Bukit Indah,Taman Perling,Medini,Eco Botanic" },
    { _row_id: 4, name: "中区", address: "Larkin", lat: 1.4966, lng: 103.7414, keywords: "JB Town,Larkin,Stulang,Tampoi,Kempas" },
    { _row_id: 5, name: "东北区", address: "Taman Daya", lat: 1.555, lng: 103.7583, keywords: "Mount Austin,Taman Daya,Tebrau,Desa Cemerlang" },
    { _row_id: 6, name: "东区", address: "Taman Molek", lat: 1.5286, lng: 103.7908, keywords: "Permas Jaya,Taman Molek,Johor Jaya" },
    { _row_id: 7, name: "东南区", address: "Masai", lat: 1.4865, lng: 103.8854, keywords: "Masai,Pasir Gudang,Bandar Seri Alam" },
  ];

  it("地址含 Taman Molek 归东区，含 Senai 归北区，含 Pasir Gudang 归东南区", () => {
    expect(matchZoneByAddress(zones, "12, Jalan Molek 1, Taman Molek, Johor Bahru")?.name).toBe("东区");
    expect(matchZoneByAddress(zones, "Senai Business Park, Senai")?.name).toBe("北区");
    expect(matchZoneByAddress(zones, "Jalan Pasir Gudang 4")?.name).toBe("东南区");
  });

  it("大小写不敏感，中文逗号顿号也能分隔", () => {
    expect(matchZoneByAddress(zones, "SENAI BUSINESS PARK")?.name).toBe("北区");
    const zh: Zone[] = [{ _row_id: 1, name: "X区", address: "", lat: 1, lng: 2, keywords: " senai 、kulai，saleng " }];
    expect(zoneKeywords(zh[0])).toEqual(["senai", "kulai", "saleng"]);
  });

  it("更具体的地名赢（长匹配优先）", () => {
    const zs: Zone[] = [
      { _row_id: 1, name: "A区", address: "", lat: 1.5, lng: 103.7, keywords: "Alam" },
      { _row_id: 2, name: "B区", address: "", lat: 1.5, lng: 103.7, keywords: "Bandar Seri Alam" },
    ];
    expect(matchZoneByAddress(zs, "Bandar Seri Alam, Masai")?.name).toBe("B区");
  });

  it("地名对不上时按坐标归最近的区", () => {
    expect(assignZone(zones, "某条路 88 号", 1.528, 103.79)?.name).toBe("东区");
    expect(assignZone(zones, "某条路 88 号", 1.601, 103.645)?.name).toBe("北区");
  });

  it("地址对不上地名且坐标太远则不分区", () => {
    expect(assignZone(zones, "Kuala Lumpur", 3.14, 101.69)).toBeNull();
  });

  it("地址地名优先于坐标距离", () => {
    // 坐标在北区中心，但地址写着 Taman Molek → 应归东区
    expect(assignZone(zones, "Taman Molek, Johor Bahru", 1.601, 103.645)?.name).toBe("东区");
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
