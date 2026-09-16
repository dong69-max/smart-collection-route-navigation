import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { Button } from "@/components/ui/button";
import { zonePolygon, type Zone } from "@/lib/collection/types";

// 地图画边界：点一下地图加一个顶点，点顶点可删，至少 3 个顶点围成一个区
export function ZonePolygonEditor({
  zone,
  onSave,
  onCancel,
  saving,
}: {
  zone: Zone;
  onSave: (polygonJson: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const [pts, setPts] = useState<Array<[number, number]>>(() => zonePolygon(zone));

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const init: [number, number] =
      pts[0] ??
      (zone.lat != null && zone.lng != null ? [zone.lat, zone.lng] : [1.4927, 103.7414]);
    const map = L.map(ref.current, { zoomControl: true, attributionControl: false }).setView(init, 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) => {
      setPts((prev) => [...prev, [e.latlng.lat, e.latlng.lng]]);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (zone.lat != null && zone.lng != null) {
      L.circleMarker([zone.lat, zone.lng], { radius: 7, color: "#4f46e5", fillOpacity: 0.9 })
        .bindTooltip("区中心")
        .addTo(layer);
    }
    pts.forEach((p, i) => {
      L.circleMarker(p, { radius: 6, color: "#0284c7", fillOpacity: 1 })
        .bindTooltip(`顶点 ${i + 1}（点击删除）`)
        .on("click", (e) => {
          L.DomEvent.stopPropagation(e as unknown as Event);
          setPts((prev) => prev.filter((_, j) => j !== i));
        })
        .addTo(layer);
    });
    if (pts.length >= 3) {
      L.polygon(pts, { color: "#0284c7", weight: 2, fillOpacity: 0.12 }).addTo(layer);
    }
  }, [pts, zone.lat, zone.lng]);

  return (
    <div className="mt-2 space-y-2 border-t border-slate-100 pt-2">
      <p className="text-xs text-slate-500">
        在地图上点一下加一个顶点（点已有顶点可删除），至少 3 个顶点围成边界。
        保存后所有客户会按新边界重新分区。
      </p>
      <div
        ref={ref}
        style={{ height: 260, zIndex: 0 }}
        className="relative w-full rounded-xl border border-slate-200"
      />
      <p className="text-xs text-slate-600">
        当前顶点：{pts.length} 个
        {pts.length < 3 ? `（还差 ${3 - pts.length} 个才能围成边界）` : ""}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setPts((p) => p.slice(0, -1))} disabled={pts.length === 0}>
          撤销一点
        </Button>
        <Button size="sm" variant="outline" onClick={() => setPts([])} disabled={pts.length === 0}>
          清除
        </Button>
        <Button size="sm" onClick={() => onSave(JSON.stringify(pts))} disabled={pts.length < 3 || saving}>
          {saving ? "保存中…" : "保存边界并重新分区"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          取消
        </Button>
      </div>
    </div>
  );
}
