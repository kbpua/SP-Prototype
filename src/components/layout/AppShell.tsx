import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppShell() {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 w-full flex-1 flex-col bg-slate-50">
        <TopBar />
        <main ref={mainRef} className="min-w-0 flex-1 overflow-y-auto scrollbar-thin">
          <div key={location.pathname} className="animate-page-in w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
