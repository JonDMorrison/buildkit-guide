import { ReactNode } from "react";
import { TopNav } from "./TopNav";
import { TabBar } from "./TabBar";

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="flex flex-col h-screen bg-background">
      <TopNav />
      <main className="flex-1 overflow-y-auto pb-tab-bar">
        {children}
      </main>
      <TabBar />
    </div>
  );
};
