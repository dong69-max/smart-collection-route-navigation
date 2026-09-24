import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { content } from "@/lib/shared/kliv-content.js";
import { errorText, insertHistory, updateCustomer } from "@/lib/collection/api";
import { useCollection } from "@/lib/collection/store";
import { STATUS_LABELS, buildShareText, type Customer, type TaskStatus } from "@/lib/collection/types";

const RESULTS: TaskStatus[] = [
  "done",
  "partial",
  "unpaid",
  "not_found",
  "bad_address",
  "refused",
  "other",
];

interface PhotoItem {
  file: File;
  url: string;
}

interface SavedSummary {
  text: string;
  files: File[];
  revisit: boolean;
}

export function CompleteTaskDialog({
  customer,
  open,
  onOpenChange,
}: {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { position, refresh } = useCollection();
  const [result, setResult] = useState<TaskStatus>("done");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  // 家里没人等情况：记录这一趟，但客户回到待收清单，下次再来
  const [revisit, setRevisit] = useState(false);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [saved, setSaved] = useState<SavedSummary | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  // 每次打开弹窗：重置为第一项「已收款」，干净状态优先展示
  useEffect(() => {
    if (open) {
      setResult("done");
      setAmount("");
      setNotes("");
      setRevisit(false);
      setPhotos((prev) => {
        prev.forEach((p) => URL.revokeObjectURL(p.url));
        return [];
      });
      setSaved(null);
    }
  }, [open, customer?._row_id]);

  if (!customer) return null;

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    setPhotos((prev) => {
      const next = [...prev];
      for (const f of Array.from(files)) {
        if (!f.type.startsWith("image/")) continue;
        next.push({ file: f, url: URL.createObjectURL(f) });
      }
      return next;
    });
  };

  const removePhoto = (i: number) => {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[i].url);
      return prev.filter((_, j) => j !== i);
    });
  };

  const chooseResult = (v: string) => {
    setResult(v as TaskStatus);
    // 找不到人：大概率要回访，自动勾上（仍可手动取消）
    if (v === "not_found") setRevisit(true);
  };

  const submit = async () => {
    setSaving(true);
    try {
      const collected =
        result === "done"
          ? amount === ""
            ? customer.amount
            : Number(amount)
          : result === "partial"
            ? Number(amount || 0)
            : 0;
      // 先上传照片：单张失败就跳过，不挡任务记录
      const uploaded: string[] = [];
      for (const p of photos) {
        try {
          const meta = await content.uploadFile(p.file, "visits/");
          uploaded.push(meta.path);
        } catch {
          toast.warning("有一张照片上传失败，已跳过");
        }
      }
      const resultLabel = STATUS_LABELS[result] + (revisit ? "（需再次回访）" : "");
      await updateCustomer(
        customer._row_id,
        revisit
          ? {
              // 回访：记录完这一趟，客户回到待收清单
              status: "pending",
              collected_amount: collected,
              notes: notes || customer.notes,
              pinned_next: 0,
              completed_at: 0,
            }
          : {
              status: result,
              collected_amount: collected,
              notes: notes || customer.notes,
              completed_at: Math.floor(Date.now() / 1000),
              pinned_next: 0,
              // 保留 route_order：已完成客户的地图标记继续显示原拜访序号
            },
      );
      await insertHistory({
        customer_id: customer._row_id,
        customer_name: customer.name,
        result: resultLabel,
        collected_amount: collected,
        notes: notes || null,
        lat: position?.lat ?? null,
        lng: position?.lng ?? null,
        recorded_at: Math.floor(Date.now() / 1000),
        photos: uploaded.length > 0 ? JSON.stringify(uploaded) : null,
      });
      await refresh();
      setSaved({
        text: buildShareText({
          name: customer.name,
          address: customer.address,
          resultLabel,
          collected,
          notes,
          at: new Date(),
        }),
        files: photos.map((p) => p.file),
        revisit,
      });
      toast.success(revisit ? "已记录，客户已回到待收清单" : "已完成，剩余站点保持原顺序");
    } catch (e) {
      toast.error(`保存失败：${errorText(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const shareNative = async () => {
    if (!saved) return;
    const nav = navigator as Navigator & { canShare?: (d: { files?: File[] }) => boolean };
    try {
      if (typeof nav.share === "function") {
        // 手机上会弹出分享面板（微信/WhatsApp 都在里面），照片随文字一起发
        if (saved.files.length > 0 && nav.canShare?.({ files: saved.files })) {
          await nav.share({ text: saved.text, files: saved.files });
        } else {
          await nav.share({ text: saved.text });
        }
        return;
      }
    } catch {
      return; // 用户取消分享
    }
    await copyText();
  };

  const shareWhatsapp = () => {
    if (!saved) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(saved.text)}`, "_blank");
  };

  const copyText = async () => {
    if (!saved) return;
    try {
      await navigator.clipboard.writeText(saved.text);
      toast.success("文字已复制，去微信粘贴即可");
    } catch {
      toast.error("复制失败，请手动选择上方文字复制");
    }
  };

  const close = () => {
    setPhotos((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.url));
      return [];
    });
    setSaved(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        {saved ? (
          <>
            <DialogHeader>
              <DialogTitle>{saved.revisit ? "已记录 · 待回访 🔁" : "已完成 ✅"}</DialogTitle>
              <DialogDescription>把这单记录发给上司/同事交差：</DialogDescription>
            </DialogHeader>
            <pre className="max-h-52 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              {saved.text}
              {saved.files.length > 0 ? `\n📷 照片 ${saved.files.length} 张（分享时一并发送）` : ""}
            </pre>
            <div className="grid gap-2">
              <Button className="h-14 text-lg" onClick={() => void shareNative()}>
                📤 分享（微信 / WhatsApp / 更多）
              </Button>
              <Button variant="outline" className="h-12" onClick={shareWhatsapp}>
                💬 直接发 WhatsApp（仅文字）
              </Button>
              <Button variant="ghost" className="h-11 text-slate-500" onClick={() => void copyText()}>
                复制文字（去微信粘贴）
              </Button>
              <Button variant="outline" className="h-12" onClick={close}>
                完成
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>完成任务</DialogTitle>
              <DialogDescription>
                客户：{customer.name} · 欠款 RM {customer.amount}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label className="mb-2 block text-sm font-semibold">收账结果</Label>
                <RadioGroup
                  value={result}
                  onValueChange={chooseResult}
                  className="grid grid-cols-2 gap-2"
                >
                  {RESULTS.map((r, i) => (
                    <label
                      key={r}
                      className={`flex items-center gap-2 rounded-lg border p-2.5 text-sm ${
                        result === r ? "border-sky-500 bg-sky-50" : "border-slate-200"
                      } ${i === RESULTS.length - 1 && RESULTS.length % 2 === 1 ? "col-span-2" : ""}`}
                    >
                      <RadioGroupItem value={r} id={`res-${r}`} />
                      {STATUS_LABELS[r]}
                    </label>
                  ))}
                </RadioGroup>
              </div>

              {(result === "done" || result === "partial") && (
                <div>
                  <Label htmlFor="collected" className="mb-1 block text-sm font-semibold">
                    实际收款金额 (RM)
                  </Label>
                  <Input
                    id="collected"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={String(customer.amount)}
                    className="h-12 text-lg"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="note" className="mb-1 block text-sm font-semibold">
                  备注（可不填）
                </Label>
                <Textarea id="note" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
              </div>

              <div>
                <Label className="mb-2 block text-sm font-semibold">
                  现场照片（可多张，可不拍）
                </Label>
                <input
                  ref={photoRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    addPhotos(e.target.files);
                    if (photoRef.current) photoRef.current.value = "";
                  }}
                />
                <Button
                  variant="outline"
                  className="h-12 w-full"
                  onClick={() => photoRef.current?.click()}
                  disabled={saving}
                >
                  <Camera className="mr-2 h-5 w-5" />
                  拍照 / 添加照片
                </Button>
                {photos.length > 0 && (
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {photos.map((p, i) => (
                      <div key={p.url} className="relative">
                        <img
                          src={p.url}
                          alt={`照片 ${i + 1}`}
                          className="h-20 w-full rounded-lg object-cover"
                        />
                        <button
                          type="button"
                          aria-label={`删除照片 ${i + 1}`}
                          onClick={() => removePhoto(i)}
                          className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white shadow"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <label className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
                <Checkbox
                  checked={revisit}
                  onCheckedChange={(v) => setRevisit(v === true)}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-semibold">🔁 需要再次回访</span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    保存后这位客户会回到待收清单，下次继续去（适合家里没人的情况）。
                  </span>
                </span>
              </label>

              <Button onClick={submit} disabled={saving} className="h-14 w-full text-lg">
                {saving ? "保存中…" : "确认完成"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
