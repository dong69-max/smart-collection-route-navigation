import { useState } from "react";
import { toast } from "sonner";
import { MapPin, Trash2 } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  deleteZone,
  errorText,
  geocodeAddresses,
  insertZone,
  updateCustomer,
} from "@/lib/collection/api";
import { useCollection } from "@/lib/collection/store";
import { ZONE_MAX_KM, type Zone } from "@/lib/collection/types";

export function ZoneDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { zones, customers, reloadZones, refresh, reclassifyAll } = useCollection();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<Zone | null>(null);

  const countOf = (zoneId: number) =>
    customers.filter((c) => c.zone_id === zoneId).length;

  const add = async () => {
    if (!name.trim() || !address.trim()) {
      toast.error("请填写区名与中心地址（区的代表地点）。");
      return;
    }
    setBusy(true);
    try {
      const res = await geocodeAddresses([address.trim()]);
      const hit = res.results[0];
      if (!hit?.ok || hit?.lat == null || hit?.lng == null) {
        toast.error(hit?.error ?? "无法定位这个区的地址，请写详细一些（如 Taman Molek, Johor Bahru）。");
        return;
      }
      await insertZone({
        name: name.trim(),
        address: address.trim(),
        lat: hit.lat as number,
        lng: hit.lng as number,
      });
      await reloadZones();
      await reclassifyAll();
      toast.success(`已添加「${name.trim()}」，客户已自动分区`);
      setName("");
      setAddress("");
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!removing) return;
    try {
      const affected = customers.filter((c) => c.zone_id === removing._row_id);
      await Promise.all(
        affected.map((c) => updateCustomer(c._row_id, { zone_id: null })),
      );
      await deleteZone(removing._row_id);
      await reloadZones();
      await refresh();
      toast.success(`已删除「${removing.name}」，该区客户变为未分区`);
    } catch (e) {
      toast.error(`删除失败：${errorText(e)}`);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>分区管理（自动分东/南/西区）</DialogTitle>
            <DialogDescription>
              每个区填一个代表地址即可。新客户按地址自动归入最近的区（{ZONE_MAX_KM}
              km 内），收账时可选「今天专收某区」。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {zones.length > 0 ? (
              <ul className="space-y-2">
                {zones.map((z) => (
                  <li
                    key={z._row_id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 p-3"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                        <MapPin className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {z.name} · {countOf(z._row_id)} 位客户
                        </p>
                        <p className="truncate text-xs text-slate-500">{z.address}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setRemoving(z)}
                      aria-label={`删除${z.name}`}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
                还没有区。例如添加「东区」填 Taman Molek、「南区」填 Permas Jaya，
                添加后系统会自动把客户按地址分到最近的区。
              </p>
            )}

            <div className="space-y-3 rounded-lg border border-slate-200 p-3">
              <p className="text-sm font-semibold">添加新区</p>
              <div>
                <Label htmlFor="zname">区名（如：东区）</Label>
                <Input
                  id="zname"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12"
                  placeholder="东区"
                />
              </div>
              <div>
                <Label htmlFor="zaddr">这个区的中心地址</Label>
                <Input
                  id="zaddr"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="h-12"
                  placeholder="Taman Molek, Johor Bahru"
                />
              </div>
              <Button onClick={add} disabled={busy} className="h-12 w-full">
                {busy ? "定位中…" : "添加并自动分区"}
              </Button>
            </div>

            {zones.length > 0 && (
              <Button variant="outline" className="h-12 w-full" onClick={() => void reclassifyAll()}>
                重新自动分区（地址改动后使用）
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={removing != null} onOpenChange={(v) => !v && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除「{removing?.name}」？</AlertDialogTitle>
            <AlertDialogDescription>
              该区的客户会变为「未分区」，不会删除客户资料。可以之后再重新自动分区。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => void remove()}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}