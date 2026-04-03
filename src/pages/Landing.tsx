import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  Sun, Mic, ShieldAlert, BookOpen, Brain, FileText,
  ChevronDown, ChevronUp, Menu, Quote,
} from "lucide-react";
import { useState } from "react";
import projectPathLogo from "@/assets/project-path-logo.png";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export default function Landing() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleGetStarted = () => navigate("/auth?tab=signup");
  const handleLogin = () => navigate("/auth");

  return (
    <div className="min-h-screen bg-[#060c14] text-white overflow-x-hidden">
      {/* ════════════════════════════════════════════════════════════════ */}
      {/* HERO                                                           */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col overflow-hidden">
        {/* Layer 1: gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#060c14] via-[#0a1218] to-[#0e1a0a]" />

        {/* Layer 2: ghosted PROJECTPATH */}
        <div
          className="absolute top-[18%] left-1/2 -translate-x-1/2 select-none pointer-events-none whitespace-nowrap"
          style={{
            fontSize: "clamp(4rem, 14vw, 13rem)",
            fontWeight: 900,
            letterSpacing: "-0.02em",
            opacity: 0.08,
            color: "white",
            textShadow:
              "0 0 80px rgba(255,255,255,0.15), 0 0 160px rgba(255,255,255,0.08), 0 0 320px rgba(255,255,255,0.04)",
            animation: "ghostPulse 4s ease-in-out infinite",
          }}
        >
          PROJECTPATH
        </div>

        {/* Layer 3: perspective wireframe grid */}
        <div className="absolute bottom-0 left-0 right-0 h-[55%] overflow-hidden" style={{ perspective: "800px" }}>
          <div
            className="absolute inset-0"
            style={{
              transform: "rotateX(68deg)",
              transformOrigin: "center bottom",
              backgroundImage:
                "linear-gradient(rgba(122,182,72,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(122,182,72,0.25) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
              maskImage: "linear-gradient(to bottom, transparent 0%, black 40%)",
              WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 40%)",
              animation: "gridPan 20s linear infinite",
            }}
          />
          {/* Radial glow spots */}
          <div className="absolute bottom-[20%] left-[30%] w-64 h-64 rounded-full bg-[#7ab648]/10 blur-[100px]" />
          <div className="absolute bottom-[30%] right-[25%] w-48 h-48 rounded-full bg-[#7ab648]/8 blur-[80px]" />
        </div>

        {/* Nav (Layer 5) */}
        <nav className="relative z-20 w-full border-b border-white/[0.08]">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center cursor-pointer" onClick={() => navigate("/")}>
              <img src={projectPathLogo} alt="ProjectPath" className="h-9 w-auto" />
            </div>
            <div className="hidden md:flex items-center gap-3">
              {[
                { label: "How It Works", path: "/how-it-works" },
                { label: "Features", path: "/features" },
                { label: "Safety & Security", path: "/safety-security" },
              ].map((item) => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="px-3 py-2 text-sm text-white/70 hover:text-white transition-colors"
                >
                  {item.label}
                </button>
              ))}
              <button onClick={handleLogin} className="px-3 py-2 text-sm text-white/50 hover:text-white transition-colors">
                Log In
              </button>
              <Button onClick={handleGetStarted} className="bg-[#7ab648] hover:bg-[#6aa33d] text-white font-semibold h-10 px-5 rounded-2xl">
                Start Free Trial
              </Button>
            </div>
            {/* Mobile */}
            <div className="flex md:hidden items-center gap-2">
              <Button onClick={handleGetStarted} size="sm" className="bg-[#7ab648] hover:bg-[#6aa33d] text-white rounded-2xl">
                Start Free
              </Button>
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <button className="p-2 text-white/70 hover:text-white"><Menu className="h-6 w-6" /></button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[280px]">
                  <SheetHeader className="text-left mb-6">
                    <SheetTitle><img src={projectPathLogo} alt="ProjectPath" className="h-10 w-auto" /></SheetTitle>
                  </SheetHeader>
                  <nav className="flex flex-col gap-3">
                    {["How It Works", "Features", "Safety & Security"].map((label) => (
                      <button key={label} onClick={() => { navigate(`/${label.toLowerCase().replace(/ & /g, "-").replace(/ /g, "-")}`); setMobileMenuOpen(false); }}
                        className="text-left py-2 text-base font-medium">{label}</button>
                    ))}
                    <button onClick={() => { handleLogin(); setMobileMenuOpen(false); }} className="text-left py-2 text-base">Sign In</button>
                    <Button onClick={() => { handleGetStarted(); setMobileMenuOpen(false); }} className="bg-[#7ab648] text-white mt-4 w-full">Get Started Free</Button>
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </nav>

        {/* Hero content (Layer 4) */}
        <div className="relative z-10 flex-1 flex items-center justify-center px-6">
          <div className="max-w-3xl text-center space-y-8">
            <p className="text-xs md:text-sm tracking-[0.25em] uppercase text-white/50 font-medium">
              Construction OS for Contractors and PMs
            </p>

            <h1>
              <span className="block text-4xl md:text-6xl lg:text-7xl font-medium leading-[1.1]">
                Run your jobs.
              </span>
              <span className="block text-4xl md:text-6xl lg:text-7xl font-extrabold leading-[1.1]">
                Not your software.
              </span>
            </h1>

            <p
              className="text-lg md:text-xl italic text-[#7ab648] font-medium"
              style={{ transform: "rotate(-2deg)", display: "inline-block" }}
            >
              Every task. Every trade. Every day.
            </p>

            <p className="text-base md:text-lg text-white/60 max-w-2xl mx-auto leading-relaxed">
              ProjectPath gives contractors and PMs a single command center for tasks, time, safety, and AI insights — so you can focus on building, not admin.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <Button onClick={handleGetStarted} size="lg" className="bg-[#7ab648] hover:bg-[#6aa33d] text-white font-semibold h-14 px-8 text-lg rounded-2xl w-full sm:w-auto">
                Start Free Trial
              </Button>
              <Button onClick={() => navigate("/how-it-works")} variant="outline" size="lg"
                className="border-white/30 text-white hover:bg-white/5 h-14 px-8 text-lg rounded-2xl w-full sm:w-auto bg-transparent">
                See how it works
              </Button>
            </div>

            <p className="text-sm text-white/30">
              Used by contractors across Canada · No credit card required
            </p>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* SECTION 1: THE PROBLEM                                         */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <section className="relative py-24 px-6 bg-[#080e16]">
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
      <section className="relative py-24 px-6 bg-[#0a1119]">
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
              <div key={i} className="border border-white/10 rounded-xl p-6 bg-white/[0.02] hover:border-[#7ab648]/30 transition-colors group">
                <feat.icon className="h-8 w-8 text-[#7ab648] mb-4 group-hover:scale-110 transition-transform" />
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
      <section className="relative py-24 px-6 bg-[#080e16]">
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
                <Quote className="h-6 w-6 text-[#7ab648]/50" />
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
      <section className="relative py-28 px-6 bg-[#050a10]">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <h2 className="text-2xl md:text-4xl font-bold">Your job site deserves better tools.</h2>
          <p className="text-base text-white/50">
            Start your free trial. Setup takes 10 minutes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Button onClick={handleGetStarted} size="lg" className="bg-[#7ab648] hover:bg-[#6aa33d] text-white font-semibold h-14 px-8 text-lg rounded-2xl w-full sm:w-auto">
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
      <footer className="border-t border-white/[0.06] py-10 px-6 bg-[#050a10]">
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
          0%, 100% { opacity: 0.07; }
          50% { opacity: 0.11; }
        }
        @keyframes gridPan {
          0% { background-position: 0 0; }
          100% { background-position: 60px 60px; }
        }
      `}</style>
    </div>
  );
}
