import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Brain, CheckCircle, XCircle, User, Lock, ChevronRight } from "lucide-react";
import aiHero from "@/assets/responsible-ai-hero.jpg";
import buildSenseLogo from "@/assets/build-sense-logo.png";
import { PublicNav } from "@/components/PublicNav";

export default function ResponsibleAI() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <PublicNav />

      {/* Hero Section */}
      <section 
        className="pt-28 md:pt-32 pb-16 md:pb-20 px-4 relative overflow-hidden min-h-[60vh] flex items-center"
        style={{
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.75)), url(${aiHero})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            Responsible Use of AI in Safety-Critical Systems
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl text-gray-200 mb-4 leading-relaxed max-w-3xl mx-auto">
            AI that assists — never decides
          </p>
          <p className="text-base md:text-lg text-gray-300 leading-relaxed max-w-2xl mx-auto">
            We use AI to reduce friction and improve completeness, while keeping responsibility with people.
          </p>
        </div>
      </section>

      {/* Core Statement */}
      <section className="py-16 md:py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <div className="p-6 md:p-8 bg-background rounded-lg border-2 border-border">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-muted rounded-lg">
                <Brain className="h-6 w-6 text-foreground" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                Responsible AI in Safety
              </h2>
            </div>
            <div className="space-y-4 text-muted-foreground leading-relaxed">
              <p>
                We use artificial intelligence to assist users in documenting safety information more effectively — not to replace human judgment, supervision, or responsibility.
              </p>
              <p>
                AI in our system may help suggest common hazards, reduce manual typing, or highlight areas that may require attention. All AI-generated suggestions are optional, clearly labeled, and must be reviewed and confirmed by a qualified human before submission.
              </p>
              <p>
                AI does not submit forms, make safety decisions, determine compliance, assign fault, or override user input. Responsibility for safety planning, verification, and compliance always remains with the employer and supervising personnel.
              </p>
              <p>
                Our AI systems are designed to fail safely. If AI services are unavailable, all safety workflows continue to function without interruption.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What AI Helps With */}
      <section className="py-16 md:py-20 px-4 bg-background">
        <div className="container mx-auto max-w-4xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-muted rounded-lg">
              <CheckCircle className="h-6 w-6 text-foreground" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              What AI Helps With
            </h2>
          </div>
          <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
            AI is used to reduce friction in documentation, not to make safety decisions.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              "Suggesting common hazards based on context (weather, tasks, trades)",
              "Helping reduce typing through voice input",
              "Highlighting potential omissions before submission",
              "Improving clarity and consistency in documentation"
            ].map((item, index) => (
              <div key={index} className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg border border-border">
                <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <p className="text-foreground">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What AI Does NOT Do */}
      <section className="py-16 md:py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-background rounded-lg border border-border">
              <XCircle className="h-6 w-6 text-foreground" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              What AI Does Not Do
            </h2>
          </div>
          <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
            We are explicit about the boundaries of AI in our system.
          </p>
          <div className="space-y-3">
            {[
              "Does not make safety decisions",
              "Does not auto-submit records",
              "Does not determine compliance",
              "Does not assign responsibility or blame",
              "Does not replace supervision or training"
            ].map((item, index) => (
              <div key={index} className="flex items-center gap-3 p-4 bg-background rounded-lg border border-border">
                <XCircle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <p className="text-foreground font-medium">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Human Accountability */}
      <section className="py-16 md:py-20 px-4 bg-background">
        <div className="container mx-auto max-w-4xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-muted rounded-lg">
              <User className="h-6 w-6 text-foreground" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              Human Accountability Is Built In
            </h2>
          </div>
          <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
            Every safety record reflects human decisions, not automated ones.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-5 bg-muted/50 rounded-lg border border-border">
              <h3 className="font-semibold text-foreground mb-2">Human Review Required</h3>
              <p className="text-muted-foreground text-sm">Humans must review and confirm all safety entries before they are submitted.</p>
            </div>
            <div className="p-5 bg-muted/50 rounded-lg border border-border">
              <h3 className="font-semibold text-foreground mb-2">Signatures Required</h3>
              <p className="text-muted-foreground text-sm">Signatures and acknowledgments are required for safety documentation.</p>
            </div>
            <div className="p-5 bg-muted/50 rounded-lg border border-border">
              <h3 className="font-semibold text-foreground mb-2">AI Suggestions Are Advisory</h3>
              <p className="text-muted-foreground text-sm">AI suggestions are clearly labeled and are advisory only — never mandatory.</p>
            </div>
            <div className="p-5 bg-muted/50 rounded-lg border border-border">
              <h3 className="font-semibold text-foreground mb-2">Records Reflect Human Decisions</h3>
              <p className="text-muted-foreground text-sm">Final records reflect human decisions, verified by qualified personnel.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Data Privacy */}
      <section className="py-16 md:py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-background rounded-lg border border-border">
              <Lock className="h-6 w-6 text-foreground" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              Data Privacy & Confidentiality
            </h2>
          </div>
          <div className="space-y-4">
            <div className="p-5 bg-background rounded-lg border border-border">
              <h3 className="font-semibold text-foreground mb-2">No Training on Customer Data</h3>
              <p className="text-muted-foreground">AI does not train on customer safety data. Your records are not used to improve AI models.</p>
            </div>
            <div className="p-5 bg-background rounded-lg border border-border">
              <h3 className="font-semibold text-foreground mb-2">Data Stays in Your Organization</h3>
              <p className="text-muted-foreground">Customer data is not reused outside their organization. Your safety information remains yours.</p>
            </div>
            <div className="p-5 bg-background rounded-lg border border-border">
              <h3 className="font-semibold text-foreground mb-2">Contextual, Not Memorized</h3>
              <p className="text-muted-foreground">AI output is generated contextually based on your input, not memorized from previous sessions or other users.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Closing Statement */}
      <section className="py-16 md:py-20 px-4 bg-[#1C3B23]">
        <div className="container mx-auto max-w-3xl text-center">
          <p className="text-xl md:text-2xl text-white leading-relaxed mb-4">
            AI should make safety easier — not less accountable.
          </p>
          <p className="text-lg text-white/80 leading-relaxed">
            That principle guides every decision we make.
          </p>
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
