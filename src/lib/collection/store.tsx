import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  errorText,
  getSetting,
  listCustomers,
  listHistory,
  requestRoute,
  updateCustomer,
} from "./api";
import {
  haversineKm,
  isOpen,
  restoreSavedPosition,
  syncPlanToOpenCustomers,
  type Coords,
  type Customer,
  type HistoryRow,
  type RouteMode,
  type RoutePlan,
} from "./types";

interface Ctx {
  customers: Customer[];
  base: Base | null;
  reloadBase: () => Promise<void>;
  history: HistoryRow[];
  loading: boolean;
  position: Coords | null;
  positionLabel: string;
  positionError: string | null;
  locating: boolean;
  plan: RoutePlan | null;
  planning: boolean;
  planError: string | null;
  mode: RouteMode;
  setMode: (m: RouteMode) => void;
  orderedOpen: Customer[];
  nearby: Array<{ customer: Customer; km: number }>;
  refresh: () => Promise<void>;
  locate: () => Promise<void>;
  setManualPosition: (c: Coords, label?: string) => void;
  planRoute: () => Promise<void>;
  endDay: () => Promise<void>;
  reorderManually: (ids: number[]) => Promise<void>;
  setNextStop: (id: number) => Promise<void>;
}

import { BASE_KEY, parseBase, type Base } from "@/components/collection/BaseDialog";

const CollectionContext = createContext<Ctx | null>(null);

const PLAN_KEY = "collection_route_plan";
const POS_KEY = "collection_last_position";

export function CollectionProvider({ children }: { children: ReactNode }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [position, setPosition] = useState<Coords | null>(null);
  const [positionLabel, setPositionLabel] = useState("尚未获取位置");
  const [positionError, setPositionError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [mode, setMode] = useState<RouteMode>("fastest");
  const [base, setBase] = useState<Base | null>(null);

  const reloadBase = useCallback(async () => {
    try {
      setBase(parseBase(await getSetting(BASE_KEY)));
    } catch {
      setBase(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [c, h] = await Promise.all([listCustomers(), listHistory()]);
      setCustomers(c);
      setHistory(h);
    } catch (e) {
      toast.error(`读取数据失败：${errorText(e)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    void reloadBase();
    try {
      const savedPlan = localStorage.getItem(PLAN_KEY);
      if (savedPlan) setPlan(JSON.parse(savedPlan) as RoutePlan);
      const savedPos = localStorage.getItem(POS_KEY);
      const restored = restoreSavedPosition(savedPos);
      if (restored) {
        setPosition({ lat: restored.lat, lng: restored.lng });
        setPositionLabel(restored.label);
      } else if (savedPos) {
        // 上次定位已过期（超过 3 小时）：丢弃，不再显示旧图钉
        localStorage.removeItem(POS_KEY);
      }
    } catch {
      /* ignore */
    }
  }, [refresh]);

  const persistPlan = useCallback((p: RoutePlan | null) => {
    setPlan(p);
    if (p) localStorage.setItem(PLAN_KEY, JSON.stringify(p));
    else localStorage.removeItem(PLAN_KEY);
  }, []);

  const persistPosition = useCallback((c: Coords, label: string) => {
    setPosition(c);
    setPositionLabel(label);
    localStorage.setItem(POS_KEY, JSON.stringify({ ...c, label, ts: Date.now() }));
  }, []);

  const clearPosition = useCallback(() => {
    setPosition(null);
    setPositionLabel("定位已关闭");
    localStorage.removeItem(POS_KEY);
  }, []);

  const setManualPosition = useCallback(
    (c: Coords, label?: string) => {
      setPositionError(null);
      persistPosition(c, label ?? `手动起点 ${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`);
    },
    [persistPosition],
  );

  const locate = useCallback(async () => {
    if (!("geolocation" in navigator)) {
      setPositionError("此设备不支持定位，请手动输入起点。");
      return;
    }
    setLocating(true);
    setPositionError(null);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }),
      );
      persistPosition(
        { lat: pos.coords.latitude, lng: pos.coords.longitude },
        `GPS ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`,
      );
      toast.success("已获取当前位置");
    } catch (e) {
      const err = e as GeolocationPositionError;
      if (err?.code === 1) {
        // 权限被拒：立即清除旧图钉，不再显示可能过期的位置
        clearPosition();
        setPositionError("定位权限被拒绝，已清除位置图钉。可手动输入起点或使用大本营规划。");
        toast.error("定位权限被拒绝，已清除位置图钉。");
      } else {
        const msg =
          err?.code === 3
            ? "定位超时，请到空旷处重试或手动输入起点。"
            : `GPS 获取失败：${err?.message ?? String(e)}`;
        setPositionError(msg);
        toast.error(msg);
      }
    } finally {
      setLocating(false);
    }
  }, [clearPosition, persistPosition]);

  const openCustomers = useMemo(() => customers.filter(isOpen), [customers]);

  // 路线计划自动跟随任务清单：客户完成/删除/收工归档后，
  // 剔除对应路段并重算总量；一个不剩则清空计划（首页预计距离/时间归零）。
  useEffect(() => {
    if (!plan) return;
    const synced = syncPlanToOpenCustomers(plan, openCustomers.map((c) => c._row_id));
    if (synced !== plan) persistPlan(synced);
  }, [openCustomers, plan, persistPlan]);

  const planRoute = useCallback(async () => {
    const start = position ?? base;
    if (!start) {
      setPlanError("请先获取当前位置、设置大本营或手动输入起点。");
      toast.error("请先获取当前位置或设置大本营。");
      return;
    }
    const stops = openCustomers.filter((c) => c.lat != null && c.lng != null);
    if (stops.length === 0) {
      setPlanError("没有已定位的未完成客户，无法规划路线。");
      toast.error("没有已定位的未完成客户。");
      return;
    }
    setPlanning(true);
    setPlanError(null);
    try {
      const pinned = stops.find((c) => c.pinned_next === 1);
      const res = await requestRoute({
        start,
        stops: stops.map((c) => ({
          id: c._row_id,
          lat: c.lat as number,
          lng: c.lng as number,
          priority: c.priority,
          amount: c.amount,
        })),
        mode,
        pinnedFirstId: pinned?._row_id,
        returnTo: base ? { lat: base.lat, lng: base.lng } : undefined,
      });
      const newPlan: RoutePlan = {
        provider: res.provider,
        mode,
        legs: res.legs,
        total_distance_m: res.total_distance_m,
        total_duration_s: res.total_duration_s,
        return_leg: res.return_leg ?? null,
        manual: false,
        createdAt: Date.now(),
      };
      persistPlan(newPlan);
      await Promise.all(
        res.legs.map((leg, i) => updateCustomer(leg.id, { route_order: i + 1 })),
      );
      await refresh();
      toast.success("路线已规划");
    } catch (e) {
      const msg = errorText(e);
      setPlanError(msg);
      toast.error(msg);
    } finally {
      setPlanning(false);
    }
  }, [base, mode, openCustomers, persistPlan, position, refresh]);

  const endDay = useCallback(async () => {
    const finished = customers.filter((c) => !isOpen(c));
    if (finished.length === 0) {
      toast.info("还没有已完成的任务，无需收工。");
      return;
    }
    try {
      await Promise.all(finished.map((c) => updateCustomer(c._row_id, { archived: 1 })));
      persistPlan(null);
      await refresh();
      toast.success(`已收工：${finished.length} 个已完成任务已归档，历史记录保留。`);
    } catch (e) {
      toast.error(`收工失败：${errorText(e)}`);
    }
  }, [customers, persistPlan, refresh]);

  const orderedOpen = useMemo(() => {
    if (!plan) {
      return [...openCustomers].sort(
        (a, b) => (a.route_order ?? 9999) - (b.route_order ?? 9999) || a._row_id - b._row_id,
      );
    }
    const byId = new Map(openCustomers.map((c) => [c._row_id, c]));
    const ordered: Customer[] = [];
    for (const leg of plan.legs) {
      const c = byId.get(leg.id);
      if (c) {
        ordered.push(c);
        byId.delete(leg.id);
      }
    }
    return [...ordered, ...byId.values()];
  }, [openCustomers, plan]);

  const nearby = useMemo(() => {
    if (!position) return [];
    return openCustomers
      .filter((c) => c.lat != null && c.lng != null)
      .map((c) => ({
        customer: c,
        km: haversineKm(position, { lat: c.lat as number, lng: c.lng as number }),
      }))
      .filter((x) => x.km <= 3)
      .sort((a, b) => a.km - b.km)
      .slice(0, 5);
  }, [openCustomers, position]);

  const reorderManually = useCallback(
    async (ids: number[]) => {
      const legMap = new Map((plan?.legs ?? []).map((l) => [l.id, l]));
      const legs = ids.map((id) => legMap.get(id)).filter(Boolean) as RoutePlan["legs"];
      persistPlan({
        provider: plan?.provider ?? "manual",
        mode: plan?.mode ?? mode,
        legs: ids.map((id) => legMap.get(id) ?? { id, distance_m: 0, duration_s: 0 }),
        total_distance_m: legs.reduce((a, l) => a + l.distance_m, 0),
        total_duration_s: legs.reduce((a, l) => a + l.duration_s, 0),
        manual: true,
        createdAt: Date.now(),
      });
      await Promise.all(ids.map((id, i) => updateCustomer(id, { route_order: i + 1 })));
      await refresh();
    },
    [mode, persistPlan, plan, refresh],
  );

  const setNextStop = useCallback(
    async (id: number) => {
      await Promise.all(
        customers
          .filter((c) => c.pinned_next === 1 && c._row_id !== id)
          .map((c) => updateCustomer(c._row_id, { pinned_next: 0 })),
      );
      await updateCustomer(id, { pinned_next: 1 });
      await refresh();
      toast.success("已设为下一站，重新规划中…");
      await planRoute();
    },
    [customers, planRoute, refresh],
  );

  const value: Ctx = {
    customers,
    base,
    reloadBase,
    history,
    loading,
    position,
    positionLabel,
    positionError,
    locating,
    plan,
    planning,
    planError,
    mode,
    setMode,
    orderedOpen,
    nearby,
    refresh,
    locate,
    setManualPosition,
    planRoute,
    endDay,
    reorderManually,
    setNextStop,
  };

  return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
}

export function useCollection() {
  const ctx = useContext(CollectionContext);
  if (!ctx) throw new Error("useCollection must be used inside CollectionProvider");
  return ctx;
}
