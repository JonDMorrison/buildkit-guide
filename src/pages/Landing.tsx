import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { CheckCircle, FileX, Ban, FolderSearch, MessageSquareWarning, FileStack, TrendingDown, Clock, MapPin, Brain, Shield, Wifi, WifiOff, ChevronDown, ChevronUp, Receipt, FileCheck, Mic, ClipboardList, AlertTriangle, Calendar, HardHat, Users, Sparkles } from "lucide-react";
import { useState } from "react";
import heroBackground from "@/assets/hero-construction-bg.jpg";
import problemChaos from "@/assets/problem-chaos.jpg";
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


      {/* The Problem */}
      <section className="py-16 md:py-20 px-4 bg-muted/30 relative">
        <div className="absolute inset-0 opacity-20">
          <img src={problemChaos} alt="Construction site chaos" className="w-full h-full object-cover" loading="lazy" />
        </div>
        <div className="container mx-auto max-w-4xl relative z-10">
          <p className="text-center text-lg md:text-xl text-muted-foreground mb-4 font-medium">Sound familiar?</p>
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
          <p className="text-base md:text-lg text-center max-w-2xl mx-auto leading-relaxed font-semibold text-foreground">
            There's a better way.
          </p>
        </div>
      </section>

      {/* Free Up Capacity - Major Differentiator */}
      <section className="py-16 md:py-20 px-4 bg-primary">
        <div className="container mx-auto max-w-4xl text-center">
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4 md:mb-6 leading-tight">
            Free Up Capacity Without Adding a Staff Member
          </h3>
          <p className="text-lg md:text-xl text-white/80 mb-8 leading-relaxed max-w-2xl mx-auto">
            Your PM spends 40% of their day chasing updates. Project Path gives that time back.
          </p>
          <div className="grid sm:grid-cols-3 gap-6 text-left">
            <div className="bg-white/10 p-5 rounded-lg border border-white/20">
              <p className="text-white font-semibold mb-2">Replace Scattered Tools</p>
              <p className="text-white/70 text-sm">One app replaces your spreadsheets, group texts, and endless meetings.</p>
            </div>
            <div className="bg-white/10 p-5 rounded-lg border border-white/20">
              <p className="text-white font-semibold mb-2">Coordinate 10 Trades</p>
              <p className="text-white/70 text-sm">Your foreman coordinates 10 trades with one screen. No phone tag.</p>
            </div>
            <div className="bg-white/10 p-5 rounded-lg border border-white/20">
              <p className="text-white font-semibold mb-2">Like Adding a Coordinator</p>
              <p className="text-white/70 text-sm">Get the benefits of a full-time coordinator without adding headcount.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Time Tracking Feature - NEW */}
      <section className="py-16 md:py-20 px-4 bg-background">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-10 md:mb-12">
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight">
              Time Tracking That Actually Works
            </h3>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Your crew checks in with one tap. You get accurate timesheets without the arguments.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: Clock, title: "One-Tap Check-In", description: "Workers clock in and out from their phone. No paper, no buddy punching." },
              { icon: MapPin, title: "GPS Verification", description: "Automatic location stamps prove job site presence. Disputes disappear." },
              { icon: FileCheck, title: "Payroll-Ready Export", description: "Download timesheets in seconds. Works with any payroll system." },
              { icon: MessageSquareWarning, title: "Adjustment Requests", description: "Workers request corrections with documented reasons. Full audit trail." }
            ].map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={index} className="p-5 bg-card rounded-lg border border-border hover:border-accent/50 hover:shadow-md transition-all text-center">
                  <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                    <Icon className="h-6 w-6 text-accent" />
                  </div>
                  <h4 className="text-lg font-bold text-foreground mb-2">{item.title}</h4>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* The Guide - Field First */}
      <section className="py-16 md:py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-10">
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4 md:mb-6 leading-tight">
              Built for the Site, Not the Office
            </h3>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              The best project management app for field teams. Designed for gloved hands and bright sunlight.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: WifiOff, title: "Works Offline", description: "Queue entries when connectivity drops. Sync when you're back online." },
              { icon: CheckCircle, title: "Big Tap Targets", description: "Designed for gloved hands and one-hand operation." },
              { icon: Shield, title: "High Contrast", description: "Readable in direct sunlight on any phone." },
              { icon: Mic, title: "Voice Input", description: "Dictate notes and reports hands-free." }
            ].map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={index} className="p-5 bg-card rounded-lg border border-border text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h4 className="text-lg font-bold text-foreground mb-2">{item.title}</h4>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* The Solution */}
      <section id="solution" className="py-16 md:py-20 px-4 bg-background">
        <div className="container mx-auto max-w-5xl">
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-8 md:mb-12 text-center leading-tight">
            Keep Your Site Moving
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
            {[{
              title: "Task Accountability",
              description: "Every trade sees exactly what they owe—and when. No more chasing updates.",
              Icon: ClipboardList
            }, {
              title: "Instant Blocker Reporting",
              description: "Workers flag issues in one tap. You see them instantly. Problems get solved.",
              Icon: AlertTriangle
            }, {
              title: "2-Week Lookahead",
              description: "Visual plan of the next two weeks. See conflicts before they cost you.",
              Icon: Calendar
            }, {
              title: "Safety Done Right",
              description: "Complete daily safety logs in under 3 minutes. AI suggests hazards based on weather and tasks.",
              Icon: HardHat
            }, {
              title: "Manpower Planning",
              description: "Request crews with one tap. Prevent shortages before they delay the job.",
              Icon: Users
            }, {
              title: "AI Support",
              description: "Ask questions about your project documents. Draft emails in seconds. Identify risks automatically.",
              Icon: Sparkles
            }].map((feature, index) => (
              <div key={index} className="p-5 md:p-6 bg-card rounded-lg border border-border hover:border-accent/50 hover:shadow-md transition-all">
                <div className="w-14 h-14 md:w-16 md:h-16 mb-3 md:mb-4 rounded-lg bg-primary/10 flex items-center justify-center">
                  <feature.Icon className="w-7 h-7 md:w-8 md:h-8 text-primary" strokeWidth={1.5} />
                </div>
                <h4 className="text-lg md:text-xl font-bold text-foreground mb-2 md:mb-3">{feature.title}</h4>
                <p className="text-sm md:text-base text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI-Powered Section - NEW */}
      {/* AI Section - Redesigned */}
      <section className="py-16 md:py-20 px-4 bg-gradient-to-br from-primary via-primary to-primary/90">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-10 md:mb-12">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-4">
              <Brain className="h-4 w-4 text-white" />
              <span className="text-sm font-medium text-white">Powered by AI</span>
            </div>
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
              AI That Understands Construction
            </h3>
            <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto">
              Not generic AI. Purpose-built for construction workflows.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            {[
              { icon: Shield, title: "Smart Hazard Suggestions", description: "AI suggests today's hazards based on weather conditions and scheduled tasks. Complete safety logs faster." },
              { icon: Receipt, title: "Receipt Intelligence", description: "Snap a photo of any receipt. AI extracts vendor, amount, category, and line items automatically." },
              { icon: FolderSearch, title: "Document Q&A", description: "Ask questions about your project documents in plain English. Get answers with source references." },
              { icon: MessageSquareWarning, title: "Escalation Drafts", description: "Draft professional escalation emails in seconds. AI understands construction context and urgency." }
            ].map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={index} className="p-6 bg-white rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h4 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">{item.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Trust & Compliance Section - NEW */}
      <section className="py-16 md:py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-10 md:mb-12">
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight">
              Built for Inspections. Ready for Audits.
            </h3>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              When the inspector shows up, you're ready. Every record is complete, signed, and tamper-evident.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: Shield, title: "Tamper-Evident Records", description: "Digital fingerprints on every safety form. Prove records weren't altered." },
              { icon: FileCheck, title: "Complete Audit Trail", description: "Every change logged with who, what, and when. Nothing gets lost." },
              { icon: FileStack, title: "One-Tap PDF Export", description: "Export inspection-ready documents in seconds. Professional formatting included." },
              { icon: CheckCircle, title: "Digital Signatures", description: "Worker acknowledgments captured with timestamps. No more signature sheets." }
            ].map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={index} className="p-5 bg-card rounded-lg border border-border text-center">
                  <div className="w-12 h-12 rounded-full bg-status-complete/10 flex items-center justify-center mx-auto mb-4">
                    <Icon className="h-6 w-6 text-status-complete" />
                  </div>
                  <h4 className="text-lg font-bold text-foreground mb-2">{item.title}</h4>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* The Plan */}
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

      {/* Value and CTA Combined */}
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

      {/* FAQ Section - NEW */}
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

      {/* Final CTA Section - NEW */}
      <section className="py-20 md:py-28 px-4 bg-primary">
        <div className="container mx-auto max-w-3xl text-center">
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
            Stop Chasing Updates. Start Building.
          </h3>
          <p className="text-lg md:text-xl text-white/90 mb-8 max-w-xl mx-auto">
            Join contractors who finish on time and protect their margins.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
            <Button 
              size="lg" 
              onClick={handleGetStarted} 
              className="w-full sm:w-auto h-14 md:h-16 px-8 text-base md:text-lg bg-white text-primary hover:bg-white/90 font-bold shadow-xl"
            >
              Start Your Free Trial
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              onClick={handleSeeHowItWorks} 
              className="w-full sm:w-auto h-14 md:h-16 px-8 text-base md:text-lg bg-transparent text-white border-white/50 hover:bg-white/10 font-semibold"
            >
              Book a Demo
            </Button>
          </div>
          <p className="text-sm text-white/70 mt-6">
            No credit card required • Free 14-day trial • Cancel anytime
          </p>
        </div>
      </section>

      {/* Trust Badges - NEW */}
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
