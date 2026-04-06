import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  Sun, Mic, ShieldAlert, BookOpen, Brain, FileText,
  Quote, MessageSquareX, TrendingDown, AlertTriangle,
  Building2, ClipboardList, HardHat, Play, ChevronDown,
} from "lucide-react";
import { useState } from "react";
import projectPathLogo from "@/assets/project-path-logo.png";

export default function Landing() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

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
      {/* THE REAL COST                                                  */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <section className="relative py-24 px-6 bg-[#070e1c]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 space-y-4">
            <h2 className="text-2xl md:text-4xl font-bold leading-tight">
              The cost of running jobs on group texts and spreadsheets.
            </h2>
            <p className="text-white/60 mx-auto leading-relaxed" style={{ fontSize: "1.1rem", maxWidth: "680px" }}>
              Most contractors don't lose jobs on site. They lose them in the chaos between the office, the foreman, and the trades.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: MessageSquareX,
                iconColor: "text-red-400/70",
                title: "Tasks fall through the cracks",
                body: "A foreman gets a message at 7am. By 9am it's buried under 40 other texts. The task never gets done. Nobody knows until the GC shows up.",
              },
              {
                icon: TrendingDown,
                iconColor: "text-amber-400/70",
                title: "You don't know your numbers until it's too late",
                body: "Job cost, labor burn, and margin are always a week behind. By the time you see the overrun, you've already lost the money.",
              },
              {
                icon: AlertTriangle,
                iconColor: "text-red-400/70",
                title: "Safety and quality are always reactive",
                body: "Deficiencies pile up. Safety forms get skipped on busy days. The punch list shows up at the end when fixing things costs 3x more.",
              },
            ].map((card, i) => (
              <div key={i} className="bg-[#0a1628] rounded-xl border-l-[3px] border-l-[#4a8fd4]" style={{ padding: "28px" }}>
                <card.icon className={`h-7 w-7 ${card.iconColor} mb-4`} />
                <h3 className="text-base font-semibold mb-2">{card.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{card.body}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-white/50 italic mt-12" style={{ fontSize: "1rem" }}>
            ProjectPath was built to fix all three. Before they cost you.
          </p>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* PERSONA CARDS                                                  */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <section className="relative py-24 px-6 bg-[#0a1628]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 space-y-3">
            <h2 className="text-2xl md:text-4xl font-bold">Built for everyone on the job.</h2>
            <p className="text-white/60 mx-auto" style={{ maxWidth: "560px" }}>
              Whether you're running the business, managing the project, or working the site — ProjectPath works the way you do.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Building2,
                badge: "GENERAL CONTRACTOR",
                problem: "You're running 3 jobs and managing 12 subcontractors through a mix of calls, texts, and gut feel. You don't actually know where each job stands until something goes wrong.",
                win: "One dashboard across all your projects. Real job cost, live task status, and AI that flags problems before you have to ask.",
              },
              {
                icon: ClipboardList,
                badge: "PROJECT MANAGER",
                problem: "You're the hub for everything — the GC, the trades, the owner, the foreman. You spend half your day answering questions you've already answered.",
                win: "Everyone sees the same information. Trades update their own tasks. You get automated reports to send the owner in one click.",
              },
              {
                icon: HardHat,
                badge: "SITE FOREMAN",
                problem: "You're on site before 7am. You don't have time to type updates into a laptop. By the end of the day you've forgotten half of what happened.",
                win: "Tap the mic, say what happened. ProjectPath logs it, creates the tasks, and sends the daily summary — while you're still on site.",
              },
            ].map((persona, i) => (
              <div key={i} className="bg-[#060d18] rounded-xl border-t-[3px] border-t-[#4a8fd4] flex flex-col" style={{ padding: "32px" }}>
                <persona.icon className="h-8 w-8 text-[#4a8fd4] mb-4" />
                <span
                  className="inline-block self-start rounded-full border mb-5"
                  style={{
                    background: "rgba(74,143,212,0.15)",
                    color: "#4a8fd4",
                    borderColor: "rgba(74,143,212,0.30)",
                    padding: "4px 12px",
                    fontSize: "0.7rem",
                    letterSpacing: "0.1em",
                    fontWeight: 600,
                  }}
                >
                  {persona.badge}
                </span>
                <p className="text-white/40 uppercase text-[10px] tracking-[0.15em] font-medium mb-1">The challenge:</p>
                <p className="text-sm text-white/60 leading-relaxed mb-5">{persona.problem}</p>
                <p className="text-[#4a8fd4] uppercase text-[10px] tracking-[0.15em] font-medium mb-1 mt-auto">The ProjectPath win:</p>
                <p className="text-sm text-white/70 leading-relaxed">{persona.win}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* FEATURES (existing solution section)                           */}
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
      {/* VIDEO PLACEHOLDER                                              */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <section className="relative py-24 px-6 bg-[#070e1c]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 space-y-3">
            <h2 className="text-2xl md:text-4xl font-bold">See ProjectPath in action.</h2>
            <p className="text-white/60">From morning briefing to daily log — see how a real job runs through ProjectPath.</p>
          </div>
          <div
            className="mx-auto rounded-2xl border border-[#4a8fd4]/25 bg-[#0a1628] overflow-hidden cursor-pointer group"
            style={{ maxWidth: "860px", boxShadow: "0 0 60px rgba(74,143,212,0.12)" }}
            onClick={() => navigate("/get-started")}
          >
            <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="relative">
                  {/* Pulse ring */}
                  <div
                    className="absolute inset-0 rounded-full bg-[#4a8fd4]/30"
                    style={{ animation: "playPulse 2s ease-out infinite" }}
                  />
                  <div className="relative h-20 w-20 rounded-full bg-[#4a8fd4] flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Play className="h-8 w-8 text-white ml-1" />
                  </div>
                </div>
                <p className="text-white/40 mt-4" style={{ fontSize: "0.85rem" }}>
                  2-minute walkthrough · No signup required
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* SOCIAL PROOF                                                   */}
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
      {/* FAQ                                                            */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <section className="relative py-24 px-6 bg-[#0a1628]">
        <div className="mx-auto" style={{ maxWidth: "760px" }}>
          <div className="text-center mb-12 space-y-3">
            <h2 className="text-2xl md:text-4xl font-bold">Questions contractors actually ask.</h2>
            <p className="text-white/60 mx-auto" style={{ maxWidth: "580px" }}>
              We've talked to a lot of foremen, PMs, and GCs. Here's what comes up every time.
            </p>
          </div>
          <div>
            {[
              {
                q: "Will my crew actually use this?",
                a: "Most field crews are skeptical of new software — and they should be. That's why we built voice commands. Your foreman taps a button, speaks naturally, and ProjectPath does the rest. No typing on a job site. Most crews are using it within the first week.",
              },
              {
                q: "How long does setup actually take?",
                a: "The core setup takes about 10 minutes: create your org, add your trades, create your first project. The AI calibration adds another 5. You can be running a real job on day one. Our onboarding wizard walks you through it step by step.",
              },
              {
                q: "Does it work without internet on site?",
                a: "The app requires a connection to sync data. Most job sites have LTE coverage. We're building offline mode for a future release. Anything logged on site syncs automatically when connectivity resumes.",
              },
              {
                q: "We already use Procore or Buildertrend. Why switch?",
                a: "Most enterprise tools are built for large GCs with dedicated admins and six-figure implementation budgets. ProjectPath is built for the contractor running 2–8 jobs without a full operations team. Faster to set up, easier to use on site, and AI built in from day one.",
              },
              {
                q: "How is the AI actually useful on a construction site?",
                a: "Every morning your team gets a briefing: what's due today, which blockers are unresolved, who's expected on site, and what safety concerns to watch for. Your foreman can speak to create tasks and log deficiencies. The system flags when a trade goes 30% over their hours before it becomes a problem.",
              },
              {
                q: "What does it cost?",
                a: "ProjectPath pricing is straightforward with no per-seat fees and no surprise add-ons. Book a demo and we'll walk you through the options that fit your operation.",
              },
              {
                q: "Is our project data secure?",
                a: "All data is encrypted in transit and at rest. We use enterprise-grade infrastructure with the same security standards used by thousands of enterprise applications. Your project data is never shared or used to train AI models.",
              },
            ].map((item, i) => (
              <div key={i} className="border-b border-white/10 py-5">
                <button
                  className="w-full flex items-center justify-between text-left"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="text-sm font-medium text-white pr-4">{item.q}</span>
                  <ChevronDown
                    className="h-4 w-4 text-white/40 shrink-0 transition-transform duration-200"
                    style={{ transform: openFaq === i ? "rotate(180deg)" : "rotate(0deg)" }}
                  />
                </button>
                {openFaq === i && (
                  <p className="text-white/65 leading-[1.7] pt-3 pb-1" style={{ fontSize: "0.95rem" }}>
                    {item.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* FINAL CTA                                                      */}
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
        @keyframes playPulse {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
