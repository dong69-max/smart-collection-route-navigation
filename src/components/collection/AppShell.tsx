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
                  "flex flex-1 flex-col items-center gap-0.5 pb-2.5 pt-2 text-[11px] transition-colors",
                  isActive ? "font-semibold text-sky-600" : "font-medium text-slate-400",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      "flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                      isActive && "bg-sky-50",
                    )}
                  >
                    <Icon className="h-[22px] w-[22px]" />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
