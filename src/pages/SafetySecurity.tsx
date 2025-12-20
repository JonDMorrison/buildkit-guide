import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Shield, Lock, FileCheck, Eye, Users, FileText, Menu, ChevronRight } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import buildSenseLogo from "@/assets/build-sense-logo.png";
import trustHero from "@/assets/trust-integrity-hero.jpg";

export default function SafetySecurity() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavigation = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-background/98 backdrop-blur-md border-b border-border z-50 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer" 
            onClick={() => navigate('/')}
          >
            <img src={buildSenseLogo} alt="Build Sense" className="h-9 w-9" />
            <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">Build Sense</h1>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate('/how-it-works')} className="text-base">
              How It Works
            </Button>
            <Button variant="ghost" onClick={() => navigate('/safety-security')} className="text-base font-semibold">
              Safety & Security
            </Button>
            <Button variant="ghost" onClick={() => navigate('/responsible-ai')} className="text-base">
              Responsible AI
            </Button>
            <Button variant="ghost" onClick={() => navigate('/auth')} className="text-base">
              Sign In
            </Button>
            <Button onClick={() => navigate('/auth')} className="bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white font-semibold h-12 px-6 text-base">
              Login
            </Button>
          </div>

          {/* Mobile Navigation */}
          <div className="flex md:hidden items-center gap-2">
            <Button onClick={() => navigate('/auth')} className="bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white font-semibold h-12 px-4 text-sm">
              Login
            </Button>
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-12 w-12">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] sm:w-[320px]">
                <SheetHeader className="text-left mb-6">
                  <SheetTitle className="flex items-center gap-2">
                    <img src={buildSenseLogo} alt="Build Sense" className="h-8 w-8" />
                    <span className="text-2xl font-bold">Build Sense</span>
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-4">
                  <Button variant="ghost" onClick={() => handleNavigation('/how-it-works')} className="justify-start text-base h-12 font-medium">
                    How It Works
                  </Button>
                  <Button variant="ghost" onClick={() => handleNavigation('/safety-security')} className="justify-start text-base h-12 font-semibold">
                    Safety & Security
                  </Button>
                  <Button variant="ghost" onClick={() => handleNavigation('/responsible-ai')} className="justify-start text-base h-12 font-medium">
                    Responsible AI
                  </Button>
                  <Button variant="ghost" onClick={() => handleNavigation('/auth')} className="justify-start text-base h-12 font-medium">
                    Sign In
                  </Button>
                  <div className="pt-4 border-t border-border">
                    <Button onClick={() => handleNavigation('/auth')} className="w-full bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white font-semibold h-12 text-base">
                      Login
                    </Button>
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section 
        className="pt-28 md:pt-32 pb-16 md:pb-20 px-4 relative overflow-hidden min-h-[60vh] flex items-center"
        style={{
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.75)), url(${trustHero})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            Our Commitment to Safety, Security, and Trust
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl text-gray-200 mb-4 leading-relaxed max-w-3xl mx-auto">
            Safety documentation you can trust — even under inspection
          </p>
          <p className="text-base md:text-lg text-gray-300 leading-relaxed max-w-2xl mx-auto">
            We design our systems for real-world job sites, regulatory scrutiny, and long-term accountability.
          </p>
        </div>
      </section>

      {/* Built for Real Safety Work */}
      <section className="py-16 md:py-20 px-4 bg-background">
        <div className="container mx-auto max-w-4xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-muted rounded-lg">
              <FileCheck className="h-6 w-6 text-foreground" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              Built for Real Safety Work
            </h2>
          </div>
          <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
            This system is designed for daily safety logs, toolbox meetings, incidents, near misses, and right-to-refuse documentation. It reflects how safety actually happens on site — not just how it looks on paper.
          </p>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              "Designed for field conditions",
              "Supports worker acknowledgment and signatures",
              "Encourages completeness without blocking work"
            ].map((item, index) => (
              <div key={index} className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg border border-border">
                <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <p className="text-foreground font-medium">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Record Integrity & Auditability */}
      <section className="py-16 md:py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-background rounded-lg border border-border">
              <Lock className="h-6 w-6 text-foreground" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              Record Integrity & Auditability
            </h2>
          </div>
          <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
            Every record in our system is designed to be tamper-evident and auditable. We don't claim records are impossible to change — we make any changes visible and traceable.
          </p>
          <div className="space-y-4">
            <div className="p-5 bg-background rounded-lg border border-border">
              <h3 className="font-semibold text-foreground mb-2">Time-stamped Submissions</h3>
              <p className="text-muted-foreground">Records are time-stamped at the moment of submission, creating a clear timeline of when documentation was completed.</p>
            </div>
            <div className="p-5 bg-background rounded-lg border border-border">
              <h3 className="font-semibold text-foreground mb-2">Locked After Completion</h3>
              <p className="text-muted-foreground">Submissions are locked after completion. Changes require formal amendments with documented reasons.</p>
            </div>
            <div className="p-5 bg-background rounded-lg border border-border">
              <h3 className="font-semibold text-foreground mb-2">Tamper-Evident Record Hash</h3>
              <p className="text-muted-foreground">A unique digital fingerprint (hash) is generated for each record. If any data changes, the fingerprint no longer matches — making unauthorized modifications detectable.</p>
            </div>
            <div className="p-5 bg-background rounded-lg border border-border">
              <h3 className="font-semibold text-foreground mb-2">Amendment History</h3>
              <p className="text-muted-foreground">All amendments show what changed, why, who approved it, and when. Original records are always preserved.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Security by Design */}
      <section className="py-16 md:py-20 px-4 bg-background">
        <div className="container mx-auto max-w-4xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-muted rounded-lg">
              <Shield className="h-6 w-6 text-foreground" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              Security by Design
            </h2>
          </div>
          <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
            Security is built into the architecture of our system, not added as an afterthought.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-5 bg-muted/50 rounded-lg border border-border">
              <h3 className="font-semibold text-foreground mb-2">Role-Based Access Controls</h3>
              <p className="text-muted-foreground text-sm">Different permissions for workers, foremen, project managers, and administrators.</p>
            </div>
            <div className="p-5 bg-muted/50 rounded-lg border border-border">
              <h3 className="font-semibold text-foreground mb-2">No Silent Edits</h3>
              <p className="text-muted-foreground text-sm">Changes to safety records require documented amendments with approval workflows.</p>
            </div>
            <div className="p-5 bg-muted/50 rounded-lg border border-border">
              <h3 className="font-semibold text-foreground mb-2">No Deleted Records</h3>
              <p className="text-muted-foreground text-sm">Safety records cannot be permanently deleted. Historical data is preserved.</p>
            </div>
            <div className="p-5 bg-muted/50 rounded-lg border border-border">
              <h3 className="font-semibold text-foreground mb-2">Separation of Duties</h3>
              <p className="text-muted-foreground text-sm">Clear boundaries between who creates, reviews, and approves safety documentation.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Confidentiality & Access */}
      <section className="py-16 md:py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-background rounded-lg border border-border">
              <Eye className="h-6 w-6 text-foreground" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              Confidentiality & Access
            </h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 bg-background rounded-lg border border-border">
              <Users className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-foreground mb-1">Authorized Roles Only</h3>
                <p className="text-muted-foreground">Only authorized roles can view or act on records. Permissions are enforced at the system level, not just the UI.</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 bg-background rounded-lg border border-border">
              <Shield className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-foreground mb-1">Worker Acknowledgments Protected</h3>
                <p className="text-muted-foreground">Worker acknowledgments and signatures are recorded individually. The system tracks who acknowledged, when, and how.</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 bg-background rounded-lg border border-border">
              <Lock className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-foreground mb-1">Sensitive Details Protected</h3>
                <p className="text-muted-foreground">Sensitive incident details are not publicly visible. Access is logged and controlled.</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 bg-background rounded-lg border border-border">
              <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-foreground mb-1">Inspection-Ready Exports</h3>
                <p className="text-muted-foreground">Records can be exported instantly as inspection-ready PDFs. PDFs include timestamps, signatures, acknowledgments, and fingerprints.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Closing Statement */}
      <section className="py-16 md:py-20 px-4 bg-[#1C3B23]">
        <div className="container mx-auto max-w-3xl text-center">
          <p className="text-xl md:text-2xl text-white leading-relaxed mb-4">
            Safety systems only work when people trust them.
          </p>
          <p className="text-lg text-white/80 leading-relaxed">
            We design ours so records hold up — not just in daily use, but under review.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-border bg-background">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <img src={buildSenseLogo} alt="Build Sense" className="h-7 w-7" />
              <p className="text-sm text-muted-foreground">
                © 2024 Build Sense. Built for the field.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/safety-security')}>
                Safety & Security
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/responsible-ai')}>
                Responsible AI
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/auth')}>
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
