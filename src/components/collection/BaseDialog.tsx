import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RouteMap } from "./RouteMap";
import { errorText, geocodeAddresses, getSetting, saveSetting } from "@/lib/collection/api";
import type { Coords } from "@/lib/collection/types";

export interface Base {
  address: string;
  lat: number;
  lng: number;
}

export const BASE_KEY = "collection_base";

export function parseBase(raw: string | null): Base | null {
  if (!raw) return null;
  try {
    const b = JSON.parse(raw) as Base;
    if (typeof b.lat === "number" && typeof b.lng === "number") return b;
  } catch {
    /* ignore */
  }
  return null;
}

export function BaseDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: (b: Base) => void;
}) {
  const [address, setAddress] = useState("");
  const [base, setBase] = useState<Base | null>(null);
  const [manual, setManual] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      void getSetting(BASE_KEY).then((raw) => {
        const b = parseBase(raw);
        setBase(b);
        setAddress(b?.address ?? "");
        setError(null);
        setManual("");
      });
    }
  }, [open]);

  const lookup = async () => {
    if (!address.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await geocodeAddresses([address.trim()]);
      const hit = res.results[0];
      if (!hit?.ok) {
        setError(hit?.error ?? "无法准确识别地址，请检查地址。");
        return;
      }
      setBase({ address: address.trim(), lat: hit.lat as number, lng: hit.lng as number });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!base) {
      setError("请先定位大本营地址。");
      return;
    }
    setBusy(true);
    try {
      await saveSetting(BASE_KEY, JSON.stringify(base));
      toast.success("大本营已保存");
      onSaved?.(base);
      onOpenChange(false);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>大本营设置</DialogTitle>
          <DialogDescription>出发和返回都会经过这里，路线最后一段自动指向大本营。</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="baseaddr">大本营地址</Label>
            <Textarea
              id="baseaddr"
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="例如：Jalan Wong Ah Fook 88, Johor Bahru"
            />
          </div>
          <Button className="h-12 w-full" onClick={() => void lookup()} disabled={busy || !address.trim()}>
            <MapPin className="mr-1 h-4 w-4" />
            {busy ? "定位中…" : "定位地址"}
          </Button>

          {base && (
            <div className="space-y-2">
              <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
                ✅ {base.address}（{base.lat.toFixed(5)}, {base.lng.toFixed(5)}）
              </div>
              <RouteMap
                customers={[]}
                position={{ lat: base.lat, lng: base.lng }}
                height={180}
              />
            </div>
          )}

          {error && (
            <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <p>{error}</p>
              <p className="text-xs">可手动填写坐标（Google Maps 长按地点即可复制）。</p>
              <div className="flex gap-2">
                <Input
                  placeholder="纬度,经度"
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  className="h-11"
                />
                <Button
                  variant="outline"
                  className="h-11"
                  onClick={() => {
                    const [a, b] = manual.split(",").map((s) => Number(s.trim()));
                    if (Number.isNaN(a) || Number.isNaN(b) || !address.trim()) {
                      setError("请填写地址与正确的「纬度,经度」。");
                      return;
                    }
                    setError(null);
                    setBase({ address: address.trim(), lat: a, lng: b });
                  }}
                >
                  使用
                </Button>
              </div>
            </div>
          )}

          <Button className="h-14 w-full text-lg" onClick={() => void save()} disabled={busy || !base}>
            保存大本营
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function baseDistanceLabel(base: Base, position: Coords | null) {
  if (!position) return null;
  // 仅展示提示用途，不用于路线计算
  return `${base.address}`;
}
