import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { Button } from "./ui/button";
import { UserMenu } from "./UserMenu";
import { NotificationsDropdown } from "./notifications/NotificationsDropdown";
import { OrganizationSwitcher } from "./OrganizationSwitcher";
import { GlobalSearchModal } from "./GlobalSearchModal";
import projectPulseLogo from "@/assets/project-pulse-logo.png";
import { useIsMobile } from "@/hooks/use-mobile";

export const TopNav = () => {
  const [searchOpen, setSearchOpen] = useState(false);
  const isMobile = useIsMobile();

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
      <nav className="sticky top-0 z-50 flex items-center justify-between h-nav px-2 sm:px-4 bg-card border-b border-border">
        <div className="flex items-center gap-2 sm:gap-4">
          <img src={projectPulseLogo} alt="Project Pulse" className={isMobile ? "h-12 w-auto" : "h-20 w-auto"} />
          <OrganizationSwitcher />
        </div>
        
        <div className="flex items-center gap-2">
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
          <NotificationsDropdown />
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
