import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { CheckCircle, FileX, Ban, FolderSearch, MessageSquareWarning, FileStack, TrendingDown, Clock, MapPin, Brain, Shield, Wifi, WifiOff, ChevronDown, ChevronUp, Receipt, FileCheck, Mic, ClipboardList, AlertTriangle, Calendar, HardHat, Users, Sparkles } from "lucide-react";
import { useState } from "react";
import heroBackground from "@/assets/hero-construction-bg.jpg";
import screenshotTasks from "@/assets/screenshot-tasks.png";
import screenshotSafety from "@/assets/screenshot-safety.png";
import screenshotBlockers from "@/assets/screenshot-blockers.png";
import screenshotLookahead from "@/assets/screenshot-lookahead.png";
import screenshotAi from "@/assets/screenshot-ai.png";
import successOrganized from "@/assets/success-organized.jpg";
import projectPathLogo from "@/assets/project-path-logo.png";
import { PublicNav } from "@/components/PublicNav";

export default function Landing() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  
  const handleGetStarted = () => {
    navigate('/auth?tab=signup');
  };

  const handleSeeHowItWorks = () => {
    navigate('/how-it-works');
  };
  
  const handleSeePricing = () => {
    document.getElementById('plan')?.scrollIntoView({
      behavior: 'smooth'
    });
  };

  const faqs = [
    {
      question: "What does the free trial include?",
      answer: "Full access to all features for 14 days. No credit card required. Create unlimited projects, invite your whole team, and test every feature including time tracking, safety forms, and AI assistance."
    },
    {
      question: "Do I need to train my team?",
      answer: "Most crews are productive within 10 minutes. The interface is designed for the field—big buttons, simple flows, one-tap actions. We also provide quick-start guides and video tutorials."
    },
    {
      question: "Can I import my existing data?",
      answer: "Yes. Import deficiency lists from your GC, upload existing documents, and migrate project data. Our support team can help with bulk imports."
    },
    {
      question: "What if we have no cell signal on site?",
      answer: "Project Path works offline. Time entries, safety forms, and task updates queue locally and sync automatically when you reconnect. Never lose data."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <PublicNav />

      {/* Hero Section */}
      <section className="pt-20 md:pt-32 pb-16 md:pb-20 px-4 relative overflow-hidden min-h-[100dvh] md:min-h-[80vh] flex items-center" style={{
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.75), rgba(0, 0, 0, 0.85)), url(${heroBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}>
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-8 md:gap-12 items-center">
            <div className="text-center lg:text-left">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 md:mb-6 leading-[1.15]">
                Take Every Project From Chaos to Clarity
              </h1>
              <p className="text-lg sm:text-xl md:text-2xl text-gray-200 mb-4 md:mb-6 leading-relaxed">
                Track tasks, time, and safety across every trade — from one app.
              </p>
              <p className="text-sm sm:text-base text-white/70 mb-6 md:mb-8">
                No credit card required • Free 14-day trial • Setup in minutes
              </p>
              <div className="flex flex-col gap-3 justify-center lg:justify-start w-full max-w-md mx-auto lg:mx-0">
                <Button size="lg" onClick={handleGetStarted} className="w-full h-11 md:h-16 text-sm md:text-lg bg-accent hover:bg-accent/90 text-white font-semibold shadow-xl">
                  Start Your Free Trial
                </Button>
                <Button size="lg" variant="outline" onClick={handleSeeHowItWorks} className="w-full h-11 md:h-16 text-sm md:text-lg bg-white/15 text-white border-white/40 hover:bg-white/25 font-semibold backdrop-blur-sm">
                  See How It Works
                </Button>
              </div>
            </div>
            <div className="hidden lg:flex justify-center mt-8 lg:mt-0">
              <img alt="Project Path App Dashboard" className="w-full max-w-md lg:max-w-lg rounded-lg shadow-2xl" loading="eager" src="/lovable-uploads/4e1b85d6-7eda-4f22-abb7-fb02a677b21c.png" />
            </div>
          </div>
        </div>
      </section>

      {/* The Problem - Emotional Text + Image */}
      <section className="py-16 md:py-24 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-10 md:gap-16 items-center">
            <div className="order-2 lg:order-1">
              <p className="text-primary font-semibold mb-3 uppercase tracking-wide text-sm">The Problem</p>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-6 leading-tight">
                Projects Fall Behind When Trades Don't Stay Aligned
              </h2>
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                Your PM spends 40% of their day chasing updates. Gantt charts get buried. Blocked tasks go unreported until they become expensive problems.
              </p>
              <div className="space-y-3">
                {[
                  "Scattered tools create scattered information",
                  "Safety forms live in filing cabinets",
                  "Little delays compound into big problems"
                ].map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                      <TrendingDown className="h-4 w-4 text-destructive" />
                    </div>
                    <p className="text-foreground font-medium">{item}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <img 
                src={screenshotBlockers} 
                alt="Blocker reporting interface" 
                className="w-full rounded-xl shadow-2xl border border-border"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Task Accountability - Text Left, Image Right */}
      <section className="py-16 md:py-24 px-4 bg-background">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-10 md:gap-16 items-center">
            <div>
              <p className="text-primary font-semibold mb-3 uppercase tracking-wide text-sm">Task Management</p>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-6 leading-tight">
                Every Trade Knows Exactly What They Owe
              </h2>
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                No more chasing updates or wondering who's on what. Every task has an owner, a deadline, and clear visibility. When something's blocked, you know instantly—not when it's too late.
              </p>
              <div className="space-y-4">
                {[
                  { icon: ClipboardList, text: "Tasks assigned with clear ownership" },
                  { icon: AlertTriangle, text: "Instant blocker reporting" },
                  { icon: Calendar, text: "2-week lookahead for planning" }
                ].map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <div key={index} className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <p className="text-foreground font-medium">{item.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <img 
                src={screenshotTasks} 
                alt="Task management interface" 
                className="w-full rounded-xl shadow-2xl border border-border"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Safety - Text Right, Image Left */}
      <section className="py-16 md:py-24 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-10 md:gap-16 items-center">
            <div className="order-2 lg:order-1">
              <img 
                src={screenshotSafety} 
                alt="Safety form interface" 
                className="w-full rounded-xl shadow-2xl border border-border"
                loading="lazy"
              />
            </div>
            <div className="order-1 lg:order-2">
              <p className="text-primary font-semibold mb-3 uppercase tracking-wide text-sm">Safety Done Right</p>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-6 leading-tight">
                Complete Safety Logs in Under 3 Minutes
              </h2>
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                AI suggests today's hazards based on weather and scheduled tasks. Workers acknowledge with digital signatures. Everything is audit-ready from the moment it's submitted.
              </p>
              <div className="space-y-4">
                {[
                  { icon: HardHat, text: "Daily safety logs with AI suggestions" },
                  { icon: FileCheck, text: "Digital signatures and timestamps" },
                  { icon: Shield, text: "Tamper-evident records" }
                ].map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <div key={index} className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <p className="text-foreground font-medium">{item.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Time Tracking - Text Left, Image Right */}
      <section className="py-16 md:py-24 px-4 bg-background">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-10 md:gap-16 items-center">
            <div>
              <p className="text-primary font-semibold mb-3 uppercase tracking-wide text-sm">Time Tracking</p>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-6 leading-tight">
                Accurate Timesheets Without the Arguments
              </h2>
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                Your crew checks in with one tap. GPS verification proves job site presence. No more buddy punching, no more disputes. Export payroll-ready reports in seconds.
              </p>
              <div className="space-y-4">
                {[
                  { icon: Clock, text: "One-tap check-in from any phone" },
                  { icon: MapPin, text: "GPS verification eliminates disputes" },
                  { icon: FileCheck, text: "Works with any payroll system" }
                ].map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <div key={index} className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="h-5 w-5 text-accent" />
                      </div>
                      <p className="text-foreground font-medium">{item.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <img 
                src={screenshotLookahead} 
                alt="Lookahead and planning interface" 
                className="w-full rounded-xl shadow-2xl border border-border"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      {/* AI Section - Text Right, Image Left */}
      <section className="py-16 md:py-24 px-4 bg-primary">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-10 md:gap-16 items-center">
            <div className="order-2 lg:order-1">
              <img 
                src={screenshotAi} 
                alt="AI assistant interface" 
                className="w-full rounded-xl shadow-2xl"
                loading="lazy"
              />
            </div>
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 bg-primary-foreground/10 backdrop-blur-sm rounded-full px-4 py-2 mb-4">
                <Brain className="h-4 w-4 text-primary-foreground" />
                <span className="text-sm font-medium text-primary-foreground">Powered by AI</span>
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary-foreground mb-6 leading-tight">
                AI That Actually Understands Construction
              </h2>
              <p className="text-lg text-primary-foreground/80 mb-6 leading-relaxed">
                Ask questions about your project documents in plain English. Draft professional escalation emails in seconds. Get hazard suggestions based on real conditions.
              </p>
              <div className="space-y-4">
                {[
                  { icon: FolderSearch, text: "Document Q&A with source references" },
                  { icon: MessageSquareWarning, text: "Escalation emails drafted instantly" },
                  { icon: Receipt, text: "Receipt scanning and categorization" }
                ].map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <div key={index} className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary-foreground/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="h-5 w-5 text-primary-foreground" />
                      </div>
                      <p className="text-primary-foreground font-medium">{item.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Built for the Field - Condensed Icon Section */}
      <section className="py-16 md:py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-10 md:mb-12">
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight">
              Built for the Site, Not the Office
            </h3>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Designed for gloved hands, bright sunlight, and spotty cell signal.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: WifiOff, title: "Works Offline", description: "Sync when you reconnect" },
              { icon: CheckCircle, title: "Big Tap Targets", description: "One-hand operation" },
              { icon: Shield, title: "High Contrast", description: "Readable in sunlight" },
              { icon: Mic, title: "Voice Input", description: "Dictate notes hands-free" }
            ].map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={index} className="p-5 bg-card rounded-lg border border-border text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h4 className="text-lg font-bold text-foreground mb-1">{item.title}</h4>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* The Plan - 3 Steps */}
      <section id="plan" className="py-16 md:py-20 px-4 bg-background">
        <div className="container mx-auto max-w-4xl">
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-8 md:mb-12 text-center leading-tight">
            Get Your Jobs Under Control
          </h3>
          <div className="grid sm:grid-cols-3 gap-6 md:gap-8">
            {[{
              step: "1",
              title: "Sign Up Free",
              description: "Create your account in 2 minutes. No credit card required."
            }, {
              step: "2",
              title: "Add Your Project",
              description: "Set up your first project and invite your team."
            }, {
              step: "3",
              title: "Keep Jobs Moving",
              description: "Start tracking tasks, logging safety, and saving time."
            }].map((item, index) => (
              <div key={index} className="text-center">
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-primary text-primary-foreground text-xl md:text-2xl font-bold flex items-center justify-center mx-auto mb-3 md:mb-4 shadow-lg">
                  {item.step}
                </div>
                <h4 className="text-lg md:text-xl font-bold text-foreground mb-2">{item.title}</h4>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Value CTA */}
      <section className="py-16 md:py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-3xl text-center">
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4 md:mb-6 leading-tight">
            Every Day of Delay Costs Money
          </h3>
          <p className="text-base md:text-lg text-muted-foreground mb-8 md:mb-10 leading-relaxed max-w-2xl mx-auto">
            Eliminate downtime. Prevent schedule slippage. Keep the GC happy. Protect your margins.
          </p>
          <div className="flex flex-col gap-3 justify-center w-full max-w-md mx-auto">
            <Button size="lg" onClick={handleGetStarted} className="w-full h-14 md:h-16 text-base md:text-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xl">
              Start Your Free Trial
            </Button>
            <Button size="lg" variant="outline" onClick={handleSeePricing} className="w-full h-14 md:h-16 text-base md:text-lg font-semibold">
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
            {["Trades show up ready", "Blockers handled fast", "Safety always documented", "Shorter meetings", "Clear next steps", "On-time completion"].map((item, index) => (
              <div key={index} className="flex items-start gap-3 p-4 md:p-5 bg-card/90 backdrop-blur-md rounded-lg shadow-sm">
                <CheckCircle className="h-6 w-6 md:h-7 md:w-7 text-primary flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                <p className="text-base md:text-lg text-foreground font-semibold">{item}</p>
              </div>
            ))}
          </div>
          <p className="text-base md:text-lg text-muted-foreground text-center max-w-2xl mx-auto leading-relaxed font-medium">
            Build a job you can be proud of. A GC who wants to work with you again.
          </p>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 md:py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-3xl">
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-8 md:mb-12 text-center leading-tight">
            Common Questions
          </h3>
          <div className="space-y-3">
            {faqs.map((faq, index) => (
              <div key={index} className="bg-card rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-muted/50 transition-colors"
                >
                  <span className="text-base md:text-lg font-semibold text-foreground pr-4">{faq.question}</span>
                  {openFaq === index ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  )}
                </button>
                {openFaq === index && (
                  <div className="px-5 pb-5">
                    <p className="text-muted-foreground leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 md:py-28 px-4 bg-primary">
        <div className="container mx-auto max-w-3xl text-center">
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary-foreground mb-4 leading-tight">
            Stop Chasing Updates. Start Building.
          </h3>
          <p className="text-lg md:text-xl text-primary-foreground/90 mb-8 max-w-xl mx-auto">
            Join contractors who finish on time and protect their margins.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
            <Button 
              size="lg" 
              onClick={handleGetStarted} 
              className="w-full sm:w-auto h-14 md:h-16 px-8 text-base md:text-lg bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-bold shadow-xl"
            >
              Start Your Free Trial
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              onClick={handleSeeHowItWorks} 
              className="w-full sm:w-auto h-14 md:h-16 px-8 text-base md:text-lg bg-transparent text-primary-foreground border-primary-foreground/50 hover:bg-primary-foreground/10 font-semibold"
            >
              Book a Demo
            </Button>
          </div>
          <p className="text-sm text-primary-foreground/70 mt-6">
            No credit card required • Free 14-day trial • Cancel anytime
          </p>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="py-8 px-4 bg-card border-t border-border">
        <div className="container mx-auto max-w-4xl">
          <div className="flex flex-wrap justify-center items-center gap-6 md:gap-12 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span>Your data stays yours</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-border">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <img src={projectPathLogo} alt="Project Path" className="h-8 w-auto max-w-[120px]" />
              <p className="text-sm text-foreground/70">
                © 2025 Project Path. Built for the field.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/features')}>
                Features
              </Button>
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
