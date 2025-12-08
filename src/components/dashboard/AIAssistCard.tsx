import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, Maximize2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface AIAssistCardProps {
  projectId: string | null;
  isLoading?: boolean;
}

const quickPrompts = [
  "What is most at risk this week",
  "Which tasks are blocking progress",
  "What should I focus on today",
];

export const AIAssistCard = ({ projectId, isLoading = false }: AIAssistCardProps) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAskAI = async (questionText: string) => {
    if (!questionText.trim() || !projectId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ask-ai", {
        body: {
          question: questionText,
          projectId,
        },
      });

      if (error) throw error;
      setResponse(data.answer || "No response received.");
    } catch (error) {
      console.error("Error asking AI:", error);
      setResponse("Sorry, I encountered an error processing your question.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="widget-card premium-card-dark h-full relative overflow-hidden">
      {/* Subtle grid background */}
      <div 
        className="absolute inset-0 opacity-5 pointer-events-none" 
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
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAskAI(query)}
            className="flex-1 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/40 h-10"
            disabled={loading || isLoading}
          />
          <Button
            onClick={() => handleAskAI(query)}
            disabled={loading || !query.trim()}
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
                setQuery(prompt);
                handleAskAI(prompt);
              }}
              className="bg-primary-foreground/5 border-primary-foreground/15 text-primary-foreground/80 hover:bg-accent hover:text-accent-foreground hover:border-accent text-xs h-8 px-3"
              disabled={loading}
            >
              {prompt}
            </Button>
          ))}
        </div>

        {/* Response area */}
        {response && (
          <div className="flex-1 min-h-0 overflow-auto rounded-lg bg-primary-foreground/5 border border-primary-foreground/10 p-3">
            <p className="text-sm text-primary-foreground/90 whitespace-pre-wrap leading-relaxed">
              {response}
            </p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-accent border-t-transparent" />
          </div>
        )}
      </div>
    </div>
  );
};