import { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { errorText, geocodeAddresses, insertCustomer } from "@/lib/collection/api";
import { useCollection } from "@/lib/collection/store";
import { todayKey } from "@/lib/collection/types";

interface Row {
  name: string;
  phone: string;
  address: string;
  amount: number;
  priority: number;
  notes: string;
}

function pick(row: Record<string, unknown>, keys: string[]) {
  for (const k of Object.keys(row)) {
    const norm = k.trim().toLowerCase();
    if (keys.includes(norm)) return String(row[k] ?? "").trim();
  }
  return "";
}

export function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { refresh } = useCollection();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<{ ok: number; failed: string[] } | null>(null);

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        "Customer Name": "Ahmad",
        Phone: "0127778888",
        Address: "Taman Molek, Johor Bahru",
        "Outstanding Amount": 1200,
        Priority: "High",
        Notes: "月底再联系",
      },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Customers");
    XLSX.writeFile(wb, "收账客户导入模板.xlsx");
  };

  const handleFile = async (file: File) => {
    setBusy(true);
    setSummary(null);
    setProgress(0);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      const rows: Row[] = raw
        .map((r) => {
          const prio = pick(r, ["priority", "优先级"]).toLowerCase();
          return {
            name: pick(r, ["customer name", "name", "客户姓名", "姓名"]),
            phone: pick(r, ["phone", "电话", "电话号码"]),
            address: pick(r, ["address", "地址"]),
            amount: Number(pick(r, ["outstanding amount", "amount", "欠款金额"]) || 0),
            priority: prio.startsWith("h") || prio === "高" || prio === "1" ? 1 : prio.startsWith("l") || prio === "低" || prio === "3" ? 3 : 2,
            notes: pick(r, ["notes", "备注"]),
          };
        })
        .filter((r) => r.name && r.address);

      if (rows.length === 0) {
        toast.error("文件中没有可识别的客户资料，请使用模板格式。");
        setBusy(false);
        return;
      }

      let ok = 0;
      const failed: string[] = [];
      const chunkSize = 10;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const res = await geocodeAddresses(chunk.map((r) => r.address));
        for (let j = 0; j < chunk.length; j++) {
          const row = chunk[j];
          const hit = res.results[j];
          try {
            await insertCustomer({
              name: row.name,
              phone: row.phone || null,
              address: row.address,
              amount: row.amount,
              priority: row.priority,
              lat: hit?.ok ? (hit.lat ?? null) : null,
              lng: hit?.ok ? (hit.lng ?? null) : null,
              geo_status: hit?.ok ? (hit.precise ? "ok" : "approximate") : "failed",
              status: "pending",
              notes: row.notes || null,
              task_date: todayKey(),
            });
            if (hit?.ok) ok++;
            else failed.push(`${row.name} — ${hit?.error ?? "无法定位"}`);
          } catch (e) {
            failed.push(`${row.name} — ${errorText(e)}`);
          }
        }
        setProgress(Math.round(((i + chunk.length) / rows.length) * 100));
      }
      setSummary({ ok, failed });
      await refresh();
    } catch (e) {
      toast.error(`导入失败：${errorText(e)}`);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>批量导入客户</DialogTitle>
          <DialogDescription>支持 CSV 与 XLSX，导入后自动定位地址。</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button variant="outline" className="h-12 w-full" onClick={downloadTemplate}>
            <Download className="mr-2 h-5 w-5" />
            下载 Excel 模板
          </Button>

          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          <Button className="h-14 w-full text-lg" disabled={busy} onClick={() => fileRef.current?.click()}>
            <Upload className="mr-2 h-5 w-5" />
            {busy ? "处理中…" : "选择文件导入"}
          </Button>

          {busy && <Progress value={progress} />}

          {summary && (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="font-semibold text-emerald-700">成功定位：{summary.ok}</p>
              <p className="font-semibold text-amber-700">需要检查：{summary.failed.length}</p>
              {summary.failed.length > 0 && (
                <ul className="max-h-40 list-disc space-y-1 overflow-y-auto pl-5 text-xs text-slate-600">
                  {summary.failed.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
