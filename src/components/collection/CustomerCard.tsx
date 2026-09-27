import { CheckCircle2, EyeOff, MapPin, Navigation, Pencil, Phone, Star, Trash2 } from "lucide-react";
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
  zoneName,
  onComplete,
  onHide,
  onDelete,
  onEdit,
}: {
  customer: Customer;
  index?: number;
  legText?: string;
  zoneName?: string | null;
  onComplete?: (c: Customer) => void;
  onHide?: (c: Customer) => void;
  onDelete?: (c: Customer) => void;
  onEdit?: (c: Customer) => void;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const open = ["pending", "in_progress"].includes(customer.status);
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ">
      <div className="flex items-start gap-3">
        {index != null && (
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-sm font-extrabold text-white shadow-sm shadow-sky-600/30">
            {String(index).padStart(2, "0")}
          </span>
        )}
        <div className="min-w-0 flex-1   ">
          {/* 编号 + 名字：最醒目的一行 */}
          <div className="flex items-start gap-2">
            {customer.code && (
              <span className="mt-0.5 shrink-0 rounded-lg bg-slate-900 px-2 py-0.5 font-mono text-[13px] font-bold tracking-wide text-white">
                #{customer.code}
              </span>
            )}
            <h3 className="line-clamp-2 break-words text-lg font-extrabold leading-snug tracking-tight text-slate-900">
              {customer.name}
            </h3>
            {customer.priority === 1 && <Star className="mt-1 h-4 w-4 shrink-0 fill-amber-400 text-amber-400" />}
          </div>
          <p className="mt-1.5 flex items-start gap-1.5 text-[15px] font-medium leading-snug text-slate-600">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <span className="line-clamp-2">{customer.address}</span>
          </p>

          {/* 金额等次要信息收进分隔线下方，不抢视线 */}
          <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-t border-slate-100 pt-2.5">
            <span className="text-base font-extrabold tabular-nums text-rose-600">{money(customer.amount)}</span>
            {customer.pinned_next === 1 && <Badge className="bg-sky-100 text-sky-700">下一站</Badge>}
            {zoneName && <Badge variant="outline" className="border-slate-200 text-slate-50 bg-primary">{zoneName}</Badge>}
            {customer.geo_status === "approximate" && (
              <Badge
                variant="outline"
                className="border-amber-200 bg-amber-50 text-amber-700"
                title="坐标为自动填入的大致位置，建议核对"
              >
                坐标
              </Badge>
            )}
            {legText && <span className="text-[13px] text-slate-400">{legText}</span>}
            {!open && <Badge variant="secondary">{STATUS_LABELS[customer.status]}</Badge>}
            {customer.lat == null && <Badge variant="destructive">未定位</Badge>}
          </div>
          {customer.notes && <p className="mt-2 line-clamp-2 text-base text-amber-500">备注：{customer.notes}</p>}
        </div>
      </div>

      <div className="mt-3.5 grid grid-cols-2 gap-2.5">
        <Button className="h-12 text-base font-semibold" onClick={() => setNavOpen(true)}>
          <Navigation className="mr-1.5 h-5 w-5" />
          开始导航
        </Button>
        {open && onComplete ? (
          <Button
            className="h-12 bg-emerald-600 text-base font-semibold text-white shadow-sm shadow-emerald-600/30 hover:bg-emerald-700"
            onClick={() => onComplete(customer)}
          >
            <CheckCircle2 className="mr-1.5 h-5 w-5" />
            完成任务
          </Button>
        ) : (
          <Button
            variant="outline"
            className="h-12 text-base font-semibold"
            disabled={!customer.phone}
            onClick={() => customer.phone && window.open(`tel:${customer.phone}`)}
          >
            <Phone className="mr-1.5 h-5 w-5" />
            拨打电话
          </Button>
        )}
      </div>
      {/* 低频操作收成一行小字 */}
      <div className="mt-1.5 flex gap-1">
        {onEdit && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 flex-1 text-xs text-slate-500"
            onClick={() => onEdit(customer)}
          >
            <Pencil className="mr-1 h-3.5 w-3.5" />
            编辑 / 修正位置
          </Button>
        )}
        {open && onHide && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 flex-1 text-xs text-slate-500"
            onClick={() => onHide(customer)}
          >
            <EyeOff className="mr-1 h-3.5 w-3.5" />
            隐藏此客户
          </Button>
        )}
        {customer.phone && open && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 flex-1 text-xs text-slate-500"
            onClick={() => window.open(`tel:${customer.phone}`)}
          >
            打电话
          </Button>
        )}
        {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 flex-1 text-xs text-rose-400 hover:text-rose-600"
            onClick={() => setDelOpen(true)}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
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
