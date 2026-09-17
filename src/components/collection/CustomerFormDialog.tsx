import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, MapPin } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { errorText, geocodeAddresses, insertCustomer, updateCustomer } from "@/lib/collection/api";
import { useCollection } from "@/lib/collection/store";
import { assignZone, isDuplicateCustomer, todayKey, type Customer } from "@/lib/collection/types";
import { MapPicker } from "./MapPicker";

export function CustomerFormDialog({
  open,
  onOpenChange,
  editCustomer = null,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  // 传入则进入编辑模式（可修正地址/坐标等信息）
  editCustomer?: Customer | null;
}) {
  const { refresh, zones, customers } = useCollection();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [priority, setPriority] = useState("2");
  const [notes, setNotes] = useState("");
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [geoError, setGeoError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // 发现同名同地址的重复客户时先确认再保存
  const [dupConfirm, setDupConfirm] = useState(false);
  // 地址无法精确识别时自动填入的大致坐标（未被修改时保存后标记「坐标」）
  const [autoCoords, setAutoCoords] = useState<{ lat: number; lng: number; matched: string | null } | null>(null);
  // 地图点选修正
  const [mapOpen, setMapOpen] = useState(false);

  const isEdit = editCustomer != null;

  useEffect(() => {
    if (!open) return;
    if (editCustomer) {
      setName(editCustomer.name);
      setPhone(editCustomer.phone ?? "");
      setAddress(editCustomer.address);
      setAmount(String(editCustomer.amount ?? ""));
      setPriority(String(editCustomer.priority ?? 2));
      setNotes(editCustomer.notes ?? "");
      if (editCustomer.lat != null && editCustomer.lng != null) {
        setManualLat(String(editCustomer.lat));
        setManualLng(String(editCustomer.lng));
      }
      // 定位不准的老客户：直接展开地图修正
      if (editCustomer.geo_status === "approximate" || editCustomer.lat == null) setMapOpen(true);
    } else {
      setName("");
      setPhone("");
      setAddress("");
      setAmount("");
      setPriority("2");
      setNotes("");
      setManualLat("");
      setManualLng("");
    }
    setGeoError(null);
    setAutoCoords(null);
    setMapOpen(false);
    setDupConfirm(false);
  }, [open, editCustomer]);

  const save = async (force = false) => {
    if (!name.trim() || !address.trim()) {
      toast.error("请填写客户姓名与地址。");
      return;
    }
    // 重复检测：同名+同地址才提醒；同名不同地址（两间家）直接放行；编辑自己不算重复
    if (!force && !isEdit && isDuplicateCustomer(name, address, customers)) {
      setDupConfirm(true);
      return;
    }
    setDupConfirm(false);
    setSaving(true);
    setGeoError(null);
    try {
      let lat: number | null = null;
      let lng: number | null = null;
      let geoStatus = "manual";

      if (manualLat && manualLng) {
        lat = Number(manualLat);
        lng = Number(manualLng);
        if (Number.isNaN(lat) || Number.isNaN(lng)) {
          setGeoError("手动坐标格式不正确。");
          setSaving(false);
          return;
        }
        // 自动填入且未修改 → 大致坐标（保存后带「坐标」标记）；用户改过/点选 → 手动坐标
        geoStatus =
          autoCoords && Number(manualLat) === autoCoords.lat && Number(manualLng) === autoCoords.lng
            ? "approximate"
            : "manual";
      } else {
        const res = await geocodeAddresses([address.trim()]);
        const hit = res.results[0];
        if (!hit?.ok) {
          setGeoError(hit?.error ?? "无法准确识别地址，请检查地址。");
          setSaving(false);
          return;
        }
        lat = hit.lat as number;
        lng = hit.lng as number;
        if (hit.precise) {
          geoStatus = "ok";
        } else {
          // 无法精确识别：自动填入大致坐标，核对/微调后再保存（保存后带「坐标」标记）
          setManualLat(String(hit.lat));
          setManualLng(String(hit.lng));
          setAutoCoords({ lat: hit.lat as number, lng: hit.lng as number, matched: hit.matched ?? null });
          setGeoError(
            `地址无法精确定位${hit.matched ? `，已按「${hit.matched}」` : "，已"}自动填入大致坐标。` +
              "保存后此客户会带「坐标」标记，可现在微调坐标后保存。",
          );
          setMapOpen(true);
          setSaving(false);
          toast.info("已自动填入大致坐标，请核对或点地图修正后保存");
          return;
        }
      }

      // 自动分区：先看地址里的地名，对不上再按坐标归最近的区
      const zone = assignZone(zones, address.trim(), lat as number, lng as number);
      const data = {
        name: name.trim(),
        phone: phone.trim() || null,
        address: address.trim(),
        amount: Number(amount || 0),
        priority: Number(priority),
        lat,
        lng,
        geo_status: geoStatus,
        notes: notes.trim() || null,
        zone_id: zone?._row_id ?? null,
      };

      if (isEdit && editCustomer) {
        await updateCustomer(editCustomer._row_id, data);
        await refresh();
        toast.success(
          "已保存修改" +
            (zone ? `，自动归入${zone.name}` : "") +
            (geoStatus === "manual" ? "（位置按你点选的坐标）" : ""),
        );
        onOpenChange(false);
      } else {
        await insertCustomer({
          ...data,
          status: "pending",
          task_date: todayKey(),
        });
        await refresh();
        toast.success(
          (geoStatus === "approximate" ? "已添加（坐标为大标位置，卡片带「坐标」标记）" : "客户已添加") +
            (zone ? `，自动归入${zone.name}` : ""),
        );
        onOpenChange(false);
      }
    } catch (e) {
      setGeoError(errorText(e));
      toast.error(errorText(e));
    } finally {
      setSaving(false);
    }
  };

  const pickerMarker =
    manualLat && manualLng && !Number.isNaN(Number(manualLat)) && !Number.isNaN(Number(manualLng))
      ? { lat: Number(manualLat), lng: Number(manualLng) }
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "编辑客户" : "添加客户"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "可修改资料，或在地图上点选修正位置——宿舍楼、新开发区等地图查不到的地址用这招最准。"
              : "地址会通过真实地图服务转换为 GPS 坐标。"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="cname">客户姓名 *</Label>
            <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} className="h-12" />
          </div>
          <div>
            <Label htmlFor="cphone">电话号码</Label>
            <Input id="cphone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-12" />
          </div>
          <div>
            <Label htmlFor="caddr">地址 *</Label>
            <Textarea id="caddr" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="camt">欠款金额 (RM)</Label>
              <Input id="camt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-12" />
            </div>
            <div>
              <Label>优先级</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">高</SelectItem>
                  <SelectItem value="2">中</SelectItem>
                  <SelectItem value="3">低</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="cnotes">备注</Label>
            <Textarea id="cnotes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {/* 地图点选修正位置 */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <button
              type="button"
              className="flex w-full items-center justify-between text-sm font-semibold text-sky-700"
              onClick={() => setMapOpen((v) => !v)}
            >
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {mapOpen ? "收起地图选点" : "定位不准？点地图修正位置"}
              </span>
              <span className="text-xs font-normal text-slate-400">
                {pickerMarker ? `${pickerMarker.lat.toFixed(5)}, ${pickerMarker.lng.toFixed(5)}` : "未设置"}
              </span>
            </button>
            {mapOpen && (
              <div className="mt-3">
                <MapPicker
                  marker={pickerMarker}
                  center={pickerMarker}
                  onPick={(lat, lng) => {
                    setManualLat(String(lat));
                    setManualLng(String(lng));
                    setAutoCoords(null);
                    toast.success("已选中位置，记得按「保存」生效");
                  }}
                />
              </div>
            )}
          </div>

          {geoError && (
            <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="flex items-start gap-2 font-medium">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {geoError}
              </p>
              <p className="text-xs">可在上方地图点选准确位置，或手动填写坐标（Google Maps 长按地点可复制经纬度）。</p>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="纬度 latitude" value={manualLat} onChange={(e) => setManualLat(e.target.value)} />
                <Input placeholder="经度 longitude" value={manualLng} onChange={(e) => setManualLng(e.target.value)} />
              </div>
            </div>
          )}

          <Button onClick={() => void save()} disabled={saving} className="h-14 w-full text-lg">
            {saving ? "定位中…" : autoCoords ? "保存（用上方坐标）" : isEdit ? "保存修改" : "保存客户"}
          </Button>
        </div>
      </DialogContent>

      <AlertDialog open={dupConfirm} onOpenChange={setDupConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>这位客户已存在？</AlertDialogTitle>
            <AlertDialogDescription>
              「{name.trim()}」在「{address.trim()}」已有一条记录。确认重复请取消；如果是同一人在不同地址（两间家）不会触发此提醒，可放心保存。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => void save(true)}>仍要保存</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
