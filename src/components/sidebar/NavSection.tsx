import { cn } from "@/lib/utils";

interface NavSectionProps {
  title: string;
  collapsed?: boolean;
  children: React.ReactNode;
}

export const NavSection = ({ title, collapsed, children }: NavSectionProps) => {
  return (
    <div className="mt-3 first:mt-0">
      {!collapsed ? (
        <div className="px-5 mb-2 mt-4 animate-section-title">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-sidebar-foreground/30 select-none">
            {title}
          </span>
          <div className="mt-2 h-[1px] w-full bg-gradient-to-r from-sidebar-border via-sidebar-border to-transparent opacity-50" />
        </div>
      ) : (
        <div className="mx-4 mb-2 mt-4 h-[1px] bg-sidebar-border opacity-30" />
      )}

      <nav className={cn("flex flex-col gap-1", collapsed ? "px-1" : "px-2")}>
        {children}
      </nav>
    </div>
  );
};
