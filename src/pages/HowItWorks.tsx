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
       title: "Start With a Proven Playbook",
       description: "Create projects instantly from a workflow. No rebuilding scopes every job. Phases, trades, and milestones are ready — your foreman adjusts what's needed.",
       bullets: [
         "Repeatable templates by project type",
         "Pre-built phases and trade assignments",
         "Adjust anything — the structure does the heavy lifting",
         "New hires follow the same system on day one"
       ],
      color: "text-accent",
      screenshot: screenshotTasks
    },
    {
      icon: AlertTriangle,
       title: "Tasks Appear Automatically",
       description: "When something is in the way, your team flags it in seconds. PMs see it immediately — not at the next meeting. Problems get solved before they cost money.",
       bullets: [
         "One-tap blocker reporting from the field",
         "Attach photos and reasons",
         "PMs get notified instantly",
         "The schedule stays protected"
       ],
      color: "text-red-500",
      screenshot: screenshotBlockers
    },
    {
      icon: Calendar,
       title: "Daily Work Moves Faster",
       description: "Tasks, deficiencies, and manpower requests reuse known information. A clean two-week timeline shows what's on track and what needs attention today.",
       bullets: [
         "Visual timeline of the next two weeks",
         "Spot trade conflicts early",
         "Flag critical-path tasks automatically",
         "Keep coordination meetings short and focused"
       ],
      color: "text-blue-500",
      screenshot: screenshotLookahead
    },
    {
      icon: Shield,
       title: "Safety Forms That Pre-Fill Themselves",
       description: "The system remembers past entries and suggests today's hazards based on weather and tasks. Your crew completes a safety log in under 3 minutes.",
       bullets: [
         "Forms pre-fill from past submissions",
         "Photo and digital signature support",
         "Hazard suggestions based on real conditions",
         "Audit-ready from the moment it's submitted"
       ],
      color: "text-green-500",
      screenshot: screenshotSafety
    },
    {
      icon: Users,
       title: "Crew Suggestions Based on Real History",
       description: "The system suggests workers you've used before on similar tasks. Foremen request crew, PMs approve with one tap, and staffing gaps show up before they cause delays.",
       bullets: [
         "Suggested crew members from past projects",
         "One-tap approval for PMs",
         "Staffing calendar shows gaps early",
         "Fewer last-minute scrambles"
       ],
      color: "text-purple-500",
      screenshot: screenshotManpower
    },
    {
      icon: Sparkles,
       title: "Finish Strong",
       description: "Your best project becomes the template for the next one. Every task, assignment, and form your team completes makes the system more useful — so you spend less time on admin.",
       bullets: [
         "Summarizes daily logs and safety reports",
         "Suggests crew, trades, and hazards from history",
         "Flags risks based on real project patterns",
         "Answers project questions in plain English"
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
             Playbooks, Smart Memory, and Faster Fieldwork
           </h2>
           <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground mb-6 md:mb-8 max-w-2xl mx-auto leading-relaxed">
             See how each layer works together so your team runs every project consistently.
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
             Your Best Project Shouldn't Be a One-Time Thing
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
