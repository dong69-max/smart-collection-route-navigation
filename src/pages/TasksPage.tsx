import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
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

  // 隐藏的客户不算在今天的任务里（进度、清单都不含）
  const active = useMemo(() => customers.filter((c) => c.hidden !== 1), [customers]);
  const done = active.filter((c) => !isOpen(c)).length;
  const hasUnzoned = customers.some((c) => c.zone_id == null);

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

  return (
    <div className="min-h-screen">
      <header className="bg-slate-900 px-4 pb-4 pt-8 text-white">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">今日任务</h1>
          <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            添加
          </Button>
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
            全部地区
          </button>
          {zones.map((z) => (
            <button
              key={z._row_id}
              onClick={() => setZoneFilter(z._row_id)}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium ${
                zoneFilter === z._row_id ? "border-indigo-600 bg-indigo-600 text-white" : "border-indigo-200 bg-white text-indigo-700"
              }`}
            >
              {z.name}
            </button>
          ))}
          {hasUnzoned && (
            <button
              onClick={() => setZoneFilter("none")}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium ${
                zoneFilter === "none" ? "border-indigo-600 bg-indigo-600 text-white" : "border-indigo-200 bg-white text-indigo-700"
              }`}
            >
              未分区
            </button>
          )}
        </div>
      )}

      <div className="space-y-3 px-4 pb-6">
        {list.length === 0 && (
          <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500">没有匹配的客户。</p>
        )}
        {list.map((c) => (
          <CustomerCard
            key={c._row_id}
            customer={c}
            zoneName={c.zone_id != null ? zones.find((z) => z._row_id === c.zone_id)?.name ?? null : null}
            onComplete={setComplete}
            onHide={(x) => void hideCustomer(x._row_id)}
            onDelete={(x) => void remove(x._row_id)}
          />
        ))}

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

      <CustomerFormDialog open={addOpen} onOpenChange={setAddOpen} />
      <CompleteTaskDialog
        customer={complete}
        open={complete !== null}
        onOpenChange={(v) => !v && setComplete(null)}
      />
    </div>
  );
}
