import { CheckCircle2, MapPin, Navigation, Phone, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { NavigationChooserDialog } from "./navigation";
import { STATUS_LABELS, money, type Customer } from "@/lib/collection/types";

export function CustomerCard({
  customer,
  index,
  legText,
  onComplete,
  onSetNext,
  onDelete,
}: {
  customer: Customer;
  index?: number;
  legText?: string;
  onComplete?: (c: Customer) => void;
  onSetNext?: (c: Customer) => void;
  onDelete?: (c: Customer) => void;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const open = ["pending", "in_progress"].includes(customer.status);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {index != null && (
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white">
            {String(index).padStart(2, "0")}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-bold text-slate-900">{customer.name}</h3>
            {customer.priority === 1 && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
            {customer.pinned_next === 1 && <Badge className="bg-sky-100 text-sky-700">下一站</Badge>}
          </div>
          <p className="mt-0.5 flex items-start gap-1 text-sm text-slate-500">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-2">{customer.address}</span>
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-rose-600">{money(customer.amount)}</span>
            {legText && <span className="text-slate-500">{legText}</span>}
            {!open && (
              <Badge variant="secondary">{STATUS_LABELS[customer.status]}</Badge>
            )}
            {customer.lat == null && (
              <Badge variant="destructive">未定位</Badge>
            )}
          </div>
          {customer.notes && (
            <p className="mt-1 line-clamp-2 text-xs text-slate-400">备注：{customer.notes}</p>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button className="h-11" onClick={() => setNavOpen(true)}>
          <Navigation className="mr-1 h-4 w-4" />
          开始导航
        </Button>
        {open && onComplete ? (
          <Button variant="outline" className="h-11" onClick={() => onComplete(customer)}>
            <CheckCircle2 className="mr-1 h-4 w-4" />
            完成任务
          </Button>
        ) : (
          <Button
            variant="outline"
            className="h-11"
            disabled={!customer.phone}
            onClick={() => customer.phone && window.open(`tel:${customer.phone}`)}
          >
            <Phone className="mr-1 h-4 w-4" />
            拨打电话
          </Button>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        {open && onSetNext && (
          <Button variant="ghost" size="sm" className="flex-1 text-slate-500" onClick={() => onSetNext(customer)}>
            设为下一站
          </Button>
        )}
        {customer.phone && open && (
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 text-slate-500"
            onClick={() => window.open(`tel:${customer.phone}`)}
          >
            打电话
          </Button>
        )}
        {onDelete && (
          <Button variant="ghost" size="sm" className="flex-1 text-rose-500" onClick={() => setDelOpen(true)}>
            <Trash2 className="mr-1 h-4 w-4" />
            删除客户
          </Button>
        )}
      </div>
      <NavigationChooserDialog customer={customer} open={navOpen} onOpenChange={setNavOpen} />
      <AlertDialog open={delOpen} onOpenChange={setDelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这位客户？</AlertDialogTitle>
            <AlertDialogDescription>
              将永久删除「{customer.name}」及其任务信息，无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => {
                setDelOpen(false);
                onDelete?.(customer);
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
