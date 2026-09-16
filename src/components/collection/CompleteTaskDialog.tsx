import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { errorText, insertHistory, updateCustomer } from "@/lib/collection/api";
import { useCollection } from "@/lib/collection/store";
import { STATUS_LABELS, type Customer, type TaskStatus } from "@/lib/collection/types";

const RESULTS: TaskStatus[] = [
  "done",
  "partial",
  "unpaid",
  "not_found",
  "bad_address",
  "refused",
  "other",
];

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

  // 每次打开弹窗：重置为第一项「已收款」，干净状态优先展示
  useEffect(() => {
    if (open) {
      setResult("done");
      setAmount("");
      setNotes("");
    }
  }, [open, customer?._row_id]);

  if (!customer) return null;

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
      await updateCustomer(customer._row_id, {
        status: result,
        collected_amount: collected,
        notes: notes || customer.notes,
        completed_at: Math.floor(Date.now() / 1000),
        pinned_next: 0,
        // 保留 route_order：已完成客户的地图标记继续显示原拜访序号
      });
      await insertHistory({
        customer_id: customer._row_id,
        customer_name: customer.name,
        result: STATUS_LABELS[result],
        collected_amount: collected,
        notes: notes || null,
        lat: position?.lat ?? null,
        lng: position?.lng ?? null,
        recorded_at: Math.floor(Date.now() / 1000),
      });
      await refresh();
      onOpenChange(false);
      setAmount("");
      setNotes("");
      setResult("done");
      toast.success("已完成，剩余站点保持原顺序");
    } catch (e) {
      toast.error(`保存失败：${errorText(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
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
              onValueChange={(v) => setResult(v as TaskStatus)}
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

          <Button onClick={submit} disabled={saving} className="h-14 w-full text-lg">
            {saving ? "保存中…" : "确认完成"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
