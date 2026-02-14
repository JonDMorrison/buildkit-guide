import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
import { OrganizationProvider } from "@/hooks/useOrganization";
import { OrganizationSelectionModal } from "@/components/OrganizationSelectionModal";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PublicRoute } from "@/components/PublicRoute";
import { TimeTrackingGate } from "@/components/TimeTrackingGate";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Lazy load all pages for code splitting
const Landing = lazy(() => import("./pages/Landing"));
const HowItWorks = lazy(() => import("./pages/HowItWorks"));
const Features = lazy(() => import("./pages/Features"));
const SafetySecurity = lazy(() => import("./pages/SafetySecurity"));
const ResponsibleAI = lazy(() => import("./pages/ResponsibleAI"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Index = lazy(() => import("./pages/Index"));
const ProjectOverview = lazy(() => import("./pages/ProjectOverview"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Lookahead = lazy(() => import("./pages/Lookahead"));
const Manpower = lazy(() => import("./pages/Manpower"));
const Deficiencies = lazy(() => import("./pages/Deficiencies"));
const Safety = lazy(() => import("./pages/Safety"));
const AI = lazy(() => import("./pages/AI"));
const Auth = lazy(() => import("./pages/Auth"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));
const Welcome = lazy(() => import("./pages/Welcome"));
const Notifications = lazy(() => import("./pages/Notifications"));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings"));
const Documents = lazy(() => import("./pages/Documents"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const AuditLog = lazy(() => import("./pages/AuditLog"));
const DailyLogs = lazy(() => import("./pages/DailyLogs"));
const Receipts = lazy(() => import("./pages/Receipts"));
const ProjectReceipts = lazy(() => import("./pages/ProjectReceipts"));
const AccountingReceipts = lazy(() => import("./pages/AccountingReceipts"));
const DeficiencyImport = lazy(() => import("./pages/DeficiencyImport"));
const TimeTracking = lazy(() => import("./pages/TimeTracking"));
const TimeTrackingNotEnabled = lazy(() => import("./pages/TimeTrackingNotEnabled"));
const TimeRequestsReview = lazy(() => import("./pages/TimeRequestsReview"));
const TimesheetPeriods = lazy(() => import("./pages/TimesheetPeriods"));
const TimeDiagnostics = lazy(() => import("./pages/TimeDiagnostics"));
const Drawings = lazy(() => import("./pages/Drawings"));
const HoursTracking = lazy(() => import("./pages/HoursTracking"));
const Setup = lazy(() => import("./pages/Setup"));
const JobCostReport = lazy(() => import("./pages/JobCostReport"));
const Invoicing = lazy(() => import("./pages/Invoicing"));
const Estimates = lazy(() => import("./pages/Estimates"));
const Insights = lazy(() => import("./pages/Insights"));
const ProjectEstimateAccuracy = lazy(() => import("./pages/ProjectEstimateAccuracy"));
const DataHealth = lazy(() => import("./pages/DataHealth"));
const Snapshots = lazy(() => import("./pages/Snapshots"));
const DocsViewer = lazy(() => import("./pages/DocsViewer"));
const SystemAudit = lazy(() => import("./pages/SystemAudit"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes - prevents refetching on tab focus
      refetchOnWindowFocus: false, // Don't auto-refetch when user tabs back
      refetchOnMount: false, // Keep showing cached data
    },
  },
});

// Fallback component for lazy loading
const PageLoader = () => (
  <div className="flex items-center justify-center h-screen bg-background">
    <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent"></div>
  </div>
);

// Preload critical routes during idle time
if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
  requestIdleCallback(() => {
    import('./pages/Tasks');
    import('./pages/Safety');
    import('./pages/Dashboard');
  });
}

const App = () => (
  <ErrorBoundary>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <OrganizationProvider>
              <OrganizationSelectionModal />
              <Suspense fallback={<PageLoader />}>
                <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/accept-invite" element={<AcceptInvite />} />
                <Route
                  path="/welcome"
                  element={
                    <ProtectedRoute>
                      <Welcome />
                    </ProtectedRoute>
                  }
                />
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
                  path="/safety-security"
                  element={
                    <PublicRoute>
                      <SafetySecurity />
                    </PublicRoute>
                  }
                />
                <Route
                  path="/features"
                  element={
                    <PublicRoute>
                      <Features />
                    </PublicRoute>
                  }
                />
                <Route
                  path="/responsible-ai"
                  element={
                    <PublicRoute>
                      <ResponsibleAI />
                    </PublicRoute>
                  }
                />
                <Route
                  path="/setup"
                  element={
                    <ProtectedRoute>
                      <Setup />
                    </ProtectedRoute>
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
                <Route
                  path="/admin/time-diagnostics"
                  element={
                    <ProtectedRoute>
                      <TimeDiagnostics />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/drawings"
                  element={
                    <ProtectedRoute>
                      <Drawings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/hours-tracking"
                  element={
                    <ProtectedRoute>
                      <HoursTracking />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/job-cost-report"
                  element={
                    <ProtectedRoute>
                      <JobCostReport />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/invoicing"
                  element={
                    <ProtectedRoute>
                      <Invoicing />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/estimates"
                  element={
                    <ProtectedRoute>
                      <Estimates />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/insights"
                  element={
                    <ProtectedRoute>
                      <Insights />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/insights/project"
                  element={
                    <ProtectedRoute>
                      <ProjectEstimateAccuracy />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/insights/snapshots"
                  element={
                    <ProtectedRoute>
                      <Snapshots />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/data-health"
                  element={
                    <ProtectedRoute>
                      <DataHealth />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/docs/qa-gauntlet"
                  element={
                    <ProtectedRoute>
                      <DocsViewer />
                    </ProtectedRoute>
                  }
                />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route
                  path="/system-audit"
                  element={
                    <ProtectedRoute>
                      <SystemAudit />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </OrganizationProvider>
          </AuthProvider>
        </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
