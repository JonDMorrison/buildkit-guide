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

export default function HowItWorks() {
  const navigate = useNavigate();

  const handleBookDemo = () => {
    window.location.href = "mailto:demo@fieldsync.app?subject=Demo Request";
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
      color: "text-[#FF6B35]",
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
      color: "text-[#FF6B35]",
      screenshot: screenshotAI
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-background/95 backdrop-blur-sm border-b border-border z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <h1 
            className="text-xl font-bold text-foreground cursor-pointer hover:text-[#FF6B35] transition-colors"
            onClick={() => navigate('/')}
          >
            FieldSync
          </h1>
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

      {/* Page Header */}
      <section className="pt-32 pb-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6 leading-tight">
            How The App Keeps Your Job Site Moving
          </h2>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            A simple system that keeps tasks clear, blockers visible, and every trade accountable.
          </p>
          <Button 
            size="lg" 
            onClick={handleBookDemo}
            className="h-14 px-8 text-lg bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white"
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
            className={`py-20 px-4 ${isEven ? 'bg-background' : 'bg-muted/30'}`}
          >
            <div className="container mx-auto max-w-5xl">
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                {/* Content */}
                <div className={isEven ? 'lg:order-1' : 'lg:order-2'}>
                  <Icon className={`h-16 w-16 ${feature.color} mb-6`} strokeWidth={1.5} />
                  <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                    {feature.title}
                  </h3>
                  <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                    {feature.description}
                  </p>
                  <ul className="space-y-3">
                    {feature.bullets.map((bullet, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <ArrowRight className={`h-6 w-6 ${feature.color} flex-shrink-0 mt-0.5`} />
                        <span className="text-foreground text-lg">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Visual Placeholder */}
                <div className={`${isEven ? 'lg:order-2' : 'lg:order-1'} flex justify-center`}>
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
      <section className="py-24 px-4 bg-muted/50">
        <div className="container mx-auto max-w-4xl text-center">
          <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-8">
            Ready To Keep Your Projects On Track
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

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-border">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © 2024 FieldSync. Built for the field.
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
