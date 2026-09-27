import { useMemo, useState } from "react";
import { Check, Search, Trash2, X } from "lucide-react";
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
import { money, parseHistoryPhotos, type HistoryRow } from "@/lib/collection/types";

function fmt(ts: number | null) {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function HistoryPage() {
  const { history, refresh } = useCollection();
  const [q, setQ] = useState("");
  const [toDelete, setToDelete] = useState<HistoryRow | null>(null);
  // 多选批量删除
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [batchConfirm, setBatchConfirm] = useState(false);

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
  const listIds = list.map((h) => h._row_id);
  const allSelected = listIds.length > 0 && listIds.every((id) => selected.has(id));

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) listIds.forEach((id) => next.delete(id));
      else listIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

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

  const removeBatch = async () => {
    if (selected.size === 0) return;
    try {
      await Promise.all([...selected].map((id) => deleteHistory(id)));
      await refresh();
      toast.success(`已删除 ${selected.size} 条记录`);
      exitSelectMode();
    } catch (e) {
      toast.error(`删除失败：${errorText(e)}`);
    } finally {
      setBatchConfirm(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="bg-slate-900 px-4 pb-4 pt-8 text-white">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">收账历史</h1>
          {history.length > 0 && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
             className="text-lg">
              {selectMode ? "退出多选" : "多选"}
            </Button>
          )}
        </div>
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
        {selectMode && (
          <div className="mt-3 flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-9 border-white/30 bg-white/10 text-white hover:bg-white/20"
              onClick={toggleAll}
            >
              {allSelected ? "取消全选" : "全选本页结果"}
            </Button>
            <span className="text-xs text-slate-300">已选 {selected.size} 条</span>
          </div>
        )}
      </header>

      <div className="space-y-3 px-4 py-4">
        {list.length === 0 && (
          <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500">还没有记录。</p>
        )}
        {list.map((h) => {
          const isSel = selected.has(h._row_id);
          return (
            <div
              key={h._row_id}
              onClick={() => selectMode && toggle(h._row_id)}
              className={`rounded-2xl border bg-white p-4 transition-colors ${
                isSel ? "border-rose-400 bg-rose-50" : "border-slate-200"
              } ${selectMode ? "cursor-pointer active:scale-[0.99]" : ""}`}
            >
              <div className="flex items-center gap-3">
                {selectMode && (
                  <button
                    type="button"
                    aria-label={`选择 ${h.customer_name ?? "记录"}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(h._row_id);
                    }}
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                      isSel ? "border-rose-500 bg-rose-500 text-white" : "border-slate-300 bg-white"
                    }`}
                  >
                    {isSel && <Check className="h-4 w-4" />}
                  </button>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-900">{h.customer_name}</p>
                    <span className="text-xs text-slate-400">{fmt(h.recorded_at)}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">结果：{h.result}</p>
                  <p className="text-sm font-semibold text-emerald-600">
                    收款：{money(h.collected_amount)}
                  </p>
                  {h.notes && <p className="mt-1 text-sm text-slate-500">备注：{h.notes}</p>}
                  {parseHistoryPhotos(h).length > 0 && (
                    <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                      {parseHistoryPhotos(h).map((p, i) => (
                        <img
                          key={`${h._row_id}-${i}`}
                          src={`${p}?w=200`}
                          alt={`${h.customer_name ?? "客户"} 照片 ${i + 1}`}
                          className="h-20 w-20 shrink-0 cursor-pointer rounded-lg border border-slate-200 object-cover"
                          onClick={() => window.open(`${p}?w=800`, "_blank")}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {!selectMode && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1 text-rose-500"
                  onClick={() => setToDelete(h)}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  删除
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {selectMode && (
        <div className="fixed bottom-20 left-4 right-4 z-[900] flex gap-2">
          <Button
            variant="outline"
            className="h-13 flex-1 bg-white py-3.5 text-base"
            onClick={exitSelectMode}
          >
            <X className="mr-1 h-4 w-4" />
            取消
          </Button>
          <Button
            className="flex-[2] bg-rose-600 py-3.5 text-base hover:bg-rose-700"
            disabled={selected.size === 0}
            onClick={() => setBatchConfirm(true)}
          >
            <Trash2 className="mr-1 h-4 w-4" />
            删除所选（{selected.size}）
          </Button>
        </div>
      )}

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

      <AlertDialog open={batchConfirm} onOpenChange={setBatchConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除所选的 {selected.size} 条记录？</AlertDialogTitle>
            <AlertDialogDescription>
              将永久删除这 {selected.size} 条收账记录，删除后无法恢复，累计收款金额也会相应减少。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => void removeBatch()}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
