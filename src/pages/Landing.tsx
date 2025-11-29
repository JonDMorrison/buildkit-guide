import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { CheckCircle, FileX, Ban, FolderSearch, MessageSquareWarning, FileStack, TrendingDown } from "lucide-react";
import heroBackground from "@/assets/hero-construction-bg.jpg";
import heroMockup from "@/assets/hero-app-mockup.png";
import problemChaos from "@/assets/problem-chaos.jpg";
import successOrganized from "@/assets/success-organized.jpg";
import iconTasks from "@/assets/icon-tasks.png";
import iconBlocker from "@/assets/icon-blocker.png";
import iconLookahead from "@/assets/icon-lookahead.png";
import iconSafety from "@/assets/icon-safety.png";
import iconManpower from "@/assets/icon-manpower.png";
import iconAI from "@/assets/icon-ai.png";
export default function Landing() {
  const navigate = useNavigate();
  const handleBookDemo = () => {
    window.location.href = "mailto:demo@fieldsync.app?subject=Demo Request";
  };
  const handleSeeHowItWorks = () => {
    navigate('/how-it-works');
  };
  const handleSeePricing = () => {
    document.getElementById('plan')?.scrollIntoView({
      behavior: 'smooth'
    });
  };
  return <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-background/98 backdrop-blur-md border-b border-border z-50 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">FieldSync</h1>
          <div className="flex items-center gap-2 md:gap-3">
            <Button variant="ghost" onClick={() => navigate('/how-it-works')} className="hidden md:inline-flex text-base">
              How It Works
            </Button>
            <Button variant="ghost" onClick={() => navigate('/auth')} className="hidden sm:inline-flex text-base">
              Sign In
            </Button>
            <Button onClick={handleBookDemo} className="bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white font-semibold h-12 px-6 text-base">
              Book Demo
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-28 md:pt-32 pb-16 md:pb-20 px-4 relative overflow-hidden min-h-[90vh] md:min-h-[80vh] flex items-center" style={{
      backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.75), rgba(0, 0, 0, 0.85)), url(${heroBackground})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }}>
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-8 md:gap-12 items-center">
            <div className="text-center lg:text-left">
              <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 md:mb-6 leading-[1.15]">
                Your Job Site Is Bleeding Time. This Stops It.
              </h2>
              <p className="text-lg sm:text-xl md:text-2xl text-gray-200 mb-6 md:mb-8 leading-relaxed">
                Keep every trade accountable and your schedule on track.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center lg:justify-start">
                <Button size="lg" onClick={handleBookDemo} className="h-14 md:h-16 px-8 md:px-10 text-base md:text-lg bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white font-semibold shadow-xl">
                  Book a Demo
                </Button>
                <Button size="lg" variant="outline" onClick={handleSeeHowItWorks} className="h-14 md:h-16 px-8 md:px-10 text-base md:text-lg bg-white/10 text-white border-white/30 hover:bg-white/20 font-semibold backdrop-blur-sm">
                  See How It Works
                </Button>
              </div>
            </div>
            <div className="flex justify-center mt-8 lg:mt-0">
              <img alt="FieldSync App Dashboard" className="w-full max-w-md lg:max-w-lg rounded-lg shadow-2xl" loading="eager" src="/lovable-uploads/4e1b85d6-7eda-4f22-abb7-fb02a677b21c.png" />
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-12 px-4 bg-card border-y border-border">
        <div className="container mx-auto max-w-4xl text-center">
          <p className="text-sm uppercase tracking-wider text-muted-foreground mb-6 font-semibold">
            Trusted by Contractors Who Keep Jobs Moving
          </p>
          <div className="flex flex-wrap justify-center items-center gap-8 opacity-60">
            {["Horizon Construction", "BuildRight Co", "Prime Builders", "SteelFrame Inc"].map((company, idx) => <div key={idx} className="text-lg font-bold text-foreground">
                {company}
              </div>)}
          </div>
        </div>
      </section>

      {/* The Problem */}
      <section className="py-16 md:py-20 px-4 bg-muted/30 relative">
        <div className="absolute inset-0 opacity-20">
          <img src={problemChaos} alt="Construction site chaos" className="w-full h-full object-cover" loading="lazy" />
        </div>
        <div className="container mx-auto max-w-4xl relative z-10">
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-6 md:mb-8 text-center leading-tight">
            Projects Fall Behind When Trades Do Not Stay Aligned
          </h3>
          <div className="grid sm:grid-cols-2 gap-3 md:gap-4 mb-6 md:mb-8">
            {[
              { icon: FileX, text: "Gantt charts get buried and forgotten" },
              { icon: Ban, text: "Blocked tasks go unreported" },
              { icon: FolderSearch, text: "Safety forms live in too many places" },
              { icon: MessageSquareWarning, text: "PMs chase updates all day" },
              { icon: FileStack, text: "Foremen drown in admin" },
              { icon: TrendingDown, text: "Little delays turn into big problems" }
            ].map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={index} className="flex items-start gap-3 p-4 md:p-5 bg-transparent backdrop-blur-sm rounded-lg border border-border hover:border-destructive/30 transition-colors">
                  <div className="flex-shrink-0 mt-0.5">
                    <Icon className="h-6 w-6 md:h-7 md:w-7 text-destructive" strokeWidth={2.5} />
                  </div>
                  <p className="text-base md:text-lg text-foreground font-medium">{item.text}</p>
                </div>
              );
            })}
          </div>
          <p className="text-base md:text-lg text-muted-foreground text-center max-w-2xl mx-auto leading-relaxed">
            When communication breaks down you lose time and money. You know the job could move faster.
          </p>
        </div>
      </section>

      {/* The Guide */}
      <section className="py-16 md:py-20 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4 md:mb-6 leading-tight">
            You Do Not Need More Meetings. You Need Control.
          </h3>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
            Built for crews who need quick answers, not complicated software.
          </p>
        </div>
      </section>

      {/* The Solution */}
      <section id="solution" className="py-16 md:py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-5xl">
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-8 md:mb-12 text-center leading-tight">
            Keep Your Site Moving
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
            {[{
            title: "Task Accountability",
            description: "Every trade sees what they owe.",
            icon: iconTasks
          }, {
            title: "Instant Blocker Reporting",
            description: "Know when a task is blocked and why.",
            icon: iconBlocker
          }, {
            title: "2-Week Lookahead",
            description: "Visual plan of the next two weeks.",
            icon: iconLookahead
          }, {
            title: "Safety Done Right",
            description: "Daily logs, hazard IDs, and incident reports.",
            icon: iconSafety
          }, {
            title: "Manpower Planning",
            description: "Request crews and prevent shortages.",
            icon: iconManpower
          }, {
            title: "AI Support",
            description: "AI reads docs, answers questions, identifies risks.",
            icon: iconAI
          }].map((feature, index) => <div key={index} className="p-5 md:p-6 bg-card rounded-lg border border-border hover:border-[#FF6B35]/50 hover:shadow-md transition-all">
                <img src={feature.icon} alt={feature.title} className="w-14 h-14 md:w-16 md:h-16 mb-3 md:mb-4 rounded-lg" loading="lazy" />
                <h4 className="text-lg md:text-xl font-bold text-foreground mb-2 md:mb-3">{feature.title}</h4>
                <p className="text-sm md:text-base text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>)}
          </div>
        </div>
      </section>

      {/* The Plan */}
      <section id="plan" className="py-16 md:py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-8 md:mb-12 text-center leading-tight">
            Get Your Jobs Under Control
          </h3>
          <div className="grid sm:grid-cols-3 gap-6 md:gap-8">
            {[{
            step: "1",
            title: "Book a Demo"
          }, {
            step: "2",
            title: "Set Up Projects"
          }, {
            step: "3",
            title: "Keep Jobs Moving"
          }].map((item, index) => <div key={index} className="text-center">
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-[#FF6B35] text-white text-xl md:text-2xl font-bold flex items-center justify-center mx-auto mb-3 md:mb-4 shadow-lg">
                  {item.step}
                </div>
                <h4 className="text-lg md:text-xl font-bold text-foreground">{item.title}</h4>
              </div>)}
          </div>
        </div>
      </section>

      {/* Value and CTA Combined */}
      <section className="py-16 md:py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-3xl text-center">
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4 md:mb-6 leading-tight">
            Every Day of Delay Costs Money
          </h3>
          <p className="text-base md:text-lg text-muted-foreground mb-8 md:mb-10 leading-relaxed max-w-2xl mx-auto">
            Eliminate downtime. Prevent schedule slippage. Keep the GC happy. Protect your margins.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center">
            <Button size="lg" onClick={handleBookDemo} className="h-14 md:h-16 px-8 md:px-10 text-base md:text-lg bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white font-semibold shadow-xl">
              Book a Demo
            </Button>
            <Button size="lg" variant="outline" onClick={handleSeePricing} className="h-14 md:h-16 px-8 md:px-10 text-base md:text-lg font-semibold">
              See Pricing
            </Button>
          </div>
        </div>
      </section>

      {/* Success Vision */}
      <section className="py-16 md:py-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={successOrganized} alt="Organized construction site" className="w-full h-full object-cover" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/90 to-background/80" />
        </div>
        <div className="container mx-auto max-w-4xl relative z-10">
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-6 md:mb-10 text-center leading-tight">
            A Job Site With Zero Guesswork
          </h3>
          <div className="grid sm:grid-cols-2 gap-3 md:gap-4 mb-6 md:mb-8">
            {["Trades show up ready", "Blockers handled fast", "Safety organized", "Shorter meetings", "Clear next steps", "On-time completion"].map((item, index) => <div key={index} className="flex items-start gap-3 p-4 md:p-5 bg-card/90 backdrop-blur-md rounded-lg shadow-sm">
                <CheckCircle className="h-6 w-6 md:h-7 md:w-7 text-[#FF6B35] flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                <p className="text-base md:text-lg text-foreground font-semibold">{item}</p>
              </div>)}
          </div>
          <p className="text-base md:text-lg text-muted-foreground text-center max-w-2xl mx-auto leading-relaxed font-medium">
            Build a job you can be proud of. A GC who wants to work with you again.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-border">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © 2024 FieldSync. Built for the field.
            </p>
            <Button variant="ghost" onClick={() => navigate('/auth')}>
              Sign In
            </Button>
          </div>
        </div>
      </footer>
    </div>;
}