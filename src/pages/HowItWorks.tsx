import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { 
  CheckSquare, 
  AlertTriangle, 
  Calendar, 
  Shield, 
  Users, 
  Sparkles,
  ArrowRight
} from "lucide-react";
import screenshotTasks from "@/assets/screenshot-tasks.png";
import screenshotBlockers from "@/assets/screenshot-blockers.png";
import screenshotLookahead from "@/assets/screenshot-lookahead.png";
import screenshotSafety from "@/assets/screenshot-safety.png";
import screenshotManpower from "@/assets/screenshot-manpower.png";
import screenshotAI from "@/assets/screenshot-ai.png";
import { PublicNav } from "@/components/PublicNav";

export default function HowItWorks() {
  const navigate = useNavigate();

  const handleBookDemo = () => {
    window.location.href = "mailto:demo@projectpath.app?subject=Demo Request";
  };

  const handleSeePricing = () => {
    navigate('/');
    setTimeout(() => {
      document.getElementById('plan')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const features = [
    {
      icon: CheckSquare,
      title: "Tasks That Actually Drive the Job Forward",
      description: "Create tasks, assign them to trades, and set dates that everyone understands. Every task is clear, simple, and easy to update in the field.",
      bullets: [
        "Assign work to the right trade",
        "Set start and end dates",
        "Track progress at a glance",
        "Keep everyone aligned on what needs to happen next"
      ],
      color: "text-accent",
      screenshot: screenshotTasks
    },
    {
      icon: AlertTriangle,
      title: "Instant Blocker Reporting",
      description: "When a task is blocked, you see it right away. No waiting until the next meeting. No surprises. Just fast information so you can keep the project moving.",
      bullets: [
        "Mark a task as blocked in seconds",
        "Add reason and photos",
        "Notify PMs instantly",
        "Keep the schedule protected"
      ],
      color: "text-red-500",
      screenshot: screenshotBlockers
    },
    {
      icon: Calendar,
      title: "A Lookahead Your Crew Will Actually Use",
      description: "A simple two week timeline shows what is coming up, what is at risk, and what needs attention today. No spreadsheets and no clutter.",
      bullets: [
        "See the next two weeks in a clean timeline",
        "Spot conflicts early",
        "Watch critical tasks more closely",
        "Keep trades focused on what matters"
      ],
      color: "text-blue-500",
      screenshot: screenshotLookahead
    },
    {
      icon: Shield,
      title: "Safety Without the Paper Pile",
      description: "Daily logs, hazard IDs, toolbox talks, and incident reports all live in one place. Crews submit forms fast and everything is stored automatically.",
      bullets: [
        "Standardized forms",
        "Photo and signature support",
        "Simple submission workflow",
        "Organized and audit ready"
      ],
      color: "text-green-500",
      screenshot: screenshotSafety
    },
    {
      icon: Users,
      title: "Manpower Planning That Prevents Bottlenecks",
      description: "Plan your crews, approve requests, and see staffing needs before they become delays. You stay ahead of shortages and avoid last minute scrambles.",
      bullets: [
        "Foremen request manpower",
        "PMs approve with one tap",
        "See crew needs on a calendar",
        "Prevent schedule slip"
      ],
      color: "text-purple-500",
      screenshot: screenshotManpower
    },
    {
      icon: Sparkles,
      title: "AI That Works Behind the Scenes",
      description: "AI handles the work that slows you down. It reads your documents, summarizes your logs, highlights risks, and answers project questions without pulling you from the field.",
      bullets: [
        "Summarize daily logs",
        "Read PDFs and drawings",
        "Identify blockers and risks",
        "Answer questions instantly"
      ],
      color: "text-accent",
      screenshot: screenshotAI
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <PublicNav />

      {/* Page Header */}
      <section className="pt-28 md:pt-32 pb-12 md:pb-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4 md:mb-6 leading-tight">
            How The App Keeps Your Job Site Moving
          </h2>
          <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground mb-6 md:mb-8 max-w-2xl mx-auto leading-relaxed">
            A simple system that keeps tasks clear, blockers visible, and every trade accountable.
          </p>
          <Button 
            size="lg" 
            onClick={handleBookDemo}
            className="w-full sm:w-auto h-14 md:h-16 px-8 md:px-10 text-base md:text-lg bg-accent hover:bg-accent/90 text-white font-semibold"
          >
            Book a Demo
          </Button>
        </div>
      </section>

      {/* Feature Sections */}
      {features.map((feature, index) => {
        const Icon = feature.icon;
        const isEven = index % 2 === 0;
        
        return (
          <section 
            key={index} 
            className={`py-12 md:py-20 px-4 ${isEven ? 'bg-background' : 'bg-muted/30'}`}
          >
            <div className="container mx-auto max-w-5xl">
              <div className="grid lg:grid-cols-2 gap-8 md:gap-12 items-center">
                {/* Content */}
                <div className="order-1">
                  <Icon className={`h-12 w-12 md:h-16 md:w-16 ${feature.color} mb-4 md:mb-6`} strokeWidth={1.5} />
                  <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4 md:mb-6 leading-tight">
                    {feature.title}
                  </h3>
                  <p className="text-base md:text-lg text-muted-foreground mb-4 md:mb-6 leading-relaxed">
                    {feature.description}
                  </p>
                  <ul className="space-y-2 md:space-y-3">
                    {feature.bullets.map((bullet, idx) => (
                      <li key={idx} className="flex items-start gap-2 md:gap-3">
                        <ArrowRight className={`h-5 w-5 md:h-6 md:w-6 ${feature.color} flex-shrink-0 mt-0.5`} />
                        <span className="text-foreground text-base md:text-lg">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Visual Placeholder */}
                <div className="order-2 flex justify-center">
                  <div className="w-full max-w-md">
                    <img 
                      src={feature.screenshot} 
                      alt={`${feature.title} screenshot`}
                      className="w-full h-auto rounded-lg shadow-2xl border border-border"
                      loading="lazy"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      })}

      {/* Final CTA */}
      <section className="py-16 md:py-24 px-4 bg-muted/50">
        <div className="container mx-auto max-w-4xl text-center">
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-6 md:mb-8 leading-tight">
            Ready To Keep Your Projects On Track
          </h3>
          <div className="flex flex-col gap-3 justify-center w-full max-w-md mx-auto">
            <Button 
              size="lg" 
              onClick={handleBookDemo}
              className="w-full h-14 md:h-16 text-base md:text-lg bg-accent hover:bg-accent/90 text-white font-semibold"
            >
              Book a Demo
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              onClick={handleSeePricing}
              className="w-full h-14 md:h-16 text-base md:text-lg font-semibold"
            >
              See Pricing
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-border">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © 2026 Project Path. Built for the field.
            </p>
            <div className="flex gap-4">
              <Button 
                variant="ghost" 
                onClick={() => navigate('/')}
              >
                Home
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => navigate('/auth')}
              >
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
