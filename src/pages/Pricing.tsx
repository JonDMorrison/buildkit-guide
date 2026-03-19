import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Shield,
  Clock,
  Users,
  ChevronRight,
  Zap,
  Building2,
  Layers,
  Building,
} from "lucide-react";
import { PublicNav } from "@/components/PublicNav";
import projectPathLogo from "@/assets/project-path-logo.png";

export default function Pricing() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // SEO meta tags
  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Pricing — Project Path";

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
      "Simple, predictable pricing for construction teams. Plans start at $79/month. No per-user fees, no contracts.";

    const descEl = setMeta("description", description);
    const canonicalEl = setLink("canonical", "https://projectpath.app/pricing");

    return () => {
      document.title = prevTitle;
      descEl?.remove();
      canonicalEl?.remove();
    };
  }, []);

  const tiers = [
    {
      name: "Small Crews",
      price: "$79",
      subtitle: "Up to 3 active jobs",
      popular: false,
      icon: Building2,
      features: [
        "Unlimited users and foremen",
        "Unlimited photos and storage",
        "Real-time job updates",
        "Daily logs and task tracking",
        "Direct onboarding support",
      ],
    },
    {
      name: "Growing Companies",
      price: "$199",
      subtitle: "Up to 10 active jobs",
      popular: true,
      icon: Layers,
      features: [
        "Everything in Small Crews",
        "Priority support",
        "Advanced reporting",
        "Multi-site dashboard",
        "Direct onboarding support",
      ],
    },
    {
      name: "Operations Teams",
      price: "$399",
      subtitle: "Unlimited active jobs",
      popular: false,
      icon: Building,
      features: [
        "Everything in Growing Companies",
        "Dedicated account setup",
        "Custom onboarding for your crew",
        "Early access to new features",
      ],
    },
  ];

  const faqs = [
    {
      question: "What counts as an active job?",
      answer:
        "Any project your crew is actively logging work on. Completed or paused jobs do not count toward your limit.",
    },
    {
      question: "Can I change plans later?",
      answer:
        "Yes. You can upgrade or downgrade any time. Founding partners keep their original tier pricing regardless of plan changes.",
    },
    {
      question: "Do you charge per user or per foreman?",
      answer:
        "Never. Add as many crew members as you need at no extra cost.",
    },
    {
      question: "Is there a contract?",
      answer:
        "No contracts. Month to month. If it does not help your jobs, cancel any time.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <PublicNav />

      {/* SECTION 1 — Hero */}
      <section
        className="pt-20 md:pt-28 pb-12 md:pb-16 px-4 min-h-[50vh] flex items-center relative overflow-hidden"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,0.80), rgba(0,0,0,0.88)), url(https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=1600&q=80)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="container mx-auto max-w-3xl text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 md:mb-6 leading-tight">
            Simple pricing based on how many jobs you run
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl text-white/80 leading-relaxed">
            No per-user fees. No feature limits. No surprises.
          </p>
        </div>
      </section>

      {/* SECTION 2 — Pricing tiers */}
      <section className="py-12 md:py-20 px-4 bg-gradient-to-b from-zinc-50 to-white">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-3 gap-6 md:gap-8 items-stretch">
            {tiers.map((tier, index) => {
              const TierIcon = tier.icon;
              return (
                <div
                  key={index}
                  className={`relative flex flex-col rounded-xl border transition-shadow duration-200 ${
                    tier.popular
                      ? "border-primary bg-primary/5 shadow-2xl hover:shadow-xl md:-translate-y-4 [box-shadow:0_0_40px_rgba(0,163,224,0.15),0_25px_50px_-12px_rgba(0,0,0,0.25)]"
                      : "border-border bg-card shadow-lg hover:shadow-xl"
                  }`}
                >
                  {/* Top accent bar — popular card only */}
                  {tier.popular && (
                    <div className="h-1 w-full bg-primary rounded-t-xl" />
                  )}

                  <div className="p-6 md:p-8 flex flex-col flex-1">
                    {/* Most Popular badge */}
                    {tier.popular && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                        <span className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg">
                          <Zap className="h-3 w-3" />
                          Most Popular
                        </span>
                      </div>
                    )}

                    <div className="mb-6">
                      <p className="text-sm font-semibold text-primary uppercase tracking-wide mb-1">
                        {tier.name}
                      </p>
                      <div className="flex items-end gap-1 mb-1">
                        <span className="text-4xl md:text-5xl font-bold text-foreground">
                          {tier.price}
                        </span>
                        <span className="text-muted-foreground mb-1.5">/month</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{tier.subtitle}</p>
                    </div>

                    <ul className="space-y-3 mb-8 flex-1">
                      {tier.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <CheckCircle
                            className="h-5 w-5 flex-shrink-0 mt-0.5 text-primary"
                            strokeWidth={2.5}
                          />
                          <span className="text-sm md:text-base text-foreground">
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      size="lg"
                      onClick={() => navigate("/get-started")}
                      className={`w-full h-12 md:h-14 text-base font-semibold ${
                        tier.popular
                          ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
                          : "bg-card border border-border hover:bg-muted text-foreground"
                      }`}
                      variant={tier.popular ? "default" : "outline"}
                    >
                      Book setup call
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>

                    {/* Decorative watermark icon */}
                    <div className="flex justify-center mt-6">
                      <TierIcon className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION 3 — Founding partner callout */}
      <section className="py-16 md:py-20 px-4 bg-zinc-950">
        <div className="container mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 bg-primary/20 border border-primary/30 rounded-full px-4 py-1.5 mb-6">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-primary uppercase tracking-wide">
              Limited offer
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
            Founding partner pricing
          </h2>
          <p className="text-lg md:text-xl text-white/70 leading-relaxed max-w-2xl mx-auto">
            The first 10 companies to sign up are locked into their tier
            permanently — even as they grow. This pricing will not last.
          </p>
        </div>
      </section>

      {/* SECTION 4 — FAQ */}
      <section className="py-16 md:py-20 px-4 bg-zinc-50">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-8 md:mb-12 text-center leading-tight">
            Common questions
          </h2>
          <div className="space-y-3">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-card rounded-lg border border-border overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-muted/50 transition-colors"
                >
                  <span className="text-base md:text-lg font-semibold text-foreground pr-4">
                    {faq.question}
                  </span>
                  {openFaq === index ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  )}
                </button>
                {openFaq === index && (
                  <div className="px-5 pb-5">
                    <p className="text-muted-foreground leading-relaxed pl-4 border-l-2 border-primary/30">
                      {faq.answer}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 5 — Final CTA */}
      <section className="py-20 md:py-28 px-4 bg-zinc-950">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
            Not sure which plan fits?
          </h2>
          <p className="text-lg md:text-xl text-white/80 mb-8 max-w-xl mx-auto">
            Book a 15-minute call and we will figure it out together.
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/get-started")}
            className="h-14 md:h-16 px-8 md:px-10 text-base md:text-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-xl"
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
              <span>No contracts</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>Unlimited users on every plan</span>
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
