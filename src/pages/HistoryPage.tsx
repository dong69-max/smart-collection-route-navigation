import { useMemo, useState } from "react";
import { Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
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
import { deleteHistory, errorText } from "@/lib/collection/api";
import { useCollection } from "@/lib/collection/store";
import { money, type HistoryRow } from "@/lib/collection/types";

function fmt(ts: number | null) {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function HistoryPage() {
  const { history, refresh } = useCollection();
  const [q, setQ] = useState("");
  const [toDelete, setToDelete] = useState<HistoryRow | null>(null);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return history;
    return history.filter(
      (h) =>
        (h.customer_name ?? "").toLowerCase().includes(t) ||
        (h.result ?? "").toLowerCase().includes(t) ||
        (h.notes ?? "").toLowerCase().includes(t),
    );
  }, [history, q]);

  const totalCollected = history.reduce((a, h) => a + (h.collected_amount ?? 0), 0);

  const remove = async (row: HistoryRow) => {
    try {
      await deleteHistory(row._row_id);
      await refresh();
      toast.success("记录已删除");
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setToDelete(null);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="bg-slate-900 px-4 pb-4 pt-8 text-white">
        <h1 className="text-xl font-bold">收账历史</h1>
        <p className="mt-1 text-sm text-slate-300">
          共 {history.length} 笔记录 · 累计收款 {money(totalCollected)}
        </p>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索客户 / 结果 / 备注"
            className="h-12 border-0 bg-white/10 pl-9 text-white placeholder:text-slate-400"
          />
        </div>
      </header>

      <div className="space-y-3 px-4 py-4">
        {list.length === 0 && (
          <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500">还没有记录。</p>
        )}
        {list.map((h) => (
          <div key={h._row_id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="font-bold text-slate-900">{h.customer_name}</p>
              <span className="text-xs text-slate-400">{fmt(h.recorded_at)}</span>
            </div>
            <p className="mt-1 text-sm text-slate-600">结果：{h.result}</p>
            <p className="text-sm font-semibold text-emerald-600">
              收款：{money(h.collected_amount)}
            </p>
            {h.notes && <p className="mt-1 text-xs text-slate-500">备注：{h.notes}</p>}
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 text-rose-500"
              onClick={() => setToDelete(h)}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              删除
            </Button>
          </div>
        ))}
      </div>

      <AlertDialog open={toDelete !== null} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这条记录？</AlertDialogTitle>
            <AlertDialogDescription>
              将删除「{toDelete?.customer_name}」在 {fmt(toDelete?.recorded_at ?? null)} 的收账记录，删除后无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => toDelete && void remove(toDelete)}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
