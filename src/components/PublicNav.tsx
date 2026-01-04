import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import projectPulseLogo from "@/assets/project-pulse-logo.png";

interface NavItem {
  label: string;
  path: string;
}

const navItems: NavItem[] = [
  { label: "How It Works", path: "/how-it-works" },
  { label: "Features", path: "/features" },
  { label: "Safety & Security", path: "/safety-security" },
];

export const PublicNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavigation = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed top-0 w-full bg-[#1a1a1a] backdrop-blur-md border-b border-white/10 z-50 shadow-sm">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div 
          className="flex items-center cursor-pointer" 
          onClick={() => navigate('/')}
        >
          <img src={projectPulseLogo} alt="Project Pulse" className="h-24 w-auto" />
        </div>
        
        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-3">
          {navItems.map((item) => (
            <Button 
              key={item.path}
              variant="ghost" 
              onClick={() => navigate(item.path)} 
              className={`text-base hover:bg-white/10 ${
                isActive(item.path) 
                  ? 'text-white font-semibold' 
                  : 'text-white/80 hover:text-white'
              }`}
            >
              {item.label}
            </Button>
          ))}
          <Button 
            variant="ghost" 
            onClick={() => navigate('/auth')} 
            className="text-base text-white/60 hover:text-white hover:bg-white/10"
          >
            Sign In
          </Button>
          <Button 
            onClick={() => navigate('/auth')} 
            className="bg-accent hover:bg-accent/90 text-white font-semibold h-12 px-6 text-base"
          >
            Get Started Free
          </Button>
        </div>

        {/* Mobile Navigation */}
        <div className="flex md:hidden items-center gap-2">
          <Button 
            onClick={() => navigate('/auth')} 
            className="bg-accent hover:bg-accent/90 text-white font-semibold h-12 px-4 text-sm"
          >
            Get Started
          </Button>
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-12 w-12 text-white hover:bg-white/10">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] sm:w-[320px]">
              <SheetHeader className="text-left mb-6">
                <SheetTitle>
                  <img src={projectPulseLogo} alt="Project Pulse" className="h-20 w-auto" />
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-4">
                {navItems.map((item) => (
                  <Button 
                    key={item.path}
                    variant="ghost" 
                    onClick={() => handleNavigation(item.path)} 
                    className={`justify-start text-base h-12 ${
                      isActive(item.path) ? 'font-semibold' : 'font-medium'
                    }`}
                  >
                    {item.label}
                  </Button>
                ))}
                <Button 
                  variant="ghost" 
                  onClick={() => handleNavigation('/auth')} 
                  className="justify-start text-base h-12 font-medium"
                >
                  Sign In
                </Button>
                <div className="pt-4 border-t border-border">
                  <Button 
                    onClick={() => handleNavigation('/auth')} 
                    className="w-full bg-accent hover:bg-accent/90 text-white font-semibold h-12 text-base"
                  >
                    Get Started Free
                  </Button>
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
};
