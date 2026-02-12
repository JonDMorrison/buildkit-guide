import { ReactNode } from "react";
import { TopNav } from "./TopNav";
import { TabBar } from "./TabBar";
import { GlobalAIAssist } from "./ai-assist/GlobalAIAssist";
import { Breadcrumbs } from "./Breadcrumbs";
import { PageTransition } from "./PageTransition";
import { ConnectionStatus } from "./ConnectionStatus";

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="flex flex-col h-screen bg-background">
      <ConnectionStatus />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[200] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>
      <TopNav />
      <Breadcrumbs />
      <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto pb-tab-bar outline-none">
        <PageTransition>{children}</PageTransition>
      </main>
      <TabBar />
      <GlobalAIAssist />
    </div>
  );
};
