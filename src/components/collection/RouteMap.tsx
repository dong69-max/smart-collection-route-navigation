import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import type { Base } from "./BaseDialog";
import type { Coords, Customer } from "@/lib/collection/types";

function pinIcon(color: string, label: string, star: boolean) {
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:${color};color:#fff;font-size:12px;font-weight:700;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">${star ? "★" : label}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

export function RouteMap({
  customers,
  position,
  nextId,
  onSelect,
  base,
  orderedIds,
  height = 320,
}: {
  customers: Customer[];
  position: Coords | null;
  nextId?: number;
  onSelect?: (c: Customer) => void;
  base?: Base | null;
  orderedIds?: number[];
  height?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  const points = useMemo(
    () => customers.filter((c) => c.lat != null && c.lng != null),
    [customers],
  );

  // 拜访顺序：优先用当前规划（从实时定位/大本营出发算出的顺序）
  const seqById = useMemo(() => {
    const m = new Map<number, number>();
    (orderedIds ?? []).forEach((id, i) => m.set(id, i + 1));
    return m;
  }, [orderedIds]);

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

    points.forEach((c, i) => {
      const done = !["pending", "in_progress"].includes(c.status);
      const isNext = c._row_id === nextId;
      const color = done ? "#16a34a" : isNext ? "#0ea5e9" : c.priority === 1 ? "#f59e0b" : "#dc2626";
      // 编号：当前规划顺序优先；已完成客户用保留的原拜访序号；都没有则已完成显示 ✓
      const seq = seqById.get(c._row_id) ?? c.route_order ?? null;
      const label = seq != null ? String(seq) : done ? "✓" : String(i + 1);
      const m = L.marker([c.lat as number, c.lng as number], {
        icon: pinIcon(color, label, c.priority === 1 && !done),
      }).addTo(layer);
      m.bindPopup(
        `<div style="font-size:13px"><b>${seq != null ? `第 ${seq} 站 · ` : ""}${done ? "✅ " : ""}${c.name}</b><br/>${c.address}<br/>欠款 RM ${c.amount}</div>`,
      );
      if (onSelect) m.on("click", () => onSelect(c));
      bounds.push([c.lat as number, c.lng as number]);
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
  }, [base, points, position, nextId, onSelect, seqById, orderedIds]);

  // zIndex: 0 建立独立图层上下文：地图内部的瓦片/标记/缩放按钮
  // （内部层级可到 1000）都被限制在地图区域内，弹窗永远显示在地图之上。
  return <div ref={ref} style={{ height, zIndex: 0 }} className="relative w-full rounded-xl" />;
}
