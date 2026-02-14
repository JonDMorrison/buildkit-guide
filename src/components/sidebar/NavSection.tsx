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
        <div className="px-4 mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/40 select-none">
            {title}
          </span>
          <div className="mt-1.5 border-t border-sidebar-border" />
        </div>
      ) : (
        <div className="mx-2 mb-2 border-t border-sidebar-border" />
      )}

      <nav className={cn("flex flex-col gap-0.5", collapsed ? "px-1" : "px-2")}>
        {children}
      </nav>
    </div>
  );
};
