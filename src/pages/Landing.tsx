import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  Sun, Mic, ShieldAlert, BookOpen, Brain, FileText,
  Quote,
} from "lucide-react";
import { useState } from "react";
import projectPathLogo from "@/assets/project-path-logo.png";

export default function Landing() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleGetStarted = () => navigate("/auth?tab=signup");
  const handleLogin = () => navigate("/auth");

  return (
    <div className="min-h-screen bg-[#060d18] text-white overflow-x-hidden">
      {/* ════════════════════════════════════════════════════════════════ */}
      {/* HERO                                                           */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col overflow-hidden">
        {/* Layer 1: gradient background */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 0%, rgba(74,143,212,0.12), transparent 55%), radial-gradient(ellipse at 15% 100%, rgba(45,106,173,0.08), transparent 45%), linear-gradient(170deg, #060d18 0%, #080f1e 40%, #060d18 100%)",
          }}
        />

        {/* Layer 1.5: construction site photo */}
        <div
          className="absolute inset-0 z-[1]"
          style={{
            backgroundImage:
              "linear-gradient(to bottom, rgba(6,13,24,0.85) 0%, rgba(6,13,24,0.70) 50%, rgba(6,13,24,0.92) 100%), url('https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=1920&q=80&auto=format&fit=crop')",
            backgroundSize: "cover",
            backgroundPosition: "center 40%",
          }}
        />

        {/* Layer 2: ghosted PROJECTPATH */}
        <div
          className="absolute top-[22%] left-1/2 -translate-x-1/2 select-none pointer-events-none whitespace-nowrap z-[2]"
          style={{
            fontSize: "clamp(6rem, 18vw, 16rem)",
            fontWeight: 900,
            letterSpacing: "0.05em",
            opacity: 0.11,
            color: "white",
            textShadow:
              "0 0 40px rgba(74,143,212,0.20), 0 0 80px rgba(74,143,212,0.12), 0 0 120px rgba(74,143,212,0.06)",
            animation: "ghostPulse 4s ease-in-out infinite",
          }}
        >
          PROJECTPATH
        </div>

        {/* Layer 3: perspective wireframe grid */}
        <div className="absolute top-[45%] bottom-0 left-0 right-0 overflow-hidden z-[3]" style={{ perspective: "700px" }}>
          {/* Primary grid */}
          <div
            className="absolute inset-0"
            style={{
              transform: "rotateX(65deg) scale(1.3)",
              transformOrigin: "center bottom",
              backgroundImage:
                "linear-gradient(rgba(74,143,212,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(74,143,212,0.4) 1px, transparent 1px)",
              backgroundSize: "50px 50px",
              maskImage: "linear-gradient(to bottom, transparent 0%, black 40%)",
              WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 40%)",
              animation: "gridScroll 3s linear infinite",
            }}
          />
          {/* Diamond cross-hatch overlay */}
          <div
            className="absolute inset-0"
            style={{
              transform: "rotateX(65deg) scale(1.3)",
              transformOrigin: "center bottom",
              backgroundImage:
                "linear-gradient(45deg, rgba(74,143,212,0.08) 1px, transparent 1px), linear-gradient(-45deg, rgba(74,143,212,0.08) 1px, transparent 1px)",
              backgroundSize: "50px 50px",
              maskImage: "linear-gradient(to bottom, transparent 0%, black 40%)",
              WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 40%)",
            }}
          />
          {/* Bright focal glow at center bottom */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(circle at 50% 90%, rgba(74,143,212,0.35), transparent 45%), radial-gradient(circle at 35% 75%, rgba(74,143,212,0.3), transparent 40%), radial-gradient(circle at 65% 80%, rgba(45,106,173,0.2), transparent 35%)",
            }}
          />
        </div>

        {/* Nav (Layer 5) */}
        <nav className="absolute top-0 left-0 right-0 z-20 border-b border-white/[0.08]" style={{ background: "transparent" }}>
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center cursor-pointer" onClick={() => navigate("/")}>
              <img src={projectPathLogo} alt="ProjectPath" className="h-9 w-auto" />
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleLogin} className="px-3 py-2 text-sm text-white/50 hover:text-white transition-colors">
                Log In
              </button>
              <Button onClick={handleGetStarted} className="bg-[#4a8fd4] hover:bg-[#3a7fc4] text-white font-semibold h-10 px-5 rounded-2xl">
                Start Free Trial
              </Button>
            </div>
          </div>
        </nav>

        {/* Hero content (Layer 4) */}
        <div className="relative z-10 flex-1 flex items-center justify-center px-6" style={{ paddingTop: "10vh" }}>
          <div className="max-w-4xl text-center">
            <p className="text-white/50 tracking-[0.2em] uppercase font-medium mb-3" style={{ fontSize: "0.85rem" }}>
              Trusted by contractors across Canada
            </p>

            <h1 className="space-y-1 mb-8">
              <span
                className="block font-normal leading-[1.08]"
                style={{ fontSize: "clamp(2.8rem, 5.5vw, 5.5rem)" }}
              >
                Your entire job site,
              </span>
              <span
                className="block leading-[1.08]"
                style={{ fontSize: "clamp(2.8rem, 5.5vw, 5.5rem)", fontWeight: 900 }}
              >
                in one command center.
              </span>
            </h1>

            <p
              className="italic font-semibold text-[#7ab8f5] mb-8"
              style={{
                fontSize: "clamp(1.8rem, 3.5vw, 3.2rem)",
                transform: "rotate(-3deg)",
                display: "inline-block",
                textShadow: "0 0 30px rgba(74,143,212,0.4)",
              }}
            >
              Tasks. Trades. Time. All connected.
            </p>

            <p className="text-white/65 mx-auto leading-[1.6] mb-10" style={{ fontSize: "1.1rem", maxWidth: "600px" }}>
              ProjectPath replaces the group texts, scattered spreadsheets, and missed handoffs with a single AI-powered platform built for how construction actually works.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
              <button
                onClick={handleGetStarted}
                className="text-white font-bold rounded-[14px] w-full sm:w-auto transition-all hover:brightness-110"
                style={{
                  background: "#4a8fd4",
                  padding: "18px 40px",
                  fontSize: "1.1rem",
                  boxShadow: "0 0 24px rgba(74,143,212,0.3)",
                }}
              >
                Start Free Trial — Free for 14 Days
              </button>
              <button
                onClick={() => navigate("/how-it-works")}
                className="text-white rounded-[14px] w-full sm:w-auto transition-all hover:bg-white/8"
                style={{
                  border: "1.5px solid rgba(255,255,255,0.30)",
                  background: "rgba(255,255,255,0.06)",
                  padding: "18px 40px",
                  fontSize: "1.1rem",
                }}
              >
                Watch 2-min Demo
              </button>
            </div>

            <p className="text-white/45 mt-8" style={{ fontSize: "0.85rem" }}>
              No credit card required&nbsp; · &nbsp;Setup in 10 minutes&nbsp; · &nbsp;Cancel anytime
            </p>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* SECTION 1: THE PROBLEM                                         */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <section className="relative py-24 px-6 bg-[#070e1c]">
        <div className="max-w-5xl mx-auto space-y-12">
          <h2 className="text-2xl md:text-4xl font-bold text-center leading-tight">
            Construction management is still done with<br className="hidden md:block" /> spreadsheets and group texts.
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: "Tasks fall through the cracks",
                desc: "No single place where the crew, the PM, and the owner all see the same thing.",
              },
              {
                title: "Nobody knows the real numbers",
                desc: "Job cost, margin, and labor burn are always a week behind.",
              },
              {
                title: "Safety and quality are reactive",
                desc: "Deficiencies pile up. Safety forms get skipped. Problems surface too late.",
              },
            ].map((pain, i) => (
              <div key={i} className="border border-white/10 rounded-xl p-6 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                <h3 className="text-lg font-semibold mb-2">{pain.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{pain.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* SECTION 2: THE SOLUTION                                        */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <section className="relative py-24 px-6 bg-[#0a1628]">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-2xl md:text-4xl font-bold">One platform. Everything connected.</h2>
            <p className="text-base text-white/50 max-w-2xl mx-auto">
              ProjectPath replaces the chaos with a system that actually matches how construction works.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Sun, title: "AI Morning Briefing", desc: "Every morning, your AI summarizes what's urgent, who's on site, and what could derail the day." },
              { icon: Mic, title: "Voice Commands", desc: "Speak to create tasks, log deficiencies, and request manpower. No typing required on site." },
              { icon: ShieldAlert, title: "Proactive Alerts", desc: "Stale blockers, trades over hours, deficiency spikes — flagged automatically before they become problems." },
              { icon: BookOpen, title: "Playbooks", desc: "Build reusable job templates with AI. Every similar job starts with a proven phase-by-phase plan." },
              { icon: Brain, title: "Org Intelligence", desc: "Learn which trades run over, which job types are risky, and where your margin leaks — across all your projects." },
              { icon: FileText, title: "Client Reports", desc: "Generate professional weekly reports for owners and GCs in one click. Export as PDF." },
            ].map((feat, i) => (
              <div key={i} className="border border-white/10 rounded-xl p-6 bg-white/[0.02] hover:border-[#4a8fd4]/40 transition-colors group">
                <feat.icon className="h-8 w-8 text-[#4a8fd4] mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="text-base font-semibold mb-2">{feat.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* SECTION 3: SOCIAL PROOF                                        */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <section className="relative py-24 px-6 bg-[#070e1c]">
        <div className="max-w-5xl mx-auto space-y-12">
          <h2 className="text-2xl md:text-4xl font-bold text-center">
            Built for the job site. Tested in the field.
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote: "We used to run everything in WhatsApp and spreadsheets. ProjectPath gave us a real system for the first time.",
                name: "Jordan P.",
                role: "General Contractor",
              },
              {
                quote: "The morning briefing alone saves me 30 minutes every day. I know exactly what to focus on before I walk on site.",
                name: "Site Foreman",
                role: "Kelowna, BC",
              },
              {
                quote: "Our PMs finally have one place to see everything. Job cost, tasks, safety — all in one dashboard.",
                name: "Construction PM",
                role: "Commercial Division",
              },
            ].map((testimonial, i) => (
              <div key={i} className="border border-white/10 rounded-xl p-6 bg-white/[0.02] space-y-4">
                <Quote className="h-6 w-6 text-[#4a8fd4]/40" />
                <p className="text-sm text-white/70 leading-relaxed italic">"{testimonial.quote}"</p>
                <div>
                  <p className="text-sm font-semibold">{testimonial.name}</p>
                  <p className="text-xs text-white/40">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* SECTION 4: FINAL CTA                                           */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <section className="relative py-28 px-6 bg-[#050b16]">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <h2 className="text-2xl md:text-4xl font-bold">Your job site deserves better tools.</h2>
          <p className="text-base text-white/50">
            Start your free trial. Setup takes 10 minutes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Button onClick={handleGetStarted} size="lg" className="bg-[#4a8fd4] hover:bg-[#3a7fc4] text-white font-semibold h-14 px-8 text-lg rounded-2xl w-full sm:w-auto">
              Start Free Trial
            </Button>
            <Button onClick={() => navigate("/get-started")} variant="outline" size="lg"
              className="border-white/30 text-white hover:bg-white/5 h-14 px-8 text-lg rounded-2xl w-full sm:w-auto bg-transparent">
              Book a Demo
            </Button>
          </div>
          <p className="text-xs text-white/25">
            No credit card required · Cancel anytime · Built for Canadian contractors
          </p>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* FOOTER                                                         */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <footer className="border-t border-white/[0.06] py-10 px-6 bg-[#050b16]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center cursor-pointer" onClick={() => navigate("/")}>
            <img src={projectPathLogo} alt="ProjectPath" className="h-8 w-auto opacity-60" />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-white/40">
            {[
              { label: "Features", path: "/features" },
              { label: "Pricing", path: "/pricing" },
              { label: "Get Started", path: "/get-started" },
              { label: "Log In", path: "/auth" },
            ].map((link) => (
              <button key={link.path} onClick={() => navigate(link.path)} className="hover:text-white/70 transition-colors">
                {link.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-white/20">
            © 2026 ProjectPath. Built for the people who build.
          </p>
        </div>
      </footer>

      {/* Keyframe animations */}
      <style>{`
        @keyframes ghostPulse {
          0%, 100% { opacity: 0.09; }
          50% { opacity: 0.13; }
        }
        @keyframes gridScroll {
          from { background-position: 0 0; }
          to { background-position: 0 -50px; }
        }
      `}</style>
    </div>
  );
}
