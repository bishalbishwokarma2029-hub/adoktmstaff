import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import SetupPage from "@/pages/SetupPage";
import AppLayout from "@/components/AppLayout";
import DataLoader from "@/components/DataLoader";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import ConsignmentsPage from "@/pages/ConsignmentsPage";
import LoadingListsPage from "@/pages/LoadingListsPage";
import ContainersPage from "@/pages/ContainersPage";
import ContainerDetailPage from "@/pages/ContainerDetailPage";
import LotwisePage from "@/pages/LotwisePage";
import LotDetailPage from "@/pages/LotDetailPage";
import RemainingCTNsPage from "@/pages/RemainingCTNsPage";
import PartyFollowUpPage from "@/pages/PartyFollowUpPage";
import TrackingPage from "@/pages/TrackingPage";
import AdminPage from "@/pages/AdminPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <DataLoader>
      <AppLayout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/consignments" element={<ConsignmentsPage />} />
          <Route path="/loading-lists" element={<LoadingListsPage />} />
          <Route path="/containers" element={<ContainersPage />} />
          <Route path="/containers/:containerNo" element={<ContainerDetailPage />} />
          <Route path="/lotwise" element={<LotwisePage />} />
          <Route path="/lotwise/:lotNo" element={<LotDetailPage />} />
          <Route path="/remaining-ctns" element={<RemainingCTNsPage />} />
          <Route path="/party-followup" element={<PartyFollowUpPage />} />
          <Route path="/tracking" element={<TrackingPage />} />
          <Route path="/admin" element={isAdmin ? <AdminPage /> : <Navigate to="/" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppLayout>
    </DataLoader>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/setup" element={<SetupPage />} />
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/*" element={<ProtectedRoutes />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
