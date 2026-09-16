import { useState } from "react";
import { toast } from "sonner";
import { Hexagon, MapPin, Pencil, Trash2 } from "lucide-react";
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
  updateZone,
} from "@/lib/collection/api";
import { useCollection } from "@/lib/collection/store";
import { ZONE_MAX_KM, zoneKeywords, zonePolygon, type Zone } from "@/lib/collection/types";
import { ZonePolygonEditor } from "./ZonePolygonEditor";

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
  const [keywords, setKeywords] = useState("");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<Zone | null>(null);
  const [editing, setEditing] = useState<Zone | null>(null);
  const [editKw, setEditKw] = useState("");
  const [savingKw, setSavingKw] = useState(false);
  const [editingPoly, setEditingPoly] = useState<Zone | null>(null);
  const [savingPoly, setSavingPoly] = useState(false);

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
        keywords: keywords.trim(),
      });
      await reloadZones();
      await reclassifyAll();
      toast.success(`已添加「${name.trim()}」，客户已自动分区`);
      setName("");
      setAddress("");
      setKeywords("");
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

  const startEdit = (z: Zone) => {
    setEditingPoly(null);
    setEditing(z);
    setEditKw(z.keywords ?? "");
  };

  const saveKw = async () => {
    if (!editing) return;
    setSavingKw(true);
    try {
      await updateZone(editing._row_id, { keywords: editKw.trim() });
      await reloadZones();
      await reclassifyAll();
      toast.success(`「${editing.name}」的包含地区已更新，客户已重新分区`);
      setEditing(null);
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setSavingKw(false);
    }
  };

  const startEditPoly = (z: Zone) => {
    setEditing(null);
    setEditingPoly(z);
  };

  const savePoly = async (z: Zone, polygonJson: string) => {
    setSavingPoly(true);
    try {
      await updateZone(z._row_id, { polygon: polygonJson });
      await reloadZones();
      await reclassifyAll();
      toast.success(`「${z.name}」的边界已更新，客户已按新边界重新分区`);
      setEditingPoly(null);
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setSavingPoly(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>分区管理</DialogTitle>
            <DialogDescription>
              客户地址定位成坐标后，坐标落在哪个区的边界内就归哪个区；
              不在任何边界内时按地址地名对号，再按最近区中心（{ZONE_MAX_KM}km 内）兜底。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {zones.length > 0 ? (
              <ul className="space-y-2">
                {zones.map((z) => {
                  const kws = zoneKeywords(z);
                  const poly = zonePolygon(z);
                  return (
                    <li key={z._row_id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                            <MapPin className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">
                              {z.name} · {countOf(z._row_id)} 位客户
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              边界：{poly.length >= 3 ? `${poly.length} 边形` : "未画（用地名/最近中心）"}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              editingPoly?._row_id === z._row_id ? setEditingPoly(null) : startEditPoly(z)
                            }
                            aria-label={`编辑${z.name}边界`}
                          >
                            <Hexagon className="h-4 w-4 text-sky-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              editing?._row_id === z._row_id ? setEditing(null) : startEdit(z)
                            }
                            aria-label={`编辑${z.name}包含地区`}
                          >
                            <Pencil className="h-4 w-4 text-slate-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setRemoving(z)}
                            aria-label={`删除${z.name}`}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                      {editingPoly?._row_id === z._row_id && (
                        <ZonePolygonEditor
                          zone={z}
                          saving={savingPoly}
                          onCancel={() => setEditingPoly(null)}
                          onSave={(json) => void savePoly(z, json)}
                        />
                      )}
                      {editing?._row_id === z._row_id ? (
                        <div className="mt-2 space-y-2 border-t border-slate-100 pt-2">
                          <Label htmlFor={`kw-${z._row_id}`}>
                            包含地区（逗号分隔，地址含这些地名就归入本区）
                          </Label>
                          <Textarea
                            id={`kw-${z._row_id}`}
                            rows={3}
                            value={editKw}
                            onChange={(e) => setEditKw(e.target.value)}
                            placeholder="Senai, Kulai, Bandar Putra…"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => void saveKw()} disabled={savingKw}>
                              {savingKw ? "保存中…" : "保存并重新分区"}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                              取消
                            </Button>
                          </div>
                        </div>
                      ) : (
                        editingPoly?._row_id !== z._row_id &&
                        kws.length > 0 && (
                          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-500">
                            包含：{kws.join("、")}
                          </p>
                        )
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
                还没有区。例如添加「东区」填 Taman Molek，添加后系统会自动把客户按地址分到对应的区。
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
              <div>
                <Label htmlFor="zkw">包含地区（逗号分隔，可不填）</Label>
                <Textarea
                  id="zkw"
                  rows={2}
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="Permas Jaya, Taman Molek, Johor Jaya…"
                />
              </div>
              <Button onClick={add} disabled={busy} className="h-12 w-full">
                {busy ? "定位中…" : "添加并自动分区"}
              </Button>
            </div>

            {zones.length > 0 && (
              <Button variant="outline" className="h-12 w-full" onClick={() => void reclassifyAll()}>
                重新自动分区（按边界/地址重新归类）
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
