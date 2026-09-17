import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";

const ICON = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export const JB_CENTER = { lat: 1.5, lng: 103.75 };

/**
 * 地图点选：在地图上点一下（或拖动图钉）选准确位置，按「使用此位置」回调。
 * 用于系统定位不准时（如校内宿舍楼），手动把客户位置钉到正确的楼栋。
 */
export function MapPicker({
  center,
  marker,
  onPick,
}: {
  center?: { lat: number; lng: number } | null;
  marker?: { lat: number; lng: number } | null;
  onPick: (lat: number, lng: number) => void;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(marker ?? null);

  useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    const c = center ?? marker ?? JB_CENTER;
    const map = L.map(divRef.current, {
      center: [c.lat, c.lng],
      zoom: marker ? 17 : 14,
      attributionControl: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    if (marker) {
      markerRef.current = L.marker([marker.lat, marker.lng], { icon: ICON, draggable: true }).addTo(map);
      markerRef.current.on("dragend", () => {
        const p = markerRef.current?.getLatLng();
        if (p) setPicked({ lat: p.lat, lng: p.lng });
      });
    }
    map.on("click", (e: L.LeafletMouseEvent) => {
      const pos = { lat: e.latlng.lat, lng: e.latlng.lng };
      setPicked(pos);
      if (markerRef.current) {
        markerRef.current.setLatLng(e.latlng);
      } else {
        markerRef.current = L.marker(e.latlng, { icon: ICON, draggable: true }).addTo(map);
        markerRef.current.on("dragend", () => {
          const p = markerRef.current?.getLatLng();
          if (p) setPicked({ lat: p.lat, lng: p.lng });
        });
      }
    });
    mapRef.current = map;
    // 弹窗里初始化后容器尺寸可能还没定，强制重算
    setTimeout(() => map.invalidateSize(), 200);
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-2">
      <div ref={divRef} className="h-64 w-full overflow-hidden rounded-lg border border-slate-200" />
      <p className="flex items-center gap-1 text-xs text-slate-500">
        <MapPin className="h-3.5 w-3.5" />
        在地图上点一下（或拖动图钉）选准确位置
        {picked && (
          <span className="ml-auto font-mono text-slate-400">
            {picked.lat.toFixed(5)}, {picked.lng.toFixed(5)}
          </span>
        )}
      </p>
      <Button
        className="h-11 w-full"
        disabled={!picked}
        onClick={() => picked && onPick(picked.lat, picked.lng)}
      >
        使用此位置
      </Button>
    </div>
  );
}
