import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
// 导航目标：客户或大本营都满足这个形状
export interface NavTarget {
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
}

export function openGoogleMaps(c: NavTarget, byCoords = false) {
  // 默认传地址原文，让 Google 用自家高精度数据解析——与用户自己在 Google Maps 输入地址结果一致；
  // 仅在用户明确选坐标回退时才传 lat,lng（免费引擎的坐标有误差，不作首选）
  const dest =
    byCoords && c.lat != null && c.lng != null ? `${c.lat},${c.lng}` : encodeURIComponent(c.address);
  window.open(
    `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`,
    "_blank",
  );
}

export function openWaze(c: NavTarget, byCoords = false) {
  const dest =
    byCoords && c.lat != null && c.lng != null ? `ll=${c.lat},${c.lng}` : `q=${encodeURIComponent(c.address)}`;
  window.open(`https://waze.com/ul?${dest}&navigate=yes`, "_blank");
}

export function NavigationChooserDialog({
  customer,
  open,
  onOpenChange,
}: {
  customer: NavTarget | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  if (!customer) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>开始导航</DialogTitle>
          <DialogDescription>
            {customer.name} · {customer.address}
          </DialogDescription>
        </DialogHeader>
        <p className="text-xs text-slate-500">按地址导航（与你自己往 Google Maps 输入地址一致，最准）。</p>
        <div className="grid gap-2">
          <Button
            className="h-16 justify-center text-lg"
            onClick={() => {
              openGoogleMaps(customer);
              onOpenChange(false);
            }}
          >
            🗺️ Google Maps
          </Button>
          <Button
            className="h-16 justify-center bg-sky-500 text-lg text-white hover:bg-sky-600"
            onClick={() => {
              openWaze(customer);
              onOpenChange(false);
            }}
          >
            🚗 Waze
          </Button>
          <Button
            variant="ghost"
            className="h-11 justify-center text-sm text-slate-500"
            onClick={() => {
              openGoogleMaps(customer, true);
              onOpenChange(false);
            }}
          >
            地址找不到？改用图钉坐标导航
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
