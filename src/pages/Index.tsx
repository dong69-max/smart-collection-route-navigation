import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Brain, Camera, Crosshair, MapPin, PartyPopper, Plus, Upload, AlertTriangle } from "lucide-react";
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
import { CustomerFormDialog } from "@/components/collection/CustomerFormDialog";
import { ImportDialog } from "@/components/collection/ImportDialog";
import { CompleteTaskDialog } from "@/components/collection/CompleteTaskDialog";
import { NavigationChooserDialog } from "@/components/collection/navigation";
import { BaseDialog } from "@/components/collection/BaseDialog";
import { ZoneDialog } from "@/components/collection/ZoneDialog";
import { LetterScanDialog } from "@/components/collection/LetterScanDialog";
import { useCollection } from "@/lib/collection/store";
import { isOpen, km, mins, money, type Customer } from "@/lib/collection/types";

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl bg-white/10 p-3">
      <p className="text-xs text-sky-100">{label}</p>
      <p className={`mt-1 text-xl font-bold ${tone ?? "text-white"}`}>{value}</p>
    </div>
  );
}

export default function Index() {
  const {
    customers,
    positionLabel,
    positionError,
    locating,
    locate,
    setManualPosition,
    plan,
    planning,
    planError,
    planRoute,
    nearby,
    todayZone,
    orderedOpen,
    base,
    reloadBase,
    endDay,
  } = useCollection();
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [complete, setComplete] = useState<Customer | null>(null);
  const [navCustomer, setNavCustomer] = useState<Customer | null>(null);
  const [baseOpen, setBaseOpen] = useState(false);
  const [navBaseOpen, setNavBaseOpen] = useState(false);
  const [zoneOpen, setZoneOpen] = useState(false);
  const [endDayOpen, setEndDayOpen] = useState(false);
  const [manual, setManual] = useState("");

  // 隐藏的客户不进首页统计；定了今日目标区后只看这个区
  const active = customers.filter((c) => c.hidden !== 1);
  const scoped = todayZone
    ? active.filter((c) =>
        todayZone.zoneId === "none" ? c.zone_id == null : c.zone_id === todayZone.zoneId,
      )
    : active;
  const total = scoped.length;
  const openCount = scoped.filter(isOpen).length;
  const doneCount = total - openCount;
  const collected = scoped.reduce((a, c) => a + (c.collected_amount ?? 0), 0);
  const outstanding = scoped.filter(isOpen).reduce((a, c) => a + c.amount, 0);
  const progress = total === 0 ? 0 : Math.round((doneCount / total) * 100);
  const returnText = base && plan?.return_leg
    ? `返回大本营：${km(plan.return_leg.distance_m)} · 约 ${mins(plan.return_leg.duration_s)}`
    : null;
  const ungeocoded = useMemo(
    () => active.filter((c) => isOpen(c) && c.lat == null).length,
    [active],
  );

  return (
    <div className="min-h-screen">
      <header className="rounded-b-3xl bg-gradient-to-br from-sky-700 via-sky-600 to-cyan-500 px-4 pb-6 pt-8 text-white shadow-lg">
        <p className="text-xs uppercase tracking-widest text-sky-100">智能收账路线导航</p>
        <p className="mt-2 flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4" />
          <span className="truncate">{positionLabel}</span>
        </p>
        {base && (
          <button
            onClick={() => setNavBaseOpen(true)}
            className="mt-1 flex items-center gap-1 text-left text-xs font-semibold text-sky-50 underline underline-offset-2"
          >
            🏠 导航到大本营：{base.address}
          </button>
        )}
        {todayZone && (
          <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/15 px-3 py-2">
            <p className="text-sm font-bold">🎯 今日目标：{todayZone.name}</p>
            <p className="text-xs text-sky-100">剩余 {openCount} 家</p>
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label={todayZone ? `今日任务·${todayZone.name}` : "今日任务"} value={`${total}`} />
          <Stat label="已完成" value={`${doneCount}`} tone="text-emerald-200" />
          <Stat label="剩余" value={`${openCount}`} tone="text-amber-200" />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Stat label="预计驾驶距离" value={plan ? km(plan.total_distance_m) : "—"} />
          <Stat label="预计驾驶时间" value={plan ? mins(plan.total_duration_s) : "—"} />
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-xs text-sky-100">
            <span>完成进度</span>
            <span>
              {doneCount} / {total}
            </span>
          </div>
          <Progress value={progress} className="mt-1 h-2 bg-white/20" />
        </div>
        {returnText && <p className="mt-2 text-xs text-sky-100">{returnText}</p>}
      </header>

      <main className="space-y-4 px-4 pt-4">
        <div className="grid gap-2">
          <Button className="h-14 text-lg" onClick={() => void locate()} disabled={locating}>
            <Crosshair className="mr-2 h-5 w-5" />
            {locating ? "定位中…" : "获取当前位置"}
          </Button>
          <Button
            className="h-14 bg-slate-900 text-lg text-white hover:bg-slate-800"
            onClick={() => void planRoute()}
            disabled={planning}
          >
            <Brain className="mr-2 h-5 w-5" />
            {planning ? "计算真实道路路线中…" : "智能规划路线"}
          </Button>
        </div>

        {positionError && (
          <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {positionError}
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="手动起点：纬度,经度"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                className="h-11"
              />
              <Button
                className="h-11"
                onClick={() => {
                  const [a, b] = manual.split(",").map((s) => Number(s.trim()));
                  if (Number.isNaN(a) || Number.isNaN(b)) return;
                  setManualPosition({ lat: a, lng: b });
                  setManual("");
                }}
              >
                使用
              </Button>
            </div>
          </div>
        )}

        {planError && (
          <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">
            {planError}
          </div>
        )}

        {ungeocoded > 0 && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            有 {ungeocoded} 位客户地址未能定位，路线不会包含他们。请到「任务」页检查地址。
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-12" onClick={() => setScanOpen(true)}>
            <Camera className="mr-1 h-5 w-5" />
            拍照添加
          </Button>
          <Button variant="outline" className="h-12" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1 h-5 w-5" />
            添加客户
          </Button>
        </div>
        <Button variant="outline" className="h-12 w-full" onClick={() => setImportOpen(true)}>
          <Upload className="mr-1 h-5 w-5" />
          批量导入（Excel）
        </Button>

        <Button variant="outline" className="h-12 w-full" onClick={() => setBaseOpen(true)}>
          🏠 设置大本营（出发与返回）
        </Button>

        <Button variant="outline" className="h-12 w-full text-indigo-700" onClick={() => setZoneOpen(true)}>
          🗺️ 分区管理（自动分东/南/西区，可选今天专收某区）
        </Button>

        {nearby.length > 0 && (
          <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
            <p className="text-sm font-semibold text-sky-900">附近还有 {nearby.length} 个任务</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {nearby.map(({ customer, km: d }) => (
                <li key={customer._row_id} className="flex justify-between">
                  <span className="truncate">{customer.name}</span>
                  <span className="text-slate-500">{d.toFixed(1)} km</span>
                </li>
              ))}
            </ul>
            <Button variant="outline" className="mt-3 h-11 w-full" onClick={() => void planRoute()}>
              重新规划路线
            </Button>
          </section>
        )}

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">下一站</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("/route")}>
              查看完整路线
            </Button>
          </div>
          {orderedOpen.length === 0 ? (
            <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500">
              今天还没有待处理客户，先添加或导入客户吧。
            </p>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-lg font-bold text-slate-900">{orderedOpen[0].name}</p>
              <p className="mt-1 text-sm text-slate-500">{orderedOpen[0].address}</p>
              <p className="mt-1 text-sm font-semibold text-rose-600">
                {money(orderedOpen[0].amount)}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button className="h-12" onClick={() => setNavCustomer(orderedOpen[0])}>
                  开始导航
                </Button>
                <Button variant="outline" className="h-12" onClick={() => setComplete(orderedOpen[0])}>
                  完成任务
                </Button>
              </div>
            </div>
          )}
        </section>

        <div className="rounded-2xl bg-white p-4 text-sm text-slate-600">
          <div className="flex justify-between">
            <span>今日已收</span>
            <span className="font-semibold text-emerald-600">{money(collected)}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span>剩余欠款</span>
            <span className="font-semibold text-rose-600">{money(outstanding)}</span>
          </div>
          {doneCount > 0 && (
            <Button
              variant="outline"
              className="mt-3 h-12 w-full text-indigo-700"
              onClick={() => setEndDayOpen(true)}
            >
              <PartyPopper className="mr-1 h-4 w-4" />
              今日收工，重置任务
            </Button>
          )}
        </div>
      </main>

      <CustomerFormDialog open={addOpen} onOpenChange={setAddOpen} />
      <LetterScanDialog open={scanOpen} onOpenChange={setScanOpen} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <NavigationChooserDialog
        customer={navCustomer}
        open={navCustomer !== null}
        onOpenChange={(v) => !v && setNavCustomer(null)}
      />
      <BaseDialog open={baseOpen} onOpenChange={setBaseOpen} onSaved={() => void reloadBase()} />
      <NavigationChooserDialog
        customer={base ? { name: "大本营", address: base.address, lat: base.lat, lng: base.lng } : null}
        open={navBaseOpen}
        onOpenChange={setNavBaseOpen}
      />
      <ZoneDialog open={zoneOpen} onOpenChange={setZoneOpen} />
      <AlertDialog open={endDayOpen} onOpenChange={setEndDayOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>今日收工，重置任务？</AlertDialogTitle>
            <AlertDialogDescription>
              将把 {doneCount} 个已完成的任务从今日列表归档，进度重新归零，方便明天开始新任务。收账历史记录会完整保留。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setEndDayOpen(false);
                void endDay();
              }}
            >
              确认收工
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <CompleteTaskDialog
        customer={complete}
        open={complete !== null}
        onOpenChange={(v) => !v && setComplete(null)}
      />
    </div>
  );
}
