import { Home, Map, ListChecks, History } from "lucide-react";
import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "首页", icon: Home },
  { to: "/route", label: "路线", icon: Map },
  { to: "/tasks", label: "任务", icon: ListChecks },
  { to: "/history", label: "历史", icon: History },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-slate-100">
      <div className="mx-auto w-full max-w-md pb-28">{children}</div>
      <nav className="fixed inset-x-0 bottom-0 z-[1000] border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-md">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors",
                  isActive ? "font-semibold text-sky-600" : "text-slate-400",
                )
              }
            >
              <Icon className="h-6 w-6" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
