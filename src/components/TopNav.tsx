import { Search } from "lucide-react";
import { Button } from "./ui/button";
import { UserMenu } from "./UserMenu";
import { NotificationsDropdown } from "./notifications/NotificationsDropdown";
import buildSenseLogo from "@/assets/build-sense-logo.png";

export const TopNav = () => {
  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between h-nav px-4 bg-card border-b border-border">
      <div className="flex items-center gap-2">
        <img src={buildSenseLogo} alt="Build Sense" className="h-8 w-8" />
        <h1 className="text-lg font-semibold text-foreground">Build Sense</h1>
      </div>
      
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="min-h-10 min-w-10">
          <Search className="h-5 w-5 text-muted-foreground" />
        </Button>
        <NotificationsDropdown />
        <UserMenu />
      </div>
    </nav>
  );
};
