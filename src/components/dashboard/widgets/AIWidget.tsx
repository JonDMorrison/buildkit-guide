import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AIWidgetProps {
  projectId: string | null;
  contextData: {
    tasks: any[];
    blockers: any[];
    safetyForms: any[];
  };
}

const quickPrompts = [
  "What is most at risk this week",
  "Which tasks are blocking progress",
  "What should I focus on today",
];

export const AIWidget = ({ projectId, contextData }: AIWidgetProps) => {
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const handleAskAI = async (question: string) => {
    if (!question.trim() || !projectId) return;

    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ask-ai", {
        body: {
          query: question,
          projectId,
          context: {
            tasks: contextData.tasks.slice(0, 20),
            blockers: contextData.blockers.slice(0, 10),
            safetyForms: contextData.safetyForms.slice(0, 10),
          },
        },
      });

      if (error) throw error;
      setAiResponse(data.response);
    } catch (error) {
      console.error("Error asking AI:", error);
      setAiResponse("Sorry, I encountered an error processing your question.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <Card className="bg-primary text-primary-foreground shadow-lg border-none h-full flex flex-col overflow-hidden">
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px'
        }}
      />
      <CardHeader className="relative pb-2">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent" />
          AI Assistant
        </CardTitle>
        <CardDescription className="text-primary-foreground/70 text-sm">
          Ask about your project
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3 relative min-h-0 overflow-auto">
        <div className="flex gap-2">
          <Input
            placeholder="Ask a question..."
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAskAI(aiQuery)}
            className="flex-1 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50"
            disabled={aiLoading}
          />
          <Button
            onClick={() => handleAskAI(aiQuery)}
            disabled={aiLoading || !aiQuery.trim()}
            size="icon"
            className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-lg h-10 w-10 flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {quickPrompts.map((prompt) => (
            <Button
              key={prompt}
              variant="outline"
              size="sm"
              onClick={() => {
                setAiQuery(prompt);
                handleAskAI(prompt);
              }}
              className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-accent hover:text-accent-foreground text-xs h-8"
              disabled={aiLoading}
            >
              {prompt}
            </Button>
          ))}
        </div>

        {aiResponse && (
          <div className="p-3 rounded-lg bg-primary-foreground/10 border border-primary-foreground/20 flex-1 overflow-auto">
            <p className="text-sm text-primary-foreground whitespace-pre-wrap leading-relaxed">
              {aiResponse}
            </p>
          </div>
        )}

        {aiLoading && (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent"></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
