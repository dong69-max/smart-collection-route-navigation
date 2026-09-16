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

export function openGoogleMaps(c: NavTarget) {
  const dest =
    c.lat != null && c.lng != null ? `${c.lat},${c.lng}` : encodeURIComponent(c.address);
  window.open(
    `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`,
    "_blank",
  );
}

export function openWaze(c: NavTarget) {
  const dest =
    c.lat != null && c.lng != null ? `ll=${c.lat},${c.lng}` : `q=${encodeURIComponent(c.address)}`;
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
