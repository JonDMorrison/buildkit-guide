import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { 
  Home, CheckSquare, Clock, Calendar, Users, AlertCircle, Shield, Receipt, 
  FileText, Brain, ChevronRight, Mic, Camera, Bell, Search, 
  TrendingUp, Zap, MapPin, Fingerprint, ClipboardCheck
} from "lucide-react";
import featuresHero from "@/assets/features-hero.jpg";
import buildSenseLogo from "@/assets/build-sense-logo.png";
import { PublicNav } from "@/components/PublicNav";

interface FeatureCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  tagline: string;
  benefits: string[];
  highlight?: boolean;
}

const FeatureCard = ({ icon: Icon, title, tagline, benefits, highlight }: FeatureCardProps) => (
  <div className={`p-6 rounded-xl border ${highlight ? 'border-[#FF6B35]/50 bg-[#FF6B35]/5' : 'border-border bg-card'} hover:shadow-lg transition-all`}>
    <div className={`p-3 rounded-lg w-fit mb-4 ${highlight ? 'bg-[#FF6B35]/10' : 'bg-muted'}`}>
      <Icon className={`h-6 w-6 ${highlight ? 'text-[#FF6B35]' : 'text-foreground'}`} />
    </div>
    <h3 className="text-xl font-bold text-foreground mb-2">{title}</h3>
    <p className="text-muted-foreground mb-4">{tagline}</p>
    <ul className="space-y-2">
      {benefits.map((benefit, index) => (
        <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
          <ChevronRight className="h-4 w-4 text-[#FF6B35] flex-shrink-0 mt-0.5" />
          <span>{benefit}</span>
        </li>
      ))}
    </ul>
  </div>
);

export default function Features() {
  const navigate = useNavigate();

  const coreFeatures: FeatureCardProps[] = [
    {
      icon: Home,
      title: "Dashboard",
      tagline: "Your job site at a glance. Start every day informed.",
      benefits: [
        "See today's weather, crew count, and active blockers",
        "Quick access to everything that needs your attention",
        "Customizable widgets for your workflow",
        "Real-time updates as your team logs activity"
      ]
    },
    {
      icon: CheckSquare,
      title: "Task Management",
      tagline: "Know exactly what every trade owes — and when.",
      highlight: true,
      benefits: [
        "Assign tasks to trades with clear due dates",
        "Track progress with visual status updates",
        "Flag blockers instantly so nothing slips through",
        "Filter by trade, status, or priority in seconds",
        "Request work review when tasks are complete"
      ]
    },
    {
      icon: Clock,
      title: "Time Tracking",
      tagline: "Accurate hours. No guesswork. No paperwork.",
      benefits: [
        "One-tap check-in and check-out from the field",
        "GPS verification for job site presence",
        "Automatic break tracking and overtime alerts",
        "Request time adjustments with documented reasons",
        "Export payroll-ready timesheets in seconds"
      ]
    },
    {
      icon: Calendar,
      title: "2-Week Lookahead",
      tagline: "See what's coming before it catches you off guard.",
      highlight: true,
      benefits: [
        "Visual timeline of the next two weeks",
        "Spot conflicts before they delay the job",
        "Coordinate trades with drag-and-drop scheduling",
        "AI-powered delay forecasting warns you early",
        "Generate coordination summaries for meetings"
      ]
    },
    {
      icon: Users,
      title: "Manpower Planning",
      tagline: "Request crews. Prevent shortages. Stay ahead.",
      benefits: [
        "Submit manpower requests with trade and date",
        "Track approval status in real-time",
        "See crew distribution across projects",
        "Plan for upcoming labor needs before they hit",
        "Document reasons for every request"
      ]
    },
    {
      icon: AlertCircle,
      title: "Deficiency Tracking",
      tagline: "Catch issues early. Close them fast. Stay compliant.",
      highlight: true,
      benefits: [
        "Log deficiencies with photos and location",
        "Assign to responsible trades automatically",
        "Track status from open to verified-closed",
        "Import GC deficiency lists directly",
        "Never lose track of punch list items again"
      ]
    },
    {
      icon: Shield,
      title: "Safety Documentation",
      tagline: "Daily logs, toolbox talks, and incidents — done right.",
      benefits: [
        "Complete daily safety logs in under 5 minutes",
        "AI suggests hazards based on weather and tasks",
        "Capture worker acknowledgments with signatures",
        "Document near misses before they become incidents",
        "Export inspection-ready PDFs with one tap"
      ]
    },
    {
      icon: Receipt,
      title: "Receipt Capture",
      tagline: "Snap it. Submit it. Track it. Done.",
      benefits: [
        "Photograph receipts instantly from the field",
        "AI extracts vendor, amount, and category",
        "Link receipts to tasks or cost codes",
        "PM review and approval workflow built in",
        "Export for accounting with full audit trail"
      ]
    }
  ];

  const additionalFeatures = [
    {
      icon: Brain,
      title: "AI Assistant",
      description: "Ask questions about your project, get hazard suggestions, and draft emails — all powered by AI that understands construction."
    },
    {
      icon: FileText,
      title: "Document Management",
      description: "Upload, organize, and search project documents. Find what you need instantly with full-text search."
    },
    {
      icon: Mic,
      title: "Voice Input",
      description: "Speak your safety observations, task notes, or blockers. AI converts your voice to structured entries."
    },
    {
      icon: Camera,
      title: "Photo Documentation",
      description: "Attach photos to tasks, deficiencies, and safety forms. Visual proof that travels with the record."
    },
    {
      icon: Bell,
      title: "Smart Notifications",
      description: "Get alerted about blockers, assignments, and approvals. Never miss what matters to you."
    },
    {
      icon: Search,
      title: "Global Search",
      description: "Find any task, deficiency, or document across your projects. One search box, all your data."
    },
    {
      icon: TrendingUp,
      title: "Daily Logs",
      description: "Document what happened each day — weather, crew count, work performed, and issues encountered."
    },
    {
      icon: Zap,
      title: "Blocker Reporting",
      description: "Flag what's in the way instantly. Notify the right people. Get work unblocked faster."
    },
    {
      icon: MapPin,
      title: "Job Site Geofencing",
      description: "Automatic location verification for time entries. Know who's on site without asking."
    },
    {
      icon: Fingerprint,
      title: "Tamper-Evident Records",
      description: "Every safety record has a digital fingerprint. Changes are tracked and auditable."
    },
    {
      icon: ClipboardCheck,
      title: "Worker Acknowledgments",
      description: "Capture signatures confirming workers understood the day's hazards and controls."
    },
    {
      icon: Users,
      title: "Role-Based Access",
      description: "Workers, foremen, PMs, and admins each see what they need. Nothing more, nothing less."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <PublicNav />

      {/* Hero Section */}
      <section 
        className="pt-28 md:pt-32 pb-16 md:pb-20 px-4 relative overflow-hidden min-h-[50vh] flex items-center"
        style={{
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.65), rgba(0, 0, 0, 0.8)), url(${featuresHero})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            Everything You Need to Keep Jobs Moving
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl text-gray-200 leading-relaxed max-w-3xl mx-auto">
            Built for the field. Designed for real work. Every feature helps you finish on time and protect your margins.
          </p>
        </div>
      </section>

      {/* Core Features Grid */}
      <section className="py-16 md:py-20 px-4 bg-background">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4">
              Core Features
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              The tools your team uses every day to stay coordinated, accountable, and compliant.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {coreFeatures.map((feature, index) => (
              <FeatureCard key={index} {...feature} />
            ))}
          </div>
        </div>
      </section>

      {/* Additional Features */}
      <section className="py-16 md:py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4">
              Built-In Capabilities
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Every feature works together. No integrations required. No extra tools to manage.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {additionalFeatures.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={index} className="p-5 bg-background rounded-lg border border-border hover:border-[#FF6B35]/30 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-muted rounded-lg flex-shrink-0">
                      <Icon className="h-5 w-5 text-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Field-First Design Section */}
      <section className="py-16 md:py-20 px-4 bg-background">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4">
              Designed for the Job Site
            </h2>
            <p className="text-lg text-muted-foreground">
              Every screen is built for gloves, bright sun, and fast decisions.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: "Works Offline", description: "Queue entries when connectivity drops. Syncs automatically when you're back." },
              { title: "Big Tap Targets", description: "Buttons sized for work gloves. No precision required." },
              { title: "Readable in Sunlight", description: "High contrast interface that works outdoors." },
              { title: "Fast Load Times", description: "Opens instantly. No waiting around while the job waits." }
            ].map((item, index) => (
              <div key={index} className="p-5 bg-muted/50 rounded-lg border border-border text-center">
                <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-20 px-4 bg-[#1C3B23]">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Keep Your Jobs Moving?
          </h2>
          <p className="text-lg text-white/80 mb-8 leading-relaxed">
            Join contractors who finish on time and protect their margins.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={() => navigate('/auth')} 
              className="h-14 px-8 text-lg bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white font-semibold"
            >
              Get Started
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              onClick={() => navigate('/how-it-works')} 
              className="h-14 px-8 text-lg bg-white/10 text-white border-white/30 hover:bg-white/20 font-semibold"
            >
              See How It Works
            </Button>
          </div>
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
