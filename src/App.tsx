import { Suspense, lazy } from "react";
import { safeLazy } from "@/lib/safeLazy";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
import { OrganizationProvider } from "@/hooks/useOrganization";
import { OrganizationSelectionModal } from "@/components/OrganizationSelectionModal";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PublicRoute } from "@/components/PublicRoute";
import { TimeTrackingGate } from "@/components/TimeTrackingGate";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RoleGate } from "@/components/RoleGate";
import { TenantIsolationGuardian } from "@/components/TenantIsolationGuardian";
import { AdminRoute } from "@/components/AdminRoute";
import { DashboardSkeleton, ExecutiveSkeleton, ListPageSkeleton } from "@/components/dashboard/shared/PageSkeletons";

// Lazy load all pages for code splitting with retry logic
const Landing = safeLazy(() => import("./pages/Landing"));
const HowItWorks = safeLazy(() => import("./pages/HowItWorks"));
const Features = safeLazy(() => import("./pages/Features"));
const SafetySecurity = safeLazy(() => import("./pages/SafetySecurity"));
const ResponsibleAI = safeLazy(() => import("./pages/ResponsibleAI"));
const GetStarted = safeLazy(() => import("./pages/GetStarted"));
const Pricing = safeLazy(() => import("./pages/Pricing"));
const Dashboard = safeLazy(() => import("./pages/Dashboard"));
const Index = safeLazy(() => import("./pages/Index"));
const ProjectOverview = safeLazy(() => import("./pages/ProjectOverview"));
const Tasks = safeLazy(() => import("./pages/Tasks"));
const Lookahead = safeLazy(() => import("./pages/Lookahead"));
const Manpower = safeLazy(() => import("./pages/Manpower"));
const Deficiencies = safeLazy(() => import("./pages/Deficiencies"));
const Safety = safeLazy(() => import("./pages/Safety"));
const AI = safeLazy(() => import("./pages/AI"));
const Auth = safeLazy(() => import("./pages/Auth"));
const AcceptInvite = safeLazy(() => import("./pages/AcceptInvite"));
const Welcome = safeLazy(() => import("./pages/Welcome"));
const Notifications = safeLazy(() => import("./pages/Notifications"));
const NotificationSettings = safeLazy(() => import("./pages/NotificationSettings"));
const LaborRates = safeLazy(() => import("./pages/LaborRates"));
const Documents = safeLazy(() => import("./pages/Documents"));
const UserManagement = safeLazy(() => import("./pages/UserManagement"));
const AuditLog = safeLazy(() => import("./pages/AuditLog"));
const DailyLogs = safeLazy(() => import("./pages/DailyLogs"));
const Receipts = safeLazy(() => import("./pages/Receipts"));
const ProjectReceipts = safeLazy(() => import("./pages/ProjectReceipts"));
const AccountingReceipts = safeLazy(() => import("./pages/AccountingReceipts"));
const DeficiencyImport = safeLazy(() => import("./pages/DeficiencyImport"));
const TimeTracking = safeLazy(() => import("./pages/TimeTracking"));
const TimeTrackingNotEnabled = safeLazy(() => import("./pages/TimeTrackingNotEnabled"));
const TimeRequestsReview = safeLazy(() => import("./pages/TimeRequestsReview"));
const TimesheetPeriods = safeLazy(() => import("./pages/TimesheetPeriods"));
const TimeDiagnostics = safeLazy(() => import("./pages/TimeDiagnostics"));
const Drawings = safeLazy(() => import("./pages/Drawings"));
const HoursTracking = safeLazy(() => import("./pages/HoursTracking"));
const Setup = safeLazy(() => import("./pages/Setup"));
const JobCostReport = safeLazy(() => import("./pages/JobCostReport"));
const Invoicing = safeLazy(() => import("./pages/Invoicing"));
const Estimates = safeLazy(() => import("./pages/Estimates"));
const EstimateDetail = safeLazy(() => import("./pages/EstimateDetail"));
const Quotes = safeLazy(() => import("./pages/Quotes"));
const Proposals = safeLazy(() => import("./pages/Proposals"));
const Insights = safeLazy(() => import("./pages/Insights"));
const ProjectEstimateAccuracy = safeLazy(() => import("./pages/ProjectEstimateAccuracy"));
const DataHealth = safeLazy(() => import("./pages/DataHealth"));
const Snapshots = safeLazy(() => import("./pages/Snapshots"));
const DocsViewer = safeLazy(() => import("./pages/DocsViewer"));
const SystemAudit = safeLazy(() => import("./pages/SystemAudit"));
const SecurityIsolationReport = safeLazy(() => import("./pages/SecurityIsolationReport"));
const Workflow = safeLazy(() => import("./pages/Workflow"));
const PromptsAudit = safeLazy(() => import("./pages/PromptsAudit"));
const InsightsAudit = safeLazy(() => import("./pages/InsightsAudit"));
const ConversionTestHarness = import.meta.env.DEV ? safeLazy(() => import("./pages/ConversionTestHarness")) : null;
const Financials = safeLazy(() => import("./pages/Financials"));
const AIBrainDiagnostics = safeLazy(() => import("./pages/AIBrainDiagnostics"));
const DashboardDiagnostics = safeLazy(() => import("./pages/DashboardDiagnostics"));
const ExecutiveDashboard = safeLazy(() => import("./pages/ExecutiveDashboard"));
const ExecutiveReport = safeLazy(() => import("./pages/ExecutiveReport"));
const OrgSettings = safeLazy(() => import("./pages/OrgSettings"));
const Intelligence = safeLazy(() => import("./pages/Intelligence"));
const ChangeOrders = safeLazy(() => import("./pages/ChangeOrders"));
const ChangeOrderDetail = safeLazy(() => import("./pages/ChangeOrderDetail"));
const Release = safeLazy(() => import("./pages/Release"));
const Playbooks = safeLazy(() => import("./pages/Playbooks"));
const AdminReleaseChecklist = safeLazy(() => import("./pages/AdminReleaseChecklist"));
const TenantIsolationSmoke = safeLazy(() => import("./pages/TenantIsolationSmoke"));
const AdminUISmokeRunner = safeLazy(() => import("./pages/AdminUISmokeRunner"));
const HealthCheck = safeLazy(() => import("./pages/HealthCheck"));
const QASmartMemory = safeLazy(() => import("./pages/QASmartMemory"));
const Export = safeLazy(() => import("./pages/Export"));
const NotFound = safeLazy(() => import("./pages/NotFound"));

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
              <TenantIsolationGuardian />
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
                  path="/get-started"
                  element={<GetStarted />}
                />
                <Route
                  path="/pricing"
                  element={<Pricing />}
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
                      <RoleGate skeleton={<DashboardSkeleton />}>
                        <Dashboard />
                      </RoleGate>
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
                  path="/settings/labor-rates"
                  element={
                    <ProtectedRoute>
                      <LaborRates />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings/organization"
                  element={
                    <ProtectedRoute>
                      <OrgSettings />
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
                      <RoleGate allowedRoles={["admin", "pm"]}>
                        <UserManagement />
                      </RoleGate>
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
                      <RoleGate allowedRoles={["admin"]}>
                        <TimeDiagnostics />
                      </RoleGate>
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
                  path="/financials"
                  element={
                    <ProtectedRoute>
                      <Financials />
                    </ProtectedRoute>
                  }
                />
                {/* Legacy redirects — keep deep-link for estimate detail */}
                <Route path="/estimates" element={<Navigate to="/financials" replace />} />
                <Route path="/quotes" element={<Navigate to="/financials" replace />} />
                <Route path="/proposals" element={<Navigate to="/financials" replace />} />
                <Route
                  path="/estimates/:estimateId"
                  element={
                    <ProtectedRoute>
                      <EstimateDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/change-orders"
                  element={
                    <ProtectedRoute>
                      <ChangeOrders />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/change-orders/:id"
                  element={
                    <ProtectedRoute>
                      <ChangeOrderDetail />
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
                  path="/intelligence"
                  element={
                    <ProtectedRoute>
                      <Intelligence />
                    </ProtectedRoute>
                  }
                />
                {/* Admin/PM-only: financial estimate accuracy — nav filtering alone is insufficient */}
                <Route
                  path="/insights/project"
                  element={
                    <ProtectedRoute>
                      <RoleGate allowedRoles={["admin", "pm"]}>
                        <ProjectEstimateAccuracy />
                      </RoleGate>
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
                      <RoleGate allowedRoles={["admin", "pm"]}>
                        <DataHealth />
                      </RoleGate>
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
                <Route
                  path="/insights/security"
                  element={
                    <ProtectedRoute>
                      <RoleGate allowedRoles={["admin"]}>
                        <SecurityIsolationReport />
                      </RoleGate>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/workflow"
                  element={
                    <ProtectedRoute>
                      <Workflow />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/audit/prompts-1-10"
                  element={
                    <ProtectedRoute>
                      <PromptsAudit />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/insights/audit"
                  element={
                    <ProtectedRoute>
                      <InsightsAudit />
                    </ProtectedRoute>
                  }
                />
                {import.meta.env.DEV && ConversionTestHarness && (
                  <Route
                    path="/insights/conversion-test"
                    element={
                      <ProtectedRoute>
                        <ConversionTestHarness />
                      </ProtectedRoute>
                    }
                  />
                )}
                <Route
                  path="/insights/ai-brain"
                  element={
                    <ProtectedRoute>
                      <RoleGate allowedRoles={["admin"]}>
                        <AIBrainDiagnostics />
                      </RoleGate>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/release"
                  element={
                    <ProtectedRoute>
                      <RoleGate allowedRoles={["admin", "pm"]}>
                        <Release />
                      </RoleGate>
                    </ProtectedRoute>
                  }
                />
                {/* Admin-only: nav filtering alone is insufficient — direct URL access must be blocked at the route level */}
                <Route
                  path="/playbooks"
                  element={
                    <ProtectedRoute>
                      <RoleGate allowedRoles={["admin"]}>
                        <Playbooks />
                      </RoleGate>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/release-checklist"
                  element={
                    <ProtectedRoute>
                      <RoleGate allowedRoles={["admin"]}>
                        <AdminReleaseChecklist />
                      </RoleGate>
                    </ProtectedRoute>
                  }
                />
                {/* Admin-only: exposes internal RPC diagnostics */}
                <Route
                  path="/dashboard-diagnostics"
                  element={
                    <ProtectedRoute>
                      <RoleGate allowedRoles={["admin"]}>
                        <DashboardDiagnostics />
                      </RoleGate>
                    </ProtectedRoute>
                  }
                />
                {/* Admin-only: tenant isolation smoke test */}
                <Route
                  path="/admin/tenant-isolation"
                  element={
                    <ProtectedRoute>
                      <RoleGate allowedRoles={["admin"]}>
                        <TenantIsolationSmoke />
                      </RoleGate>
                    </ProtectedRoute>
                  }
                />
                {/* Admin-only: UI smoke runner */}
                <Route
                  path="/admin/ui-smoke"
                  element={
                    <ProtectedRoute>
                      <RoleGate allowedRoles={["admin"]}>
                        <AdminUISmokeRunner />
                      </RoleGate>
                    </ProtectedRoute>
                  }
                />
                {/* Dev-only: QA Smart Memory runner */}
                <Route
                  path="/qa"
                  element={
                    <ProtectedRoute>
                      <AdminRoute>
                        <QASmartMemory />
                      </AdminRoute>
                    </ProtectedRoute>
                  }
                />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route
                  path="/system-audit"
                  element={
                    <ProtectedRoute>
                      <RoleGate allowedRoles={["admin"]}>
                        <SystemAudit />
                      </RoleGate>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/executive"
                  element={
                    <ProtectedRoute>
                      <RoleGate requirement="canViewExecutive" skeleton={<ExecutiveSkeleton />}>
                        <ExecutiveDashboard />
                      </RoleGate>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/health"
                  element={
                    <ProtectedRoute>
                      <RoleGate allowedRoles={["admin", "pm"]}>
                        <HealthCheck />
                      </RoleGate>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/executive-report"
                  element={
                    <ProtectedRoute>
                      <ExecutiveReport />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/export"
                  element={
                    <ProtectedRoute>
                      <AdminRoute>
                        <Export />
                      </AdminRoute>
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
