import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle,
  Phone,
  Clock,
  Car,
  Users,
  AlertTriangle,
  Smartphone,
  LayoutDashboard,
  MessageSquare,
  Shield,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { PublicNav } from "@/components/PublicNav";
import projectPathLogo from "@/assets/project-path-logo.png";
import heroBackground from "@/assets/hero-construction-bg.jpg";

export default function GetStarted() {
  const navigate = useNavigate();
  const calendlySectionRef = useRef<HTMLElement>(null);
  const demoSectionRef = useRef<HTMLElement>(null);

  // SEO meta tags
  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Project Path — See Every Jobsite Without Calling Anyone";

    const setMeta = (name: string, content: string, property?: boolean) => {
      const attr = property ? "property" : "name";
      let el = document.querySelector(`meta[${attr}="${name}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
      return el;
    };

    const setLink = (rel: string, href: string) => {
      let el = document.querySelector(`link[rel="${rel}"]`);
      if (!el) {
        el = document.createElement("link");
        el.setAttribute("rel", rel);
        document.head.appendChild(el);
      }
      el.setAttribute("href", href);
      return el;
    };

    const description =
      "Project Path gives construction owners real-time visibility across every job site. No more chasing updates. Book a free setup call today.";

    const descEl = setMeta("description", description);
    const ogTitleEl = setMeta("og:title", "Project Path — See Every Jobsite Without Calling Anyone", true);
    const ogDescEl = setMeta("og:description", description, true);
    const ogUrlEl = setMeta("og:url", "https://projectpath.app/get-started", true);
    const canonicalEl = setLink("canonical", "https://projectpath.app/get-started");

    return () => {
      document.title = prevTitle;
      [descEl, ogTitleEl, ogDescEl, ogUrlEl].forEach((el) => el?.remove());
      canonicalEl?.remove();
    };
  }, []);

  // Calendly script
  useEffect(() => {
    const CALENDLY_SRC = "https://assets.calendly.com/assets/external/widget.js";
    if (!document.querySelector(`script[src="${CALENDLY_SRC}"]`)) {
      const script = document.createElement("script");
      script.src = CALENDLY_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  const scrollToCalendly = () => {
    calendlySectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToDemo = () => {
    demoSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const painPoints = [
    { text: '"Where are we at on that job?"' },
    { text: "Calling or texting just to get a basic update" },
    { text: "Not knowing about problems until it's too late" },
    { text: "Driving to site just to check progress" },
    { text: "Getting different answers from different people" },
    { text: "Finding out at 4pm what went wrong at 10am" },
  ];

  const steps = [
    {
      number: "1",
      icon: Smartphone,
      title: "Foreman logs today's work",
      description: "Takes 30–60 seconds. Photos, notes, progress. Done.",
    },
    {
      number: "2",
      icon: LayoutDashboard,
      title: "Everything is instantly organized",
      description: "No texts to chase. No info lost. No back-and-forth.",
    },
    {
      number: "3",
      icon: CheckCircle,
      title: "You see every job in real time",
      description: "From your phone. Across every active site.",
    },
  ];

  const outcomes = [
    "You stop chasing updates",
    "You don't drive to site just to check progress",
    "You catch problems before they cost money",
    "Your crew communicates without extra meetings",
    "You feel in control of your jobs again",
  ];

  const quotes = [
    "I didn't call anyone today.",
    "I already knew what got done before lunch.",
    "Took my guy less than a minute.",
  ];

  const objections = [
    {
      concern: "My guys won't use it",
      response: "It takes less than a minute. If they can text, they can use this.",
    },
    {
      concern: "We already use WhatsApp/text",
      response:
        "This replaces scattered messages with one clean organized update per job.",
    },
    {
      concern: "I don't want another system",
      response:
        "This replaces calls and texts. It doesn't add work — it removes it.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <PublicNav />

      {/* SECTION 1 — Hero */}
      <section
        className="pt-20 md:pt-32 pb-16 md:pb-20 px-4 relative overflow-hidden min-h-[100dvh] flex items-center"
        style={{
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.78), rgba(0, 0, 0, 0.88)), url(${heroBackground})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 md:mb-6 leading-[1.15]">
            Stop calling your foreman for updates.
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl text-gray-200 mb-8 md:mb-10 leading-relaxed max-w-3xl mx-auto">
            Your crew logs progress in seconds. You see updates, photos, and
            issues instantly. No calls. No guessing.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-xl mx-auto">
            <Button
              size="lg"
              onClick={scrollToCalendly}
              className="h-14 md:h-16 px-6 md:px-8 text-base md:text-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xl"
            >
              We'll set up your first job for you
            </Button>
            <button
              onClick={scrollToDemo}
              className="text-white/80 hover:text-white text-base md:text-lg font-medium underline underline-offset-4 transition-colors self-center"
            >
              Watch 60-second demo
            </button>
          </div>
        </div>
      </section>

      {/* SECTION 2 — Pain */}
      <section className="py-16 md:py-24 px-4 bg-zinc-950 border-y border-border">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-10 md:mb-12 text-center leading-tight">
            Sound familiar?
          </h2>
          <ul className="space-y-4">
            {painPoints.map((item, index) => (
              <li
                key={index}
                className="flex items-start gap-4 p-4 md:p-5 bg-card rounded-xl border border-border"
              >
                <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </div>
                <span className="text-base md:text-lg text-foreground font-medium leading-snug">
                  {item.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* SECTION 3 — Demo Video */}
      <section
        ref={demoSectionRef}
        className="py-12 md:py-16 px-4 bg-background"
        id="demo"
      >
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

      {/* SECTION 4 — How It Works */}
      <section className="py-16 md:py-24 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-10 md:mb-14 text-center leading-tight">
            Here's what changes
          </h2>
          <div className="grid sm:grid-cols-3 gap-6 md:gap-8">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={index} className="text-center">
                  <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground text-2xl font-bold flex items-center justify-center mx-auto mb-4 shadow-lg">
                    {step.number}
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-lg md:text-xl font-bold text-foreground mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION 5 — Outcomes */}
      <section className="py-16 md:py-24 px-4 bg-background">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-10 md:mb-12 text-center leading-tight">
            What this actually does for you
          </h2>
          <div className="space-y-4">
            {outcomes.map((outcome, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-5 md:p-6 bg-card rounded-xl border border-border"
              >
                <CheckCircle className="h-6 w-6 text-primary flex-shrink-0" strokeWidth={2.5} />
                <p className="text-lg md:text-xl font-semibold text-foreground">
                  {outcome}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 6 — Social Proof */}
      <section className="py-16 md:py-24 px-4 bg-muted/30">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-10 md:mb-12 text-center leading-tight">
            What owners notice right away
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {quotes.map((quote, index) => (
              <div
                key={index}
                className="p-6 md:p-8 bg-card rounded-xl border border-border flex items-center justify-center"
              >
                <p className="text-xl md:text-2xl font-bold text-foreground text-center leading-snug">
                  "{quote}"
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 7 — Pilot Offer / Calendly */}
      <section
        ref={calendlySectionRef}
        className="py-16 md:py-24 px-4 bg-background"
        id="setup"
      >
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-8 md:mb-10">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight">
              Let's set up your first job
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground mb-3 leading-relaxed">
              We'll walk through one of your real projects and get your crew
              using it this week.
            </p>
            <p className="text-sm md:text-base text-muted-foreground/70">
              No commitment. If it doesn't help, don't use it.
            </p>
          </div>
          <div
            className="calendly-inline-widget rounded-xl overflow-hidden border border-border"
            data-url="https://calendly.com/jonmorrison/project-path-setup"
            style={{ minWidth: "320px", height: "700px" }}
          />
        </div>
      </section>

      {/* SECTION 8 — Objection Handling */}
      <section className="py-16 md:py-24 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-10 md:mb-12 text-center leading-tight">
            You're probably thinking…
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {objections.map((item, index) => (
              <div
                key={index}
                className="p-6 bg-card rounded-xl border border-border"
              >
                <p className="text-base font-bold text-foreground mb-3 leading-snug">
                  "{item.concern}"
                </p>
                <div className="flex items-start gap-2">
                  <ArrowRight className="h-4 w-4 text-primary flex-shrink-0 mt-1" />
                  <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                    {item.response}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-20 md:py-28 px-4 bg-primary">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary-foreground mb-4 leading-tight">
            We'll set up your first job for you
          </h2>
          <p className="text-lg md:text-xl text-primary-foreground/90 mb-8 max-w-xl mx-auto">
            Book a 15-minute setup call. We handle the rest.
          </p>
          <Button
            size="lg"
            onClick={scrollToCalendly}
            className="h-14 md:h-16 px-8 md:px-10 text-base md:text-lg bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-bold shadow-xl"
          >
            Book setup call
            <ChevronRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="py-8 px-4 bg-card border-t border-border">
        <div className="container mx-auto max-w-4xl">
          <div className="flex flex-wrap justify-center items-center gap-6 md:gap-12 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span>Your data stays yours</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Setup takes 15 minutes</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>Built for 2–8 job companies</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-border">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <img
                src={projectPathLogo}
                alt="Project Path"
                className="h-16 w-auto max-w-[240px]"
              />
              <p className="text-sm text-foreground/70">
                © 2026 Project Path. Built for the field.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/features")}
              >
                Features
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/safety-security")}
              >
                Safety & Security
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/responsible-ai")}
              >
                Responsible AI
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/auth")}
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
