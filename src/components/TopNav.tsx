import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { UserMenu } from "./UserMenu";
import { ControlCenterDropdown } from "./control-center/ControlCenterDropdown";
import { SidebarTrigger } from "./ui/sidebar";
import { GlobalSearchModal } from "./GlobalSearchModal";
import { useOrganization } from "@/hooks/useOrganization";
import { useDefaultHomeRoute } from "@/hooks/useDefaultHomeRoute";
import projectPathLogo from "@/assets/project-path-logo.png";
import { useIsMobile } from "@/hooks/use-mobile";

export const TopNav = () => {
  const [searchOpen, setSearchOpen] = useState(false);
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { activeOrganization } = useOrganization();
  const { homeRoute } = useDefaultHomeRoute();

  // Global keyboard shortcut ⌘K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <nav className="sticky top-0 z-50 flex items-center justify-between h-nav px-2 sm:px-4 bg-card border-b border-border/40" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}>
        <div className="flex items-center gap-2 sm:gap-4">
          {!isMobile && <SidebarTrigger className="h-9 w-9" />}
          {/* Logo navigates to the role-appropriate home route */}
          <img
            src={projectPathLogo}
            alt="Project Path"
            className={`${isMobile ? "h-8 w-auto" : "h-10 w-auto"} cursor-pointer`}
            onClick={() => navigate(homeRoute)}
          />
          {activeOrganization?.is_sandbox && (
            <Badge variant="outline" className="border-amber-500/50 text-amber-500 bg-amber-500/10 text-xs font-medium">
              {activeOrganization.sandbox_label || "Sandbox"}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-3 ml-auto">
          <Button 
            variant="ghost" 
            size={isMobile ? "icon" : "default"}
            className={
              isMobile
                ? "min-h-10 min-w-10 hover:bg-muted"
                : "min-h-10 gap-2 px-3 hover:bg-muted"
            }
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-5 w-5 text-muted-foreground" />
            {!isMobile && (
              <>
                <span className="text-muted-foreground text-sm">Search...</span>
                <kbd className="ml-2 pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </>
            )}
          </Button>
          <ControlCenterDropdown />
          <UserMenu />
        </div>
      </nav>

      <GlobalSearchModal 
        open={searchOpen} 
        onOpenChange={setSearchOpen} 
      />
    </>
  );
};
