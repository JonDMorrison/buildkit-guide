import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { OrganizationProvider } from "@/hooks/useOrganization";
import { OrganizationSelectionModal } from "@/components/OrganizationSelectionModal";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PublicRoute } from "@/components/PublicRoute";
import { TimeTrackingGate } from "@/components/TimeTrackingGate";
import Landing from "./pages/Landing";
import HowItWorks from "./pages/HowItWorks";
import Dashboard from "./pages/Dashboard";
import Index from "./pages/Index";
import ProjectOverview from "./pages/ProjectOverview";
import Tasks from "./pages/Tasks";
import Lookahead from "./pages/Lookahead";
import Manpower from "./pages/Manpower";
import Deficiencies from "./pages/Deficiencies";
import Safety from "./pages/Safety";
import AI from "./pages/AI";
import Auth from "./pages/Auth";
import Notifications from "./pages/Notifications";
import NotificationSettings from "./pages/NotificationSettings";
import Documents from "./pages/Documents";
import UserManagement from "./pages/UserManagement";
import AuditLog from "./pages/AuditLog";
import DailyLogs from "./pages/DailyLogs";
import Receipts from "./pages/Receipts";
import ProjectReceipts from "./pages/ProjectReceipts";
import AccountingReceipts from "./pages/AccountingReceipts";
import DeficiencyImport from "./pages/DeficiencyImport";
import TimeTracking from "./pages/TimeTracking";
import TimeTrackingNotEnabled from "./pages/TimeTrackingNotEnabled";
import TimeRequestsReview from "./pages/TimeRequestsReview";
import TimesheetPeriods from "./pages/TimesheetPeriods";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <OrganizationProvider>
            <OrganizationSelectionModal />
            <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/"
              element={
                <PublicRoute>
                  <Landing />
                </PublicRoute>
              }
            />
            <Route
              path="/how-it-works"
              element={
                <PublicRoute>
                  <HowItWorks />
                </PublicRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects"
              element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:projectId"
              element={
                <ProtectedRoute>
                  <ProjectOverview />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:projectId/receipts"
              element={
                <ProtectedRoute>
                  <ProjectReceipts />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tasks"
              element={
                <ProtectedRoute>
                  <Tasks />
                </ProtectedRoute>
              }
            />
            <Route
              path="/lookahead"
              element={
                <ProtectedRoute>
                  <Lookahead />
                </ProtectedRoute>
              }
            />
            <Route
              path="/manpower"
              element={
                <ProtectedRoute>
                  <Manpower />
                </ProtectedRoute>
              }
            />
            <Route
              path="/deficiencies"
              element={
                <ProtectedRoute>
                  <Deficiencies />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:projectId/deficiency-import"
              element={
                <ProtectedRoute>
                  <DeficiencyImport />
                </ProtectedRoute>
              }
            />
            <Route
              path="/safety"
              element={
                <ProtectedRoute>
                  <Safety />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ai"
              element={
                <ProtectedRoute>
                  <AI />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <Notifications />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/notifications"
              element={
                <ProtectedRoute>
                  <NotificationSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/documents"
              element={
                <ProtectedRoute>
                  <Documents />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute>
                  <UserManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/audit"
              element={
                <ProtectedRoute>
                  <AuditLog />
                </ProtectedRoute>
              }
            />
            <Route
              path="/daily-logs"
              element={
                <ProtectedRoute>
                  <DailyLogs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/receipts"
              element={
                <ProtectedRoute>
                  <Receipts />
                </ProtectedRoute>
              }
            />
            <Route
              path="/accounting/receipts"
              element={
                <ProtectedRoute>
                  <AccountingReceipts />
                </ProtectedRoute>
              }
            />
            <Route
              path="/time"
              element={
                <ProtectedRoute>
                  <TimeTrackingGate>
                    <TimeTracking />
                  </TimeTrackingGate>
                </ProtectedRoute>
              }
            />
            <Route
              path="/time-tracking-not-enabled"
              element={
                <ProtectedRoute>
                  <TimeTrackingNotEnabled />
                </ProtectedRoute>
              }
            />
            <Route
              path="/time/requests"
              element={
                <ProtectedRoute>
                  <TimeRequestsReview />
                </ProtectedRoute>
              }
            />
            <Route
              path="/time/periods"
              element={
                <ProtectedRoute>
                  <TimesheetPeriods />
                </ProtectedRoute>
              }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
            </Routes>
          </OrganizationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
