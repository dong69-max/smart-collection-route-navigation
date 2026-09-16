import { useMemo, useState } from "react";
import { Check, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
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
import { CustomerCard } from "@/components/collection/CustomerCard";
import { CompleteTaskDialog } from "@/components/collection/CompleteTaskDialog";
import { CustomerFormDialog } from "@/components/collection/CustomerFormDialog";
import { useCollection } from "@/lib/collection/store";
import { deleteCustomer, errorText } from "@/lib/collection/api";
import { isOpen, money, type Customer, type TaskStatus } from "@/lib/collection/types";

const FILTERS: Array<{ id: string; label: string }> = [
  { id: "all", label: "全部" },
  { id: "pending", label: "待处理" },
  { id: "in_progress", label: "进行中" },
  { id: "done", label: "已完成" },
  { id: "unpaid", label: "未收款" },
  { id: "partial", label: "部分收款" },
  { id: "not_found", label: "找不到人" },
];

export default function TasksPage() {
  const { customers, refresh, hideCustomer, unhideCustomer, hiddenCustomers, zones, zoneFilter, setZoneFilter } = useCollection();
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [complete, setComplete] = useState<Customer | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  // 多选批量删除
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [batchConfirm, setBatchConfirm] = useState(false);

  // 隐藏的客户不算在今天的任务里（进度、清单都不含）
  const active = useMemo(() => customers.filter((c) => c.hidden !== 1), [customers]);
  const done = active.filter((c) => !isOpen(c)).length;
  const hasUnzoned = customers.some((c) => c.zone_id == null);
  // 每个区有多少客户：只数今天在任务里的（不含隐藏）
  const zoneCount = (zoneId: number | "none") =>
    zoneId === "none"
      ? active.filter((c) => c.zone_id == null).length
      : active.filter((c) => c.zone_id === zoneId).length;

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return active.filter((c) => {
      const matchQ =
        !term ||
        c.name.toLowerCase().includes(term) ||
        (c.phone ?? "").toLowerCase().includes(term) ||
        c.address.toLowerCase().includes(term);
      if (!matchQ) return false;
      const inZone =
        zoneFilter === "all"
          ? true
          : zoneFilter === "none"
            ? c.zone_id == null
            : c.zone_id === zoneFilter;
      if (!inZone) return false;
      if (filter === "all") return true;
      if (filter === "done") return c.status === "done";
      return c.status === (filter as TaskStatus);
    });
  }, [active, filter, q, zoneFilter]);

  const remove = async (id: number) => {
    try {
      await deleteCustomer(id);
      await refresh();
      toast.success("已删除");
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  const listIds = list.map((c) => c._row_id);
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

  const removeBatch = async () => {
    if (selected.size === 0) return;
    try {
      await Promise.all([...selected].map((id) => deleteCustomer(id)));
      await refresh();
      toast.success(`已删除 ${selected.size} 位客户`);
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
          <h1 className="text-xl font-bold">今日任务</h1>
          <div className="flex gap-2">
            {active.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
              >
                {selectMode ? "退出多选" : "多选"}
              </Button>
            )}
            {!selectMode && (
              <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)}>
                <Plus className="mr-1 h-4 w-4" />
                添加
              </Button>
            )}
          </div>
        </div>
        <p className="mt-1 text-sm text-slate-300">
          完成进度 {done} / {active.length}
        </p>
        <Progress
          value={active.length ? (done / active.length) * 100 : 0}
          className="mt-2 h-2 bg-white/20"
        />
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索姓名 / 电话 / 地址"
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
            <span className="text-xs text-slate-300">已选 {selected.size} 位</span>
          </div>
        )}
      </header>

      <div className="flex gap-2 overflow-x-auto px-4 py-3">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${
              filter === f.id ? "bg-sky-600 text-white" : "bg-white text-slate-600"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {zones.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-4 pb-3">
          <button
            onClick={() => setZoneFilter("all")}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium ${
              zoneFilter === "all" ? "border-indigo-600 bg-indigo-600 text-white" : "border-indigo-200 bg-white text-indigo-700"
            }`}
          >
            全部地区-{active.length}
          </button>
          {zones.map((z) => (
            <button
              key={z._row_id}
              onClick={() => setZoneFilter(z._row_id)}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium ${
                zoneFilter === z._row_id ? "border-indigo-600 bg-indigo-600 text-white" : "border-indigo-200 bg-white text-indigo-700"
              }`}
            >
              {z.name}-{zoneCount(z._row_id)}
            </button>
          ))}
          {hasUnzoned && (
            <button
              onClick={() => setZoneFilter("none")}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium ${
                zoneFilter === "none" ? "border-indigo-600 bg-indigo-600 text-white" : "border-indigo-200 bg-white text-indigo-700"
              }`}
            >
              未分区-{zoneCount("none")}
            </button>
          )}
        </div>
      )}

      <div className="space-y-3 px-4 pb-6">
        {!selectMode && list.length === 0 && (
          <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500">没有匹配的客户。</p>
        )}
        {list.map((c) =>
          selectMode ? (
            <div
              key={c._row_id}
              onClick={() => toggle(c._row_id)}
              className={`flex cursor-pointer items-center gap-3 rounded-2xl border bg-white p-4 transition-colors ${
                selected.has(c._row_id) ? "border-rose-400 bg-rose-50" : "border-slate-200"
              }`}
            >
              <button
                type="button"
                aria-label={`选择 ${c.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(c._row_id);
                }}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                  selected.has(c._row_id)
                    ? "border-rose-500 bg-rose-500 text-white"
                    : "border-slate-300 bg-white"
                }`}
              >
                {selected.has(c._row_id) && <Check className="h-4 w-4" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-slate-900">{c.name}</p>
                <p className="truncate text-sm text-slate-500">{c.address}</p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-rose-600">{money(c.amount)}</span>
            </div>
          ) : (
            <CustomerCard
              key={c._row_id}
              customer={c}
              zoneName={c.zone_id != null ? zones.find((z) => z._row_id === c.zone_id)?.name ?? null : null}
              onComplete={setComplete}
              onHide={(x) => void hideCustomer(x._row_id)}
              onDelete={(x) => void remove(x._row_id)}
            />
          ),
        )}

        {hiddenCustomers.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="text-sm font-bold text-slate-700">
              🙈 已隐藏 {hiddenCustomers.length} 位客户（今天不去）
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">想去了随时恢复，客户不会被删除。</p>
            <ul className="mt-3 space-y-2">
              {hiddenCustomers.map((c) => (
                <li key={c._row_id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate text-slate-600">
                    {c.name} · {money(c.amount)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0"
                    onClick={() => void unhideCustomer(c._row_id)}
                  >
                    恢复显示
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}
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

      <AlertDialog open={batchConfirm} onOpenChange={setBatchConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除所选的 {selected.size} 位客户？</AlertDialogTitle>
            <AlertDialogDescription>
              将永久删除这 {selected.size} 位客户及其任务信息，删除后无法恢复。
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

      <CustomerFormDialog open={addOpen} onOpenChange={setAddOpen} />
      <CompleteTaskDialog
        customer={complete}
        open={complete !== null}
        onOpenChange={(v) => !v && setComplete(null)}
      />
    </div>
  );
}
