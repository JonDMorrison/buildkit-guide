import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Home, LayoutDashboard, ClipboardList, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/project-path-logo.png";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background animate-fade-in">
      <div className="text-center max-w-md px-4">
        <img src={logo} alt="Project Path" className="h-10 mx-auto mb-6 opacity-80" />
        <h1 className="mb-4 text-6xl font-bold text-primary">404</h1>
        <p className="mb-2 text-xl font-semibold">Page not found</p>
        <p className="mb-6 text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
          <Button asChild>
            <Link to="/">
              <Home className="h-4 w-4 mr-2" />
              Home
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/dashboard">
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Dashboard
            </Link>
          </Button>
        </div>

        <div className="text-sm text-muted-foreground">
          <p className="mb-2">Quick links:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Link to="/tasks" className="text-primary hover:underline flex items-center gap-1">
              <ClipboardList className="h-3 w-3" />
              Tasks
            </Link>
            <span>•</span>
            <Link to="/safety" className="text-primary hover:underline flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Safety
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
