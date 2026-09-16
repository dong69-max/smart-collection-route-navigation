import { describe, it, expect } from "vitest";
import { assignZone, displaySeq, groupSameSpot, haversineKm, isDuplicateCustomer, isOpen, isShown, km, matchZoneByAddress, mins, money, nearestZone, normalizeAddress, parseTodayZone, pointInPolygon, restoreSavedPosition, STATUS_LABELS, syncPlanToOpenCustomers, zoneKeywords, zonePolygon } from "./types";
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
    hidden: 0,
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

// @kliv-spec-derived — 用户要求：客户地址 → 定位经纬度 → 区域边界多边形 → 自动归区
// 边界优先于地名；不在任何边界内才退回地名/最近中心
describe("边界多边形分区", () => {
  const poly: Array<[number, number]> = [
    [1.5, 103.7],
    [1.5, 103.8],
    [1.55, 103.8],
    [1.55, 103.7],
  ];

  it("点在多边形内/外判断正确", () => {
    expect(pointInPolygon(1.52, 103.75, poly)).toBe(true);
    expect(pointInPolygon(1.6, 103.75, poly)).toBe(false);
    expect(pointInPolygon(1.52, 103.85, poly)).toBe(false);
  });

  it("zonePolygon 能解析边界，格式坏时返回空", () => {
    expect(zonePolygon({ _row_id: 1, name: "x", address: "", lat: null, lng: null, polygon: JSON.stringify(poly) })).toEqual(poly);
    expect(zonePolygon({ _row_id: 2, name: "x", address: "", lat: null, lng: null, polygon: "不是json" })).toEqual([]);
    expect(zonePolygon({ _row_id: 3, name: "x", address: "", lat: null, lng: null })).toEqual([]);
  });

  it("坐标落在边界内就归这个区，优先于地址地名", () => {
    const zs: Zone[] = [
      { _row_id: 1, name: "边界区", address: "", lat: 1.52, lng: 103.75, polygon: JSON.stringify(poly) },
      { _row_id: 2, name: "地名区", address: "", lat: 1.6, lng: 103.9, keywords: "Senai" },
    ];
    // 坐标在边界区内，即使地址写着别区的地名，也归边界区
    expect(assignZone(zs, "Senai Business Park", 1.52, 103.75)?.name).toBe("边界区");
  });

  it("同时落在两个区的边界内时取区中心最近的", () => {
    const zs: Zone[] = [
      { _row_id: 1, name: "甲区", address: "", lat: 1.51, lng: 103.75, polygon: JSON.stringify(poly) },
      { _row_id: 2, name: "乙区", address: "", lat: 1.54, lng: 103.75, polygon: JSON.stringify(poly) },
    ];
    expect(assignZone(zs, "某地址", 1.525, 103.75)?.name).toBe("甲区");
    expect(assignZone(zs, "某地址", 1.535, 103.75)?.name).toBe("乙区");
  });

  it("不在任何边界内时退回地名对号", () => {
    const zs: Zone[] = [
      { _row_id: 1, name: "边界区", address: "", lat: 1.52, lng: 103.75, polygon: JSON.stringify(poly) },
      { _row_id: 2, name: "地名区", address: "", lat: 1.6, lng: 103.9, keywords: "Senai" },
    ];
    expect(assignZone(zs, "Senai Business Park", 1.6, 103.9)?.name).toBe("地名区");
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

// @kliv-spec-derived — 用户要求：批量导入自动跳过重复客户；但同名不同地址（两间家）允许添加
describe("重复客户检测", () => {
  const existing: Array<{ name: string; address: string }> = [
    { name: "Lim Pek Pek", address: "22, Jalan Pancasila 1" },
  ];

  it("同名同地址（标点空格大小写不同）算重复", () => {
    expect(isDuplicateCustomer("lim pek pek", "22 jalan pancasila 1", existing)).toBe(true);
    expect(isDuplicateCustomer("LIM PEK PEK", "22, JALAN PANCASILA 1", existing)).toBe(true);
  });

  it("同名但不同地址（两间家）不算重复，可以添加", () => {
    expect(
      isDuplicateCustomer(
        "Lim Pek Pek",
        "28, Jalan Serangkai 1, Taman Bukit Dahlia, 81700 Pasir Gudang, Johor",
        existing,
      ),
    ).toBe(false);
  });

  it("同地址不同名不算重复（同屋不同欠款人）", () => {
    expect(isDuplicateCustomer("Tan Ah Kau", "22, Jalan Pancasila 1", existing)).toBe(false);
  });

  it("空姓名或空地址不算重复", () => {
    expect(isDuplicateCustomer("", "22, Jalan Pancasila 1", existing)).toBe(false);
    expect(isDuplicateCustomer("Lim Pek Pek", "  ", existing)).toBe(false);
  });

  it("地址归一化：去标点、压缩空格、转小写", () => {
    expect(normalizeAddress("28, Jalan Serangkai 1, Taman Bukit Dahlia")).toBe(
      "28 jalan serangkai 1 taman bukit dahlia",
    );
    expect(normalizeAddress("A，B。C；D")).toBe("a b c d");
  });
});

// @kliv-spec-derived — 用户要求：今天不想去的客户隐藏后不进任务/路线/统计，之后可再显示
 describe("隐藏客户", () => {
  it("隐藏的待处理客户不再显示", () => {
    expect(isShown(make({ status: "pending", hidden: 1 }))).toBe(false);
  });

  it("未隐藏的待处理客户正常显示", () => {
    expect(isShown(make({ status: "pending", hidden: 0 }))).toBe(true);
  });

  it("已完成的客户无论隐藏与否都不在待处理清单", () => {
    expect(isShown(make({ status: "done", hidden: 0 }))).toBe(false);
    expect(isShown(make({ status: "done", hidden: 1 }))).toBe(false);
  });
});

// @kliv-spec-derived — 用户要求：同地点两位客户（1 号被 2 号叠住）都要看得见
 describe("同地点客户合并", () => {
  it("同坐标的客户合为一组，编号并列显示", () => {
    const a = make({ _row_id: 1, name: "A", route_order: 1, lat: 1.5, lng: 103.7 });
    const b = make({ _row_id: 2, name: "B", route_order: 2, lat: 1.5, lng: 103.7 });
    const g = groupSameSpot([a, b]);
    expect(g).toHaveLength(1);
    expect(g[0].items).toHaveLength(2);
    expect(g[0].items.map((x) => x.c.name)).toEqual(["A", "B"]);
  });

  it("不同坐标的客户各自成组，顺序保留", () => {
    const a = make({ _row_id: 1, lat: 1.5, lng: 103.7 });
    const b = make({ _row_id: 2, lat: 1.52, lng: 103.75 });
    const g = groupSameSpot([a, b]);
    expect(g).toHaveLength(2);
    expect(g[0].items[0].idx).toBe(0);
    expect(g[1].items[0].idx).toBe(1);
  });
});

// @kliv-spec-derived — 用户要求：路线页按区智能规划后，首页要显示今日目标（如西区）
 describe("今日目标区", () => {
  const raw = JSON.stringify({ zoneId: 2, name: "西区", date: "2026-09-16" });

  it("今天的今日目标可以解析", () => {
    const t = parseTodayZone(raw, "2026-09-16");
    expect(t?.name).toBe("西区");
    expect(t?.zoneId).toBe(2);
  });

  it("未分区也可以是今日目标", () => {
    const t = parseTodayZone(JSON.stringify({ zoneId: "none", name: "未分区", date: "2026-09-16" }), "2026-09-16");
    expect(t?.zoneId).toBe("none");
  });

  it("隔天的今日目标自动失效，坏数据也不还原", () => {
    expect(parseTodayZone(raw, "2026-09-17")).toBeNull();
    expect(parseTodayZone(null, "2026-09-16")).toBeNull();
    expect(parseTodayZone("坏json", "2026-09-16")).toBeNull();
    expect(parseTodayZone(JSON.stringify({ zoneId: 2, name: "西区", date: "2026-09-16", extra: 1 }), "2026-09-16")?.name).toBe("西区");
  });
});
