import { ReactNode } from "react";
import { TopNav } from "./TopNav";
import { TabBar } from "./TabBar";
import { GlobalAIAssist } from "./ai-assist/GlobalAIAssist";
import { Breadcrumbs } from "./Breadcrumbs";
import { PageTransition } from "./PageTransition";
import { ConnectionStatus } from "./ConnectionStatus";
import { AppSidebar } from "./AppSidebar";
import { SidebarProvider } from "./ui/sidebar";

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <ConnectionStatus />
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:z-[200] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:text-sm focus:font-medium"
          >
            Skip to main content
          </a>
          <TopNav />
          <Breadcrumbs />
          <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto pb-tab-bar md:pb-0 outline-none">
            <PageTransition>{children}</PageTransition>
          </main>
        </div>
      </div>
      <TabBar />
      <GlobalAIAssist />
    </SidebarProvider>
  );
};
