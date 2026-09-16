import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Brain, Crosshair, Home, PartyPopper, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomerCard } from "@/components/collection/CustomerCard";
import { CompleteTaskDialog } from "@/components/collection/CompleteTaskDialog";
import { RouteMap } from "@/components/collection/RouteMap";
import { deleteCustomer, errorText } from "@/lib/collection/api";
import { useCollection } from "@/lib/collection/store";
import { km, mins, displaySeq, zonePolygon, type Customer, type RouteMode } from "@/lib/collection/types";

const MODES: Array<{ id: RouteMode; label: string }> = [
  { id: "fastest", label: "⚡ 最快" },
  { id: "shortest", label: "🛣️ 最短距离" },
  { id: "priority", label: "⭐ 自定义优先" },
];

export default function RoutePage() {
  const {
    orderedOpen,
    customers,
    position,
    plan,
    planning,
    planError,
    planRoute,
    mode,
    setMode,
    locate,
    locating,
    reorderManually,
    hideCustomer,
    base,
    refresh,
    endDay,
    zones,
    zoneFilter,
    setZoneFilter,
  } = useCollection();
  const [complete, setComplete] = useState<Customer | null>(null);

  const legById = new Map((plan?.legs ?? []).map((l) => [l.id, l]));

  // 选了区就只看/只规划这个区的客户（保持规划顺序）
  const visible =
    zoneFilter === "all"
      ? orderedOpen
      : orderedOpen.filter((c) =>
          zoneFilter === "none" ? c.zone_id == null : c.zone_id === zoneFilter,
        );
  const zoneName =
    zoneFilter === "all" ? null : zoneFilter === "none" ? "未分区" : zones.find((z) => z._row_id === zoneFilter)?.name;
  const hasUnzoned = customers.some((c) => c.zone_id == null);
  // 每个区还有多少待收客户（含各区剩余量，隐藏的不算）
  const zoneOpenCount = (zoneId: number | "none") => {
    const inZone =
      zoneId === "none"
        ? customers.filter((c) => c.zone_id == null)
        : customers.filter((c) => c.zone_id === zoneId);
    return inZone.filter((c) => c.hidden !== 1 && ["pending", "in_progress"].includes(c.status)).length;
  };
  // 地图不显示隐藏的客户
  const mapCustomers = zoneFilter === "all" ? customers.filter((c) => c.hidden !== 1) : visible;

  const move = async (index: number, dir: -1 | 1) => {
    const ids = visible.map((c) => c._row_id);
    const target = index + dir;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await reorderManually(ids);
  };

  const remove = async (c: Customer) => {
    try {
      await deleteCustomer(c._row_id);
      await refresh();
      toast.success(`已删除 ${c.name}`);
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  return (
    <div className="min-h-screen">
      <header className="bg-slate-900 px-4 pb-4 pt-8 text-white">
        <h1 className="text-xl font-bold">今日路线</h1>
        <p className="mt-1 text-sm text-slate-300">
          {plan
            ? `总距离 ${km(plan.total_distance_m)} · 预计驾驶 ${mins(plan.total_duration_s)}${zoneName ? ` · 今日专收：${zoneName}` : ""}${plan.manual ? " · 路线已手动调整" : ""}`
            : zoneName
              ? `今日专收：${zoneName} · 尚未规划路线`
              : "尚未规划路线"}
        </p>
        <div className="mt-3 flex gap-2">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`flex-1 rounded-lg px-2 py-2 text-xs font-medium transition-colors ${
                mode === m.id ? "bg-sky-500 text-white" : "bg-white/10 text-slate-300"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {zones.length > 0 && (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setZoneFilter("all")}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
                zoneFilter === "all" ? "border-sky-400 bg-sky-500 text-white" : "border-white/30 bg-white/10 text-slate-200"
              }`}
            >
              全部地区-{customers.filter((c) => c.hidden !== 1).length}
            </button>
            {zones.map((z) => (
              <button
                key={z._row_id}
                onClick={() => setZoneFilter(z._row_id)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
                  zoneFilter === z._row_id ? "border-sky-400 bg-sky-500 text-white" : "border-white/30 bg-white/10 text-slate-200"
                }`}
              >
                {z.name}-{zoneOpenCount(z._row_id)}
              </button>
            ))}
            {hasUnzoned && (
              <button
                onClick={() => setZoneFilter("none")}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
                  zoneFilter === "none" ? "border-sky-400 bg-sky-500 text-white" : "border-white/30 bg-white/10 text-slate-200"
                }`}
              >
                未分区-{zoneOpenCount("none")}
              </button>
            )}
          </div>
        )}
      </header>

      <div className="px-4 pt-4">
        <RouteMap
          customers={mapCustomers}
          position={position}
          nextId={visible[0]?._row_id}
          base={base}
          orderedIds={visible.map((c) => c._row_id)}
          zoneOverlays={zones
            .map((z) => ({ name: z.name, poly: zonePolygon(z) }))
            .filter((o) => o.poly.length >= 3)}
          height={280}
          onSelect={() => undefined}
        />
      </div>

      <div className="space-y-2 px-4 pt-4">
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-12" onClick={() => void locate()} disabled={locating}>
            <Crosshair className="mr-1 h-4 w-4" />
            {locating ? "定位中…" : "更新位置"}
          </Button>
          <Button className="h-12 bg-slate-900 text-white hover:bg-slate-800" onClick={() => void planRoute()} disabled={planning}>
            <Brain className="mr-1 h-4 w-4" />
            {planning ? "计算中…" : "智能规划"}
          </Button>
        </div>
        {plan?.manual && (
          <Button variant="ghost" className="h-11 w-full text-slate-600" onClick={() => void planRoute()}>
            <RotateCcw className="mr-1 h-4 w-4" />
            恢复智能路线
          </Button>
        )}
        {orderedOpen.length === 0 && customers.length > 0 && (
          <Button variant="outline" className="h-12 w-full" onClick={() => void endDay()}>
            <PartyPopper className="mr-1 h-4 w-4" />
            今日收工，重置任务
          </Button>
        )}
        {planError && (
          <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">
            {planError}
          </div>
        )}
      </div>

      <div className="space-y-3 px-4 py-4">
        {visible.length === 0 && (
          <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500">
            {zoneName ? "这个区没有待处理客户。" : "没有待处理客户。"}
          </p>
        )}
        {visible.map((c, i) => {
          const leg = legById.get(c._row_id);
          return (
            <div key={c._row_id} className="space-y-1">
              <CustomerCard
                customer={c}
                index={displaySeq(c, i + 1) ?? undefined}
                legText={leg ? `${km(leg.distance_m)} · 约 ${mins(leg.duration_s)}` : undefined}
                zoneName={c.zone_id != null ? zones.find((z) => z._row_id === c.zone_id)?.name ?? null : null}
                onComplete={setComplete}
                onHide={(x) => void hideCustomer(x._row_id)}
                onDelete={(x) => void remove(x)}
              />
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="sm" onClick={() => void move(i, -1)} disabled={i === 0}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void move(i, 1)}
                  disabled={i === visible.length - 1}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
        {base && plan?.return_leg && (
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm text-white">
                <Home className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-slate-900">返回大本营</h3>
                <p className="mt-0.5 text-sm text-slate-500">{base.address}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {km(plan.return_leg.distance_m)} · 约 {mins(plan.return_leg.duration_s)}
                </p>
                <Button
                  variant="outline"
                  className="mt-2 h-11 w-full"
                  onClick={() =>
                    window.open(
                      `https://www.google.com/maps/dir/?api=1&destination=${base.lat},${base.lng}&travelmode=driving`,
                      "_blank",
                    )
                  }
                >
                  导航回大本营
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <CompleteTaskDialog
        customer={complete}
        open={complete !== null}
        onOpenChange={(v) => !v && setComplete(null)}
      />
    </div>
  );
}
