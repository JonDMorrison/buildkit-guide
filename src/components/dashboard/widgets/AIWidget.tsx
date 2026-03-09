import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, Maximize2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AIWidgetProps {
  projectId: string | null;
  contextData: {
    tasks: unknown[];
    blockers: unknown[];
    safetyForms: unknown[];
  };
}

const quickPrompts = [
  "What is most at risk this week",
  "Which tasks are blocking progress",
  "What should I focus on today",
];

export const AIWidget = ({ projectId, contextData }: AIWidgetProps) => {
  const navigate = useNavigate();
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const handleAskAI = async (questionText: string) => {
    if (!questionText.trim() || !projectId) return;

    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ask-ai", {
        body: {
          question: questionText,
          projectId,
        },
      });

      if (error) throw error;
      setAiResponse(data.answer || "No response received.");
    } catch (error: unknown) {
      console.error("Error asking AI:", error);
      setAiResponse("Sorry, I encountered an error processing your question.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="widget-card widget-card-dark h-full relative">
      {/* Subtle grid background */}
      <div 
        className="absolute inset-0 opacity-5 pointer-events-none rounded-xl overflow-hidden" 
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px'
        }}
      />
      
      {/* Content */}
      <div className="relative flex flex-col h-full gap-3 min-h-0">
        {/* Header */}
        <div 
          className="flex-shrink-0 flex items-start justify-between cursor-pointer group/header"
          onClick={() => navigate("/ai")}
        >
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2 text-primary-foreground">
              <Sparkles className="h-4 w-4 text-accent" />
              AI Assistant
            </h3>
            <p className="text-xs text-primary-foreground/60 mt-0.5">
              Ask about your project
            </p>
          </div>
          <Maximize2 className="h-4 w-4 text-primary-foreground/40 opacity-0 group-hover/header:opacity-100 transition-opacity" />
        </div>

        {/* Input */}
        <div className="flex gap-2 flex-shrink-0">
          <Input
            placeholder="Ask a question..."
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAskAI(aiQuery)}
            className="flex-1 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/40 h-10"
            disabled={aiLoading}
          />
          <Button
            onClick={() => handleAskAI(aiQuery)}
            disabled={aiLoading || !aiQuery.trim()}
            size="icon"
            className="bg-accent hover:bg-accent/90 text-accent-foreground h-10 w-10 flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {/* Quick prompts */}
        <div className="flex flex-wrap gap-2 flex-shrink-0">
          {quickPrompts.map((prompt) => (
            <Button
              key={prompt}
              variant="outline"
              size="sm"
              onClick={() => {
                setAiQuery(prompt);
                handleAskAI(prompt);
              }}
              className="bg-primary-foreground/5 border-primary-foreground/15 text-primary-foreground/80 hover:bg-accent hover:text-accent-foreground hover:border-accent text-xs h-8 px-3"
              disabled={aiLoading}
            >
              {prompt}
            </Button>
          ))}
        </div>

        {/* Response area */}
        {aiResponse && (
          <div className="flex-1 min-h-0 overflow-auto rounded-lg bg-primary-foreground/5 border border-primary-foreground/10 p-3">
            <p className="text-sm text-primary-foreground/90 whitespace-pre-wrap leading-relaxed">
              {aiResponse}
            </p>
          </div>
        )}

        {/* Loading */}
        {aiLoading && (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-accent border-t-transparent"></div>
          </div>
        )}
      </div>
    </div>
  );
};
