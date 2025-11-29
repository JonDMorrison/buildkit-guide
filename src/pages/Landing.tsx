import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { CheckCircle } from "lucide-react";
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
    document.getElementById('plan')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-background/95 backdrop-blur-sm border-b border-border z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">FieldSync</h1>
          <div className="flex gap-3">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/auth')}
              className="hidden sm:inline-flex"
            >
              Sign In
            </Button>
            <Button 
              onClick={handleBookDemo}
              className="bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white"
            >
              Book a Demo
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section 
        className="pt-32 pb-20 px-4 relative overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.8)), url(${heroBackground})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
                Your Job Site Is Bleeding Time. This Stops It.
              </h2>
              <p className="text-xl md:text-2xl text-gray-200 mb-8">
                A simple field-ready coordination app that keeps every trade accountable and your schedule on track.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button 
                  size="lg" 
                  onClick={handleBookDemo}
                  className="h-14 px-8 text-lg bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white"
                >
                  Book a Demo
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  onClick={handleSeeHowItWorks}
                  className="h-14 px-8 text-lg bg-white/10 text-white border-white/30 hover:bg-white/20"
                >
                  See How It Works
                </Button>
              </div>
            </div>
            <div className="flex justify-center">
              <img 
                src={heroMockup} 
                alt="FieldSync App Dashboard" 
                className="w-full max-w-lg rounded-lg shadow-2xl"
                loading="eager"
              />
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
            {["Horizon Construction", "BuildRight Co", "Prime Builders", "SteelFrame Inc"].map((company, idx) => (
              <div key={idx} className="text-lg font-bold text-foreground">
                {company}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The Problem */}
      <section className="py-20 px-4 bg-muted/30 relative">
        <div className="absolute inset-0 opacity-20">
          <img 
            src={problemChaos} 
            alt="Construction site chaos" 
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
        <div className="container mx-auto max-w-4xl relative z-10">
          <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-8 text-center">
            Projects Fall Behind When Trades Do Not Stay Aligned
          </h3>
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            {[
              "Gantt charts get buried and forgotten",
              "Blocked tasks go unreported",
              "Safety forms live in too many places",
              "PMs chase updates all day",
              "Foremen drown in admin",
              "Little delays turn into big problems"
            ].map((item, index) => (
              <div key={index} className="flex items-start gap-3 p-4 bg-card/95 backdrop-blur-sm rounded-lg border border-border">
                <div className="h-2 w-2 rounded-full bg-destructive mt-2 flex-shrink-0" />
                <p className="text-lg text-foreground">{item}</p>
              </div>
            ))}
          </div>
          <p className="text-lg text-muted-foreground text-center max-w-2xl mx-auto">
            When communication breaks down you lose time and money. It is frustrating to know the job could move faster if people stayed on top of what they owe.
          </p>
        </div>
      </section>

      {/* The Guide */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
            You Do Not Need More Meetings. You Need Control.
          </h3>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Most construction software is bloated, confusing, and built for office people. This app is built for real crews who work under pressure and need quick answers, not another complicated program.
          </p>
        </div>
      </section>

      {/* The Solution */}
      <section id="solution" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-5xl">
          <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-12 text-center">
            A Coordination Platform That Keeps Your Site Moving
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                title: "Clear Task Accountability",
                description: "Every trade sees what they owe and what depends on them.",
                icon: iconTasks
              },
              {
                title: "Instant Blocker Reporting",
                description: "Know immediately when a task is blocked and why.",
                icon: iconBlocker
              },
              {
                title: "Fast 2-Week Lookahead",
                description: "A simple visual plan of the next two weeks.",
                icon: iconLookahead
              },
              {
                title: "Safety Done Right",
                description: "Daily logs, hazard IDs, toolbox talks, and incident reports in one place.",
                icon: iconSafety
              },
              {
                title: "Manpower Planning",
                description: "Request crews, approve requests, and prevent shortages.",
                icon: iconManpower
              },
              {
                title: "AI Support",
                description: "AI reads documents, answers questions, generates daily logs, and identifies risks.",
                icon: iconAI
              }
            ].map((feature, index) => (
              <div key={index} className="p-6 bg-card rounded-lg border border-border hover:border-[#FF6B35]/50 transition-colors">
                <img 
                  src={feature.icon} 
                  alt={feature.title} 
                  className="w-16 h-16 mb-4 rounded-lg"
                  loading="lazy"
                />
                <h4 className="text-xl font-bold text-foreground mb-3">{feature.title}</h4>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The Plan */}
      <section id="plan" className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-12 text-center">
            A Simple Plan That Gets Your Jobs Under Control
          </h3>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "1", title: "Book a Demo" },
              { step: "2", title: "Set Up Your Projects" },
              { step: "3", title: "Keep Your Jobs Moving" }
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 rounded-full bg-[#FF6B35] text-white text-2xl font-bold flex items-center justify-center mx-auto mb-4">
                  {item.step}
                </div>
                <h4 className="text-xl font-bold text-foreground">{item.title}</h4>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Value and Stakes */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-3xl text-center">
          <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
            Every Day of Delay Costs Money
          </h3>
          <p className="text-xl text-muted-foreground leading-relaxed">
            This app helps eliminate downtime, prevent schedule slippage, reduce rework, and keep the GC happy. You protect your margins when you keep the job moving.
          </p>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-8">
            Stop The Bleed And Take Control Of Your Job Site
          </h3>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={handleBookDemo}
              className="h-14 px-8 text-lg bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white"
            >
              Book a Demo
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              onClick={handleSeePricing}
              className="h-14 px-8 text-lg"
            >
              See Pricing
            </Button>
          </div>
        </div>
      </section>

      {/* Risk Reversal */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-3xl text-center">
          <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
            Built For The Field. Not For Silicon Valley.
          </h3>
          <p className="text-xl text-muted-foreground leading-relaxed">
            No training marathons. No cluttered menus. No unnecessary features. Just a straightforward tool your team will actually use.
          </p>
        </div>
      </section>

      {/* Success Vision */}
      <section className="py-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src={successOrganized} 
            alt="Organized construction site" 
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/90 to-background/80" />
        </div>
        <div className="container mx-auto max-w-4xl relative z-10">
          <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-10 text-center">
            Picture A Job Site With Zero Guesswork
          </h3>
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            {[
              "Trades show up ready",
              "Blockers get handled quickly",
              "Safety stays organized",
              "Meetings get shorter",
              "Everyone knows what is needed next",
              "Projects finish on time"
            ].map((item, index) => (
              <div key={index} className="flex items-start gap-3 p-4 bg-card/80 backdrop-blur-sm rounded-lg">
                <CheckCircle className="h-6 w-6 text-[#FF6B35] flex-shrink-0 mt-1" />
                <p className="text-lg text-foreground font-medium">{item}</p>
              </div>
            ))}
          </div>
          <p className="text-xl text-muted-foreground text-center max-w-2xl mx-auto leading-relaxed">
            This is how you build a job you can be proud of and a GC who wants to work with you again.
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
            <Button 
              variant="ghost" 
              onClick={() => navigate('/auth')}
            >
              Sign In
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}