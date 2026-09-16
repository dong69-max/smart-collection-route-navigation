import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, RefreshCw, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { errorText, geocodeAddresses, insertCustomer } from "@/lib/collection/api";
import { useCollection } from "@/lib/collection/store";
import { assignZone, isDuplicateCustomer, todayKey, type Zone } from "@/lib/collection/types";

// ---- OCR 识别 ----
// tesseract.js 从 CDN 引入（识别引擎与英文语言包也从它的 CDN 加载，无需打包进应用）
type TesseractLike = {
  recognize: (
    image: File | string,
    lang: string,
    opts?: Record<string, unknown>,
  ) => Promise<{ data: { text: string } }>;
};

async function loadTesseract(): Promise<TesseractLike> {
  const w = window as unknown as { Tesseract?: TesseractLike };
  if (w.Tesseract) return w.Tesseract;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("文字识别组件加载失败，请检查网络后重试。"));
    document.head.appendChild(s);
  });
  if (!w.Tesseract) throw new Error("文字识别组件加载失败。");
  return w.Tesseract;
}

// OCR 常见误读修正：0↔O、1↔I、l↔1（在地址里数字更常见）
function fixOcrLine(line: string): string {
  return line
    .replace(/[|]/g, "I")
    .replace(/[`´’']/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export interface ParsedLetter {
  name: string;
  address: string;
  isCompany: boolean;
}

// 解析信件文字：住家信「TO: 名字 / 地址」与公司信「公司名 / 地址 / Remark: 客户名」
// 步骤：先找 Remark → 公司信；再找 TO: → 住家信；都没有就按行数猜。
export function parseLetterText(rawText: string): ParsedLetter | null {
  const lines = rawText
    .split(/\r?\n/)
    .map(fixOcrLine)
    .filter((l) => l.length > 1); // 去掉 OCR 噪点

  if (lines.length === 0) return null;

  // Remark: xxx → 公司信，Remark 后面是客户名字
  const remarkIdx = lines.findIndex((l) => /^\s*(remark|remarks|attn|attention)\b\s*[:.]/i.test(l));
  const remarkName = remarkIdx >= 0
    ? lines[remarkIdx].replace(/^\s*(remark|remarks|attn|attention)\b\s*[:.]\s*/i, "").trim()
    : null;

  // TO: xxx → 住家信，TO 后面是客户名字
  const toIdx = lines.findIndex((l) => /^\s*to\b\s*[:.]/i.test(l));
  const toName = toIdx >= 0
    ? lines[toIdx].replace(/^\s*to\b\s*[:.]\s*/i, "").trim()
    : null;

  // 地址行：包含数字+路名特征（jalan/taman/lot/no/邮编）或逗号分隔多段
  const isAddressLine = (l: string) =>
    /\b(jalan|jln|taman|tmn|kampung|kg\.|lorong|lebuhraya|persiaran|tingkat|pusat|bandar|senai|masai|skudai|pasir|plentong|tebrau|ulubtram|kempas|road|street|avenue)\b/i.test(l) ||
    (/\d/.test(l) && l.includes(",")) ||
    /^\d{5}\s/.test(l);

  if (remarkName && remarkName.length > 2) {
    // 公司信：公司名 = Remark 行之前不含 TO 的第一行（跳过纯地址行）
    const before = lines
      .slice(0, remarkIdx)
      .filter((l) => !/^\s*to\b\s*[:.]/i.test(l));
    const companyLine =
      before.find((l, i) => i === 0 || (!isAddressLine(l) && before.slice(0, i).some(isAddressLine) === false)) ??
      before[0];
    // 地址 = Remark 前的地址特征行（从公司名行之后找）
    const addrLines = before.filter((l) => l !== companyLine && isAddressLine(l));
    const address = addrLines.join(", ") || before.filter((l) => l !== companyLine).join(", ");
    const name = companyLine?.trim() ?? "";
    if (name && address) return { name, address, isCompany: true };
  }

  if (toName && toName.length > 2) {
    // 住家信：TO 行之后全是地址
    const addrLines = lines.slice(toIdx + 1).filter((l) => !/^\s*(remark|remarks)\b/i.test(l));
    const address = addrLines.join(", ");
    if (address) return { name: toName, address, isCompany: false };
  }

  // 都没识别到标记词：第一行当名字，其余当地址（用户可手动修正）
  if (lines.length >= 2) {
    return { name: lines[0], address: lines.slice(1).join(", "), isCompany: false };
  }
  return null;
}

export function LetterScanDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { refresh, zones, customers } = useCollection();
  const fileRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [stage, setStage] = useState<string>("");
  const [rawText, setRawText] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [isCompany, setIsCompany] = useState(false);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [dupConfirm, setDupConfirm] = useState(false);

  const reset = () => {
    setRawText("");
    setName("");
    setAddress("");
    setIsCompany(false);
    setAmount("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    setScanning(true);
    setStage("正在加载文字识别组件…");
    try {
      const T = await loadTesseract();
      setStage("正在识别信件文字，请稍等（约几秒到十几秒）…");
      const res = await T.recognize(file, "eng");
      const text = res.data.text ?? "";
      setRawText(text);
      const parsed = parseLetterText(text);
      if (!parsed) {
        toast.error("没识别到内容，请拍清楚一点（信件放正、光线充足）。");
      } else {
        setName(parsed.name);
        setAddress(parsed.address);
        setIsCompany(parsed.isCompany);
        toast.success(
          parsed.isCompany
            ? "识别为公司信：公司名与地址已填入，Remark 客户名请手动补到备注"
            : "识别为住家信：名字与地址已填入",
        );
      }
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setScanning(false);
      setStage("");
    }
  };

  const save = async (force = false) => {
    if (!name.trim() || !address.trim()) {
      toast.error("请先识别或填写客户名字与地址。");
      return;
    }
    if (!force && isDuplicateCustomer(name, address, customers)) {
      setDupConfirm(true);
      return;
    }
    setDupConfirm(false);
    setSaving(true);
    try {
      const res = await geocodeAddresses([address.trim()]);
      const hit = res.results[0];
      const lat = hit?.ok ? (hit.lat ?? null) : null;
      const lng = hit?.ok ? (hit.lng ?? null) : null;
      const zone: Zone | null =
        hit?.ok && lat != null && lng != null ? assignZone(zones, address.trim(), lat, lng) : null;
      await insertCustomer({
        name: name.trim(),
        phone: null,
        address: address.trim(),
        amount: Number(amount || 0),
        priority: 2,
        lat,
        lng,
        geo_status: hit?.ok ? (hit.precise ? "ok" : "approximate") : "failed",
        status: "pending",
        notes: isCompany ? "公司信件录入" : "信件录入",
        task_date: todayKey(),
        zone_id: zone?._row_id ?? null,
      });
      await refresh();
      toast.success(
        `已添加${zone ? `，自动归入${zone.name}` : ""}${hit?.ok ? "" : "（地址未能定位，稍后可在客户里修正坐标）"}`,
      );
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>拍照添加客户</DialogTitle>
          <DialogDescription>
            拍摄信件（住家信或公司信），自动识别名字与地址。识别后可核对修改再保存。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          <Button
            className="h-14 w-full text-lg"
            disabled={scanning}
            onClick={() => fileRef.current?.click()}
          >
            {scanning ? <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> : <Camera className="mr-2 h-5 w-5" />}
            {scanning ? "识别中…" : rawText ? "重新拍摄" : "拍摄信件"}
          </Button>
          {stage && <p className="text-center text-sm text-slate-500">{stage}</p>}

          {(name || address) && (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                <ScanLine className="h-3.5 w-3.5" />
                {isCompany ? "识别为公司信，请核对" : "识别为住家信，请核对"}
              </p>
              <div>
                <Label htmlFor="lname">{isCompany ? "公司名字" : "客户姓名"}</Label>
                <Input id="lname" value={name} onChange={(e) => setName(e.target.value)} className="h-12 bg-white" />
              </div>
              <div>
                <Label htmlFor="laddr">地址</Label>
                <Textarea
                  id="laddr"
                  rows={3}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="bg-white"
                />
              </div>
              <div>
                <Label htmlFor="lamt">欠款金额 (RM)</Label>
                <Input
                  id="lamt"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-12 bg-white"
                />
              </div>
              {isCompany && (
                <p className="text-xs text-slate-400">
                  公司信的 Remark 客户名请保存后在客户资料里补充到备注。
                </p>
              )}
              <Button onClick={() => void save()} disabled={saving} className="h-12 w-full">
                {saving ? "定位保存中…" : "确认添加客户"}
              </Button>
            </div>
          )}
        </div>

        <AlertDialog open={dupConfirm} onOpenChange={setDupConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>这位客户已存在？</AlertDialogTitle>
              <AlertDialogDescription>
                「{name.trim()}」在「{address.trim()}」已有一条记录。确认重复请取消；同名不同地址（两间家）不会触发此提醒。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={() => void save(true)}>仍要保存</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
