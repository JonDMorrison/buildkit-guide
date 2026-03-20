import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { CheckCircle, FileX, Ban, FolderSearch, MessageSquareWarning, FileStack, TrendingDown, Clock, MapPin, Brain, Shield, Wifi, WifiOff, ChevronDown, ChevronUp, Receipt, FileCheck, Mic, ClipboardList, AlertTriangle, Calendar, HardHat, Users, Sparkles, DollarSign, BarChart3, PieChart, LayoutDashboard, Inbox, FileBarChart, Award, HeartPulse } from "lucide-react";
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
                Know what's happening on every job before anyone calls you.
               </h1>
               <p className="text-lg sm:text-xl md:text-2xl text-gray-200 mb-4 md:mb-6 leading-relaxed">
                 Real-time updates from the field. Issues flagged early. Every task owned. ProjectPath keeps your jobs moving without the chasing.
               </p>
              <p className="text-sm font-medium text-amber-500 uppercase tracking-widest mt-2 mb-4 md:mb-6">
                Most software tracks work. This system helps you repeat it.
              </p>
              <p className="text-sm sm:text-base text-white/70 mb-6 md:mb-8">
                Free 14-day trial. No credit card required.
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

      {/* Video Section */}
      <section className="py-12 md:py-16 px-4 bg-background">
        <div className="container mx-auto max-w-4xl">
          <div className="aspect-video rounded-xl overflow-hidden shadow-2xl border border-border">
            <iframe
              src="https://player.vimeo.com/video/1159202838?h=&badge=0&autopause=0&player_id=0&app_id=58479"
              className="w-full h-full"
              frameBorder="0"
              allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media"
              allowFullScreen
              title="Project Path Demo Video"
            />
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
                 You Rebuild the Same Project From Scratch Every Time
               </h2>
               <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                 Most project software only tracks work. It doesn't remember how your company runs jobs or help you repeat what works. Every new project starts from zero.
               </p>
               <div className="space-y-3">
                 {[
                   "Every project starts with a blank slate",
                   "Good processes live in people's heads, not your system",
                   "Your team re-enters the same information every day"
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
               <p className="text-primary font-semibold mb-3 uppercase tracking-wide text-sm">Playbooks</p>
               <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-6 leading-tight">
                 Start Every Project With a Proven Workflow
               </h2>
               <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                 Instead of rebuilding tasks and phases every time, start with a playbook your team already knows. Your foreman can adjust anything, but the structure is already there.
               </p>
              <div className="space-y-4">
                {[
                   { icon: ClipboardList, text: "Repeatable task templates by trade" },
                   { icon: AlertTriangle, text: "Pre-built phases, milestones, and checklists" },
                   { icon: Calendar, text: "Adjust anything — the structure does the heavy lifting" }
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
               <p className="text-primary font-semibold mb-3 uppercase tracking-wide text-sm">Smart Memory</p>
               <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-6 leading-tight">
                 The System Learns How Your Company Works
               </h2>
               <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                 Every time your team assigns a worker, logs a safety form, or completes a task, the system remembers. Next time, it suggests the right crew, pre-fills forms, and flags what's missing.
               </p>
              <div className="space-y-4">
                {[
                   { icon: HardHat, text: "Suggests crew members you've used before" },
                   { icon: FileCheck, text: "Pre-fills forms from past entries" },
                   { icon: Shield, text: "Flags risks based on real project history" }
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
               <p className="text-primary font-semibold mb-3 uppercase tracking-wide text-sm">Fast Field Tools</p>
               <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-6 leading-tight">
                 Daily Work Gets Done With Fewer Clicks
               </h2>
               <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                 Time entries, safety logs, manpower requests, and daily reports — all designed for the field. One tap to check in. Voice input for notes. Forms that pre-fill so your crew spends less time typing.
               </p>
              <div className="space-y-4">
                {[
                   { icon: Clock, text: "One-tap time tracking with GPS" },
                   { icon: MapPin, text: "Voice-to-text for notes and observations" },
                   { icon: FileCheck, text: "Forms and logs pre-fill automatically" }
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

      {/* Financial Intelligence - Text Left, Image Right */}
      <section className="py-16 md:py-24 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-10 md:gap-16 items-center">
            <div>
              <p className="text-primary font-semibold mb-3 uppercase tracking-wide text-sm">Financial Intelligence</p>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-6 leading-tight">
                Know Where Your Money Is Going — Before It's Gone
              </h2>
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                Budget builder, estimate-vs-actual tracking, and profit risk alerts that catch cost overruns early.
              </p>
              <div className="space-y-4">
                {[
                  { icon: DollarSign, text: "Budget builder with line-item estimates" },
                  { icon: BarChart3, text: "Variance tracking: budget, labor, and materials" },
                  { icon: PieChart, text: "Profit risk scoring per project" },
                  { icon: Receipt, text: "Receipt capture with AI categorization" }
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
                src={screenshotAi} 
                alt="Financial intelligence dashboard" 
                className="w-full rounded-xl shadow-2xl border border-border"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Executive Portfolio View - Text Right, Image Left */}
      <section className="py-16 md:py-24 px-4 bg-background">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-10 md:gap-16 items-center">
            <div className="order-2 lg:order-1">
              <img 
                src={screenshotLookahead} 
                alt="Executive portfolio dashboard" 
                className="w-full rounded-xl shadow-2xl border border-border"
                loading="lazy"
              />
            </div>
            <div className="order-1 lg:order-2">
              <p className="text-primary font-semibold mb-3 uppercase tracking-wide text-sm">Executive Portfolio View</p>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-6 leading-tight">
                Every Project. One Dashboard. Zero Surprises.
              </h2>
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                Cross-project KPIs, attention inbox, and change feed so leadership sees what matters without chasing PMs.
              </p>
              <div className="space-y-4">
                {[
                  { icon: LayoutDashboard, text: "Portfolio-level margin and cost rollups" },
                  { icon: Inbox, text: "Attention inbox surfaces what needs action now" },
                  { icon: FileBarChart, text: "Weekly AI-generated insight reports" },
                  { icon: Award, text: "Certification scoring tracks operational maturity" }
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
                Ask questions about your project documents in plain English. Get weekly insight reports, hazard suggestions, and escalation emails — all powered by AI that knows your projects.
              </p>
              <div className="space-y-4">
                {[
                  { icon: AlertTriangle, text: "Electrical inspection is scheduled before drywall — flag this before it causes a delay." },
                  { icon: Shield, text: "Weather forecast shows rain Thursday. Concrete pour is scheduled Wednesday — risk alert." },
                  { icon: BarChart3, text: "Labor burn rate is 18% over budget on framing. Recommend reviewing crew allocation." }
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
               Built for the Job Site, Not a Desktop
             </h3>
             <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
               Designed for work gloves, bright sunlight, and spotty cell signal.
             </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {[
              { icon: WifiOff, title: "Works Offline", description: "Sync when you reconnect" },
              { icon: CheckCircle, title: "Big Tap Targets", description: "One-hand operation" },
              { icon: Shield, title: "High Contrast", description: "Readable in sunlight" },
              { icon: Mic, title: "Voice Input", description: "Dictate notes hands-free" },
              { icon: HeartPulse, title: "Self-Diagnosing", description: "Built-in health checks catch data gaps before they become problems" }
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
             Start Running Projects Consistently
           </h3>
          <div className="grid sm:grid-cols-3 gap-6 md:gap-8">
            {[{
              step: "1",
               title: "Sign Up",
               description: "Create your account in 2 minutes. No credit card required."
              }, {
                step: "2",
                title: "Start With a Proven Playbook",
                description: "Choose a workflow or generate one from past projects."
              }, {
                step: "3",
                title: "Your Next Project Gets Faster",
                description: "Trades, workers, and locations auto-suggest based on real history."
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
             Most Software Tracks Work. This System Helps You Repeat It.
           </h3>
           <p className="text-base md:text-lg text-muted-foreground mb-8 md:mb-10 leading-relaxed max-w-2xl mx-auto">
             Turn your best projects into playbooks. Use real data to make every project faster, more consistent, and more profitable.
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
             What Changes When Your System Learns
           </h3>
           <div className="grid sm:grid-cols-2 gap-3 md:gap-4 mb-6 md:mb-8">
             {["New projects start with structure, not from scratch", "Crew suggestions based on real history", "Forms and logs pre-fill automatically", "Consistent results across every PM", "Faster onboarding for new hires", "Every job makes the next one easier"].map((item, index) => (
              <div key={index} className="flex items-start gap-3 p-4 md:p-5 bg-card/90 backdrop-blur-md rounded-lg shadow-sm">
                <CheckCircle className="h-6 w-6 md:h-7 md:w-7 text-primary flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                <p className="text-base md:text-lg text-foreground font-semibold">{item}</p>
              </div>
            ))}
          </div>
           <p className="text-base md:text-lg text-muted-foreground text-center max-w-2xl mx-auto leading-relaxed font-medium">
             Your best project shouldn't be a one-time thing. Make it the standard.
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
             Stop Rebuilding. Start Repeating What Works.
           </h3>
           <p className="text-lg md:text-xl text-primary-foreground/90 mb-8 max-w-xl mx-auto">
             Join contractors who've stopped rebuilding from scratch and started running every project from a proven playbook.
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
      <section className="py-8 px-4 bg-[#0f2a4a] border-t border-white/10">
        <div className="container mx-auto max-w-4xl">
          <div className="flex flex-wrap justify-center items-center gap-6 md:gap-12 text-sm text-white/70">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-white/70" />
              <span>Your data stays yours</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-white/70" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-white/70" />
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-[#0f2a4a] border-t border-white/10">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <img src={projectPathLogo} alt="Project Path" className="h-16 w-auto max-w-[240px]" />
              <p className="text-sm text-white/70">
                © 2026 Project Path. Built for the field.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/features')} className="text-white/80 hover:text-white hover:bg-white/10">
                Features
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/safety-security')} className="text-white/80 hover:text-white hover:bg-white/10">
                Safety & Security
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/responsible-ai')} className="text-white/80 hover:text-white hover:bg-white/10">
                Responsible AI
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/auth')} className="text-white/80 hover:text-white hover:bg-white/10">
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
