import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import RoutePage from "./pages/RoutePage";
import TasksPage from "./pages/TasksPage";
import HistoryPage from "./pages/HistoryPage";
import NotFound from "./pages/NotFound";
import { AppShell } from "@/components/collection/AppShell";
import { CollectionProvider } from "@/lib/collection/store";

const queryClient = new QueryClient();

const App = () => (
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CollectionProvider>
          <Toaster position="top-center" />
          <AppShell>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/route" element={<RoutePage />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppShell>
        </CollectionProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </BrowserRouter>
);

export default App;
