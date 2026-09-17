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
  ) => Promise<{ data: { text: string; confidence: number } }>;
};

async function loadTesseract(): Promise<TesseractLike> {
  const w = window as unknown as { Tesseract?: TesseractLike };
  if (w.Tesseract) return w.Tesseract;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("文字识别组件加载失败，请检查网络后重试。"));
    document.head.appendChild(s);
  });
  if (!w.Tesseract) throw new Error("文字识别组件加载失败。");
  return w.Tesseract;
}

// 图像预处理：手机拍的照片直接识别效果差（字小、光照不均），
// 先放大到足够宽度、灰度化、对比度拉伸、再按大津法二值化成黑白图，识别率会明显提升。
async function preprocessImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const targetW = Math.max(1600, Math.min(bitmap.width * 2, 2400));
    const scale = targetW / bitmap.width;
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法处理图片。");
    // 白底：避免照片透明区域变黑
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;

    // 灰度 + 统计直方图（为对比度拉伸和二值化做准备）
    const gray = new Uint8ClampedArray(w * h);
    const hist = new Array<number>(256).fill(0);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
      gray[p] = g;
      hist[g]++;
    }
    // 对比度拉伸：去掉两端各 0.5% 的极端像素
    const total = w * h;
    const cut = Math.floor(total * 0.005);
    let lo = 0;
    let hi = 255;
    let acc = 0;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc > cut) {
        lo = v;
        break;
      }
    }
    acc = 0;
    for (let v = 255; v >= 0; v--) {
      acc += hist[v];
      if (acc > cut) {
        hi = v;
        break;
      }
    }
    if (hi <= lo) {
      lo = 0;
      hi = 255;
    }
    // 大津法求二值化阈值（在拉伸后的灰度上）
    const stretch = (g: number) => Math.min(255, Math.max(0, Math.round(((g - lo) / (hi - lo)) * 255)));
    const hist2 = new Array<number>(256).fill(0);
    for (let p = 0; p < gray.length; p++) hist2[stretch(gray[p])]++;
    let sum = 0;
    for (let v = 0; v < 256; v++) sum += v * hist2[v];
    let sumB = 0;
    let wB = 0;
    let best = 0;
    let thresh = 128;
    for (let v = 0; v < 256; v++) {
      wB += hist2[v];
      if (wB === 0) continue;
      const wF = total - wB;
      if (wF === 0) break;
      sumB += v * hist2[v];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > best) {
        best = between;
        thresh = v;
      }
    }
    // 二值化输出：黑字白底
    for (let p = 0, i = 0; p < gray.length; p++, i += 4) {
      const v = stretch(gray[p]) > thresh ? 255 : 0;
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL("image/png");
  } finally {
    bitmap.close();
  }
}

// OCR 常见误读修正：竖线→I、重音符去掉、多个空格压成一个
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

// 「TO:」的各种 OCR 误读：TO / T0 / TD / TQ / T口 后跟冒号或点
const TO_RE = /^\s*(to|t0|td|tq|ta)\s*[:.>]\s*/i;
// 「Remark:」的各种误读：REMARK / RERNARK / RE MAR K / ATTN / ATTENTION / ATIEN
const RE_RE = /^\s*(remark|remarks|rernark|re ?marks?|attn|attention|atien|atiention)\s*[:.]\s*/i;

// 解析信件文字：公司信（Remark）/ 住家信（TO:）/ 都没有就按行猜
export function parseLetterText(rawText: string): ParsedLetter | null {
  const lines = rawText
    .split(/\r?\n/)
    .map(fixOcrLine)
    .filter((l) => l.length > 1); // 去掉 OCR 噪点

  if (lines.length === 0) return null;

  const remarkIdx = lines.findIndex((l) => RE_RE.test(l));
  const remarkName = remarkIdx >= 0 ? lines[remarkIdx].replace(RE_RE, "").trim() : null;

  const toIdx = lines.findIndex((l) => TO_RE.test(l));
  const toName = toIdx >= 0 ? lines[toIdx].replace(TO_RE, "").trim() : null;

  // 地址行特征：马来西亚路名关键词 / 带数字且多段逗号 / 邮编开头
  const isAddressLine = (l: string) =>
    /\b(jalan|jln|taman|tmn|kampung|kg|lorong|lebuhraya|persiaran|tingkat|pusat|bandar|senai|masai|skudai|pasir|plentong|tebrau|ulutiram|tiram|kempas|larkin|dahlia|serangkai|pancasila|titiwangsa|tampoi|road|street|avenue|johor|darul)\b/i.test(l) ||
    (/\d/.test(l) && (l.match(/,/g)?.length ?? 0) >= 1) ||
    /^\d{5}\b/.test(l);

  if (remarkName && remarkName.length > 2) {
    // 公司信：公司名 = Remark 之前的第一个非地址行；地址 = 其余地址特征行
    const before = lines
      .slice(0, remarkIdx)
      .filter((l) => !TO_RE.test(l));
    const companyLine = before.find((l) => !isAddressLine(l)) ?? before[0];
    const addrLines = before.filter((l) => l !== companyLine && isAddressLine(l));
    const address = addrLines.join(", ") || before.filter((l) => l !== companyLine).join(", ");
    if (companyLine && address) {
      return { name: companyLine.trim(), address, isCompany: true };
    }
  }

  if (toName && toName.length > 2) {
    // 住家信：TO 行之后全是地址
    const addrLines = lines.slice(toIdx + 1).filter((l) => !RE_RE.test(l));
    const address = addrLines.join(", ");
    if (address) return { name: toName, address, isCompany: false };
  }

  // 没有标记词：第一行当名字，其余当地址（用户可手动修正）
  if (lines.length >= 2) {
    return { name: lines[0], address: lines.slice(1).join(", "), isCompany: false };
  }
  return null;
}

// 用不同排版模式各试一遍：信件是整齐的文本块，先按「单一文本块」识别，
// 结果不好（置信度低或解析不出）再按「单列文本」重试
async function ocrWithRetry(T: TesseractLike, image: string) {
  const attempts: Array<{ psm: string; label: string }> = [
    { psm: "6", label: "文本块" },
    { psm: "4", label: "单列文本" },
    { psm: "3", label: "整页自动" },
  ];
  let lastText = "";
  for (const a of attempts) {
    const res = await T.recognize(image, "eng", {
      tessedit_pageseg_mode: a.psm,
      preserve_interword_spaces: "1",
    });
    const text = res.data.text ?? "";
    const parsed = parseLetterText(text);
    // 置信度可以（≥60）且解析出了名字和地址就收工
    if (parsed && parsed.name.length > 2 && parsed.address.length > 6 && (res.data.confidence ?? 0) >= 60) {
      return { text, parsed, mode: a.label };
    }
    if (!lastText || text.trim().length > lastText.trim().length) lastText = text;
  }
  return { text: lastText, parsed: parseLetterText(lastText), mode: "" };
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
  const [stage, setStage] = useState("");
  const [rawText, setRawText] = useState("");
  const [showRaw, setShowRaw] = useState(false);
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
    setShowRaw(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    setScanning(true);
    setStage("正在加载文字识别组件…");
    try {
      const T = await loadTesseract();
      setStage("正在优化照片（放大、增强对比度）…");
      const image = await preprocessImage(file);
      setStage("正在识别信件文字（约几秒到十几秒）…");
      const { text, parsed, mode } = await ocrWithRetry(T, image);
      setRawText(text);
      if (parsed) {
        setName(parsed.name);
        setAddress(parsed.address);
        setIsCompany(parsed.isCompany);
        toast.success(
          (parsed.isCompany ? "识别为公司信" : "识别为住家信") +
            (mode ? `（${mode}模式）` : "") +
            "，请核对后保存",
        );
      } else if (text.trim().length > 0) {
        // 有文字但拆不出名字/地址：把文字放进地址栏让用户手动分
        setAddress(text.split(/\r?\n/).filter(Boolean).join(", "));
        setShowRaw(true);
        toast.info("识别到了文字但没能自动拆分，请手动修正名字和地址。");
      } else {
        toast.error(
          "没识别到内容。请让信件占满画面、放正、光线充足（避免反光），离近一点再拍一张。",
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

          {(name || address || rawText) && (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                <ScanLine className="h-3.5 w-3.5" />
                {isCompany ? "识别为公司信，请核对" : "请核对名字与地址"}
              </p>
              <div>
                <Label htmlFor="lname">{isCompany ? "公司名字" : "客户姓名"}</Label>
                <Input
                  id="lname"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="识别不到时请手动输入"
                  className="h-12 bg-white"
                />
              </div>
              <div>
                <Label htmlFor="laddr">地址</Label>
                <Textarea
                  id="laddr"
                  rows={3}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="识别不到时请手动输入"
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
              {rawText && (
                <div>
                  <button
                    type="button"
                    className="text-xs font-medium text-sky-700 underline underline-offset-2"
                    onClick={() => setShowRaw((v) => !v)}
                  >
                    {showRaw ? "收起识别原文" : "查看识别原文（可对照手动修正）"}
                  </button>
                  {showRaw && (
                    <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded border border-slate-200 bg-white p-2 text-xs text-slate-600">
                      {rawText || "（无文字）"}
                    </pre>
                  )}
                </div>
              )}
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
