import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Send, FileText, AlertCircle, CheckSquare, Shield, Upload, Info } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAuthRole } from "@/hooks/useAuthRole";
import { DocumentUpload } from "@/components/documents/DocumentUpload";

interface Project {
  id: string;
  name: string;
}

interface Source {
  id: string;
  title?: string;
  reason?: string;
}

interface Sources {
  documents: Source[];
  tasks: Source[];
  blockers: Source[];
  deficiencies: Source[];
  safetyForms: Source[];
}

const AI = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Sources | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { isWorker } = useAuthRole(selectedProjectId || undefined);

  const suggestedQuestions = [
    "Where are the inspection requirements for this project?",
    "What is Horizon waiting on from electrical?",
    "What safety incidents happened this week?",
    "What tasks are blocked right now?",
    "Show me all open deficiencies"
  ];

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name')
      .eq('is_deleted', false)
      .order('name');

    if (error) {
      console.error('Error fetching projects:', error);
      toast.error('Failed to load projects');
    } else {
      setProjects(data || []);
      if (data && data.length > 0 && !selectedProjectId) {
        setSelectedProjectId(data[0].id);
      }
    }
  };

  const handleAsk = async () => {
    if (!question.trim()) {
      toast.error('Please enter a question');
      return;
    }

    if (!selectedProjectId) {
      toast.error('Please select a project');
      return;
    }

    setIsLoading(true);
    setAnswer("");
    setSources(null);

    try {
      const { data, error } = await supabase.functions.invoke('ask-ai', {
        body: {
          question: question.trim(),
          projectId: selectedProjectId
        }
      });

      if (error) throw error;

      setAnswer(data.answer);
      setSources(data.sources);
    } catch (error) {
      console.error('Error asking AI:', error);
      toast.error('Failed to get answer. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestedQuestion = (q: string) => {
    setQuestion(q);
  };

  return (
    <Layout>
      <div className="container max-w-4xl mx-auto px-4 py-6 space-y-6 pb-20">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Assistant</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Upload documents and ask questions about your project
            </p>
          </div>
          
          {/* Project Selector */}
          <Card className="p-4">
            <label className="text-sm font-medium text-foreground mb-2 block">
              Select Project
            </label>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a project..." />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>

          {/* Tabs for Q&A and Upload */}
          <Tabs defaultValue="qa" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="qa">Ask Questions</TabsTrigger>
              <TabsTrigger value="upload">Upload Documents</TabsTrigger>
            </TabsList>

            <TabsContent value="qa" className="space-y-4 mt-4">
              
              {/* Worker Scope Notice */}
              {isWorker && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Your AI answers are based only on tasks assigned to you and related documents.
                  </AlertDescription>
                </Alert>
              )}

              {/* Suggested Questions */}
              <Card className="p-4">
                <p className="text-sm font-medium text-foreground mb-3">Suggested questions:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestedQuestions.map((q, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      onClick={() => handleSuggestedQuestion(q)}
                      disabled={isLoading}
                      className="text-xs"
                    >
                      {q}
                    </Button>
                  ))}
                </div>
              </Card>

              {/* Question Input */}
              <Card className="p-4">
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Your Question
                </label>
                <Textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask about tasks, blockers, safety forms, documents, or deficiencies..."
                  rows={3}
                  disabled={isLoading}
                  className="mb-3"
                />
                <Button
                  onClick={handleAsk}
                  disabled={isLoading || !question.trim() || !selectedProjectId}
                  className="w-full"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Thinking...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-5 w-5" />
                      Ask AI
                    </>
                  )}
                </Button>
              </Card>

              {/* Answer */}
              {answer && (
                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-foreground mb-3">Answer</h3>
                  <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">
                    {answer}
                  </div>
                </Card>
              )}

              {/* Sources */}
              {sources && (
                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Sources</h3>
                  <div className="space-y-4">
                    {sources.documents.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm font-medium text-foreground">Documents</p>
                        </div>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-6">
                          {sources.documents.map((doc) => (
                            <li key={doc.id}>{doc.title}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {sources.tasks.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <CheckSquare className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm font-medium text-foreground">Tasks</p>
                        </div>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-6">
                          {sources.tasks.map((task) => (
                            <li key={task.id}>{task.title}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {sources.blockers.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm font-medium text-foreground">Blockers</p>
                        </div>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-6">
                          {sources.blockers.map((blocker) => (
                            <li key={blocker.id}>{blocker.reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {sources.deficiencies.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm font-medium text-foreground">Deficiencies</p>
                        </div>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-6">
                          {sources.deficiencies.map((def) => (
                            <li key={def.id}>{def.title}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {sources.safetyForms.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Shield className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm font-medium text-foreground">Safety Forms</p>
                        </div>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-6">
                          {sources.safetyForms.map((form) => (
                            <li key={form.id}>{form.title}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="upload" className="space-y-4 mt-4">
              {selectedProjectId ? (
                <DocumentUpload 
                  projectId={selectedProjectId}
                  onUploadComplete={() => {
                    toast.success("Document processed and ready for AI Q&A");
                  }}
                />
              ) : (
                <Card className="p-8 text-center">
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">Please select a project first to upload documents.</p>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
};

export default AI;
