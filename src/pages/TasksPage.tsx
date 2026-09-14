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
import { isOpen, type Customer, type TaskStatus } from "@/lib/collection/types";

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
  const { customers, refresh, setNextStop } = useCollection();
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [complete, setComplete] = useState<Customer | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const done = customers.filter((c) => !isOpen(c)).length;

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return customers.filter((c) => {
      const matchQ =
        !term ||
        c.name.toLowerCase().includes(term) ||
        (c.phone ?? "").toLowerCase().includes(term) ||
        c.address.toLowerCase().includes(term);
      if (!matchQ) return false;
      if (filter === "all") return true;
      if (filter === "done") return c.status === "done";
      return c.status === (filter as TaskStatus);
    });
  }, [customers, filter, q]);

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
          完成进度 {done} / {customers.length}
        </p>
        <Progress
          value={customers.length ? (done / customers.length) * 100 : 0}
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

      <div className="space-y-3 px-4 pb-6">
        {list.length === 0 && (
          <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500">没有匹配的客户。</p>
        )}
        {list.map((c) => (
          <CustomerCard
            key={c._row_id}
            customer={c}
            onComplete={setComplete}
            onSetNext={(x) => void setNextStop(x._row_id)}
            onDelete={(x) => void remove(x._row_id)}
          />
        ))}
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
