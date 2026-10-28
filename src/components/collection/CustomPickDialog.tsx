import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Customer } from "@/lib/collection/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  candidates: Customer[];
  selected: number[];
  onSave: (ids: number[]) => void;
}

export function CustomPickDialog({ open, onOpenChange, candidates, selected, onSave }: Props) {
  const [sel, setSel] = useState<number[]>(selected);
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const k = q.trim().toLowerCase();
    return candidates.filter(
      (c) => !k || `${c.name} ${c.code ?? ""} ${c.address ?? ""}`.toLowerCase().includes(k),
    );
  }, [candidates, q]);
  const toggle = (id: number) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setSel(selected);
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-md overflow-hidden p-4">
        <DialogHeader>
          <DialogTitle>选择自定义路线的客户（已选 {sel.length}）</DialogTitle>
        </DialogHeader>
        <Input placeholder="搜索 姓名/编号/地址" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="max-h-[50vh] space-y-1.5 overflow-y-auto">
          {list.map((c) => (
            <label key={c._row_id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-2.5">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5"
                checked={sel.includes(c._row_id)}
                onChange={() => toggle(c._row_id)}
              />
              <span className="min-w-0">
                <span className="block font-bold">
                  {c.code ? `#${c.code} ` : ""}
                  {c.name}
                </span>
                <span className="block text-sm text-slate-500">{c.address}</span>
              </span>
            </label>
          ))}
          {list.length === 0 && <p className="py-6 text-center text-sm text-slate-500">没有找到客户</p>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => setSel([])}>清空</Button>
          <Button
            onClick={() => {
              onSave(sel);
              onOpenChange(false);
            }}
          >
            保存名单
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
