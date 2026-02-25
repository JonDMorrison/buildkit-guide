import { useLocation, Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./ui/breadcrumb";
import { useIsMobile } from "@/hooks/use-mobile";

const routeLabels: Record<string, string> = {
  dashboard: "Dashboard",
  tasks: "Tasks",
  lookahead: "Lookahead",
  manpower: "Manpower",
  deficiencies: "Deficiencies",
  safety: "Safety",
  ai: "AI Assistant",
  notifications: "Notifications",
  documents: "Documents",
  users: "User Management",
  audit: "Audit Log",
  "daily-logs": "Daily Logs",
  receipts: "Receipts",
  time: "Time Tracking",
  drawings: "Drawings",
  "hours-tracking": "Hours Tracking",
  setup: "Setup",
  "job-cost-report": "Job Cost",
  invoicing: "Invoicing",
  projects: "Projects",
  settings: "Settings",
  accounting: "Accounting",
};

export const Breadcrumbs = () => {
  const location = useLocation();
  const isMobile = useIsMobile();

  const segments = location.pathname.split("/").filter(Boolean);
  if (segments.length <= 1) return null;

  // Hide global breadcrumb on project detail pages — they render their own breadcrumb with the project name
  if (segments[0] === 'projects' && segments.length === 2 && segments[1] !== '') return null;

  const crumbs = segments.map((seg, i) => ({
    label: routeLabels[seg] || seg.charAt(0).toUpperCase() + seg.slice(1),
    path: "/" + segments.slice(0, i + 1).join("/"),
    isLast: i === segments.length - 1,
  }));

  if (isMobile) {
    const parent = crumbs[crumbs.length - 2];
    return (
      <div className="px-4 py-2">
        <Link
          to={parent.path}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
        >
          <ChevronLeft className="h-4 w-4" />
          {parent.label}
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 py-2">
      <Breadcrumb>
        <BreadcrumbList>
          {crumbs.map((crumb, i) => (
            <BreadcrumbItem key={crumb.path}>
              {i > 0 && <BreadcrumbSeparator />}
              {crumb.isLast ? (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link to={crumb.path}>{crumb.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
};
