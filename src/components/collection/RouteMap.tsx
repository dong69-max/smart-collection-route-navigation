import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import type { Base } from "./BaseDialog";
import { displaySeq, groupSameSpot, type Coords, type Customer } from "@/lib/collection/types";

const ZONE_COLORS = ["#0284c7", "#7c3aed", "#059669", "#d97706", "#dc2626", "#db2777", "#0891b2"];

function pinIcon(color: string, label: string, star: boolean) {
  // 标签可能是多个编号（如 1·2）：宽度自适应，不再把后面的图钉叠住
  const w = Math.max(30, label.length * 10 + 14);
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;align-items:center;justify-content:center;min-width:30px;width:${w}px;height:30px;padding:0 5px;border-radius:999px;background:${color};color:#fff;font-size:11px;font-weight:700;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">${star ? "★" : label}</div>`,
    iconSize: [w, 30],
    iconAnchor: [w / 2, 15],
  });
}

export function RouteMap({
  customers,
  position,
  nextId,
  onSelect,
  base,
  orderedIds,
  zoneOverlays,
  height = 320,
}: {
  customers: Customer[];
  position: Coords | null;
  nextId?: number;
  onSelect?: (c: Customer) => void;
  base?: Base | null;
  orderedIds?: number[];
  zoneOverlays?: Array<{ name: string; poly: Array<[number, number]> }>;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  const points = useMemo(
    () => customers.filter((c) => c.lat != null && c.lng != null),
    [customers],
  );

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { zoomControl: false, attributionControl: false }).setView(
      [1.4927, 103.7414],
      12,
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const bounds: L.LatLngExpression[] = [];

    // 各区边界（淡色多边形，只是示意，不参与缩放范围）
    (zoneOverlays ?? []).forEach((zo, i) => {
      if (zo.poly.length >= 3) {
        L.polygon(zo.poly, {
          color: ZONE_COLORS[i % ZONE_COLORS.length],
          weight: 1.5,
          opacity: 0.5,
          fillOpacity: 0.05,
          dashArray: "4 6",
        })
          .bindTooltip(`📍 ${zo.name}`)
          .addTo(layer);
      }
    });

    if (position) {
      L.marker([position.lat, position.lng], {
        icon: pinIcon("#2563eb", "我", false),
      })
        .bindPopup("当前位置")
        .addTo(layer);
      bounds.push([position.lat, position.lng]);
    }

    if (base) {
      L.marker([base.lat, base.lng], {
        icon: pinIcon("#4f46e5", "家", false),
      })
        .bindPopup(`<div style="font-size:13px"><b>🏠 大本营</b><br/>${base.address}</div>`)
        .addTo(layer);
      bounds.push([base.lat, base.lng]);
    }

    // 同一地点多位客户（如同一地址两个欠款人）：合并成一个图钉，
    // 编号并列显示（如 1·2），弹窗列出每个人——不再有人被叠在下面看不见
    groupSameSpot(points).forEach((g) => {
      const items = g.items;
      const anyOpen = items.some(({ c }) => ["pending", "in_progress"].includes(c.status));
      const allDone = !anyOpen;
      const isNext = items.some(({ c }) => c._row_id === nextId);
      const color = allDone
        ? "#16a34a"
        : isNext
          ? "#0ea5e9"
          : items.some(({ c }) => c.priority === 1)
            ? "#f59e0b"
            : "#dc2626";
      // 编号固定不变：规划时写下的 route_order 就是终身号码
      const labels = items
        .map(({ c, idx }) => displaySeq(c, idx + 1))
        .filter((s): s is number => s != null)
        .map(String);
      const label = labels.length > 0 ? labels.join("·") : allDone ? "✓" : String(items[0].idx + 1);
      const popupRows = items
        .map(({ c, idx }) => {
          const seq = displaySeq(c, idx + 1);
          const done = !["pending", "in_progress"].includes(c.status);
          return `<div style="margin-top:6px"><b>${seq != null ? `第 ${seq} 站 · ` : ""}${done ? "✅ " : ""}${c.name}</b><br/>${c.address}<br/>欠款 RM ${c.amount}${c.geo_status === "approximate" ? '<br/>📍 坐标：大致位置（自动填入，建议核对）' : ""}</div>`;
        })
        .join("");
      const m = L.marker([g.lat, g.lng], {
        icon: pinIcon(color, label, anyOpen && items.some(({ c }) => c.priority === 1)),
      }).addTo(layer);
      m.bindPopup(
        `<div style="font-size:13px">${items.length > 1 ? `<b>📍 ${items.length} 位客户在同一地点</b>` : ""}${popupRows}</div>`,
      );
      if (onSelect && items.length === 1) m.on("click", () => onSelect(items[0].c));
      bounds.push([g.lat, g.lng]);
    });

    // 按拜访顺序画路线：起点（实时定位，无则大本营）→ 各站 → 大本营
    const visitSeq = (orderedIds ?? [])
      .map((id) => points.find((c) => c._row_id === id))
      .filter((c): c is Customer => Boolean(c));
    if (visitSeq.length > 0) {
      const start = position ?? base;
      const line: L.LatLngExpression[] = [];
      if (start) line.push([start.lat, start.lng]);
      visitSeq.forEach((c) => line.push([c.lat as number, c.lng as number]));
      if (base) line.push([base.lat, base.lng]);
      if (line.length > 1) {
        L.polyline(line, {
          color: "#0ea5e9",
          weight: 4,
          opacity: 0.75,
          dashArray: "8 10",
        }).addTo(layer);
      }
    }

    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds).pad(0.25), { maxZoom: 15 });
    }
    setTimeout(() => map.invalidateSize(), 120);
  }, [base, points, position, nextId, onSelect, orderedIds, zoneOverlays]);

  // zIndex: 0 建立独立图层上下文：地图内部的瓦片/标记/缩放按钮
  // （内部层级可到 1000）都被限制在地图区域内，弹窗永远显示在地图之上。
  return <div ref={ref} style={{ height, zIndex: 0 }} className="relative w-full rounded-xl" />;
}
