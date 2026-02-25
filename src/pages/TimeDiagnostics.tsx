import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Play, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useOrganization } from '@/hooks/useOrganization';
import { useAuthRole } from '@/hooks/useAuthRole';
import { NoAccess } from '@/components/NoAccess';
import { supabase } from '@/integrations/supabase/client';

interface DiagnosticCheck {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: unknown;
  fix?: string;
}

interface DiagnosticResult {
  summary: {
    total: number;
    pass: number;
    fail: number;
    warn: number;
    overall: 'PASS' | 'FAIL' | 'WARN';
  };
  checks: DiagnosticCheck[];
  timestamp: string;
}

export default function TimeDiagnostics() {
  const { toast } = useToast();
  const { activeOrganization } = useOrganization();
  const { isAdmin, loading: roleLoading } = useAuthRole();
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);

  if (roleLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return (
      <Layout>
        <NoAccess title="Admin Access Required" message="Only administrators can access time tracking diagnostics." />
      </Layout>
    );
  }

  const runDiagnostics = async () => {
    if (!activeOrganization?.id) {
      toast({ title: 'Error', description: 'No organization selected', variant: 'destructive' });
      return;
    }

    setIsRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('time-diagnostics', {
        body: { organization_id: activeOrganization.id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResult(data);
      toast({ title: 'Diagnostics Complete', description: `Overall: ${data.summary.overall}` });
    } catch (error) {
      console.error('Diagnostics error:', error);
      toast({ 
        title: 'Diagnostics Failed', 
        description: error instanceof Error ? error.message : 'Unknown error', 
        variant: 'destructive' 
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: 'PASS' | 'FAIL' | 'WARN') => {
    switch (status) {
      case 'PASS':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'FAIL':
        return <XCircle className="h-5 w-5 text-destructive" />;
      case 'WARN':
        return <AlertTriangle className="h-5 w-5 text-amber-600" />;
    }
  };

  const getStatusBadge = (status: 'PASS' | 'FAIL' | 'WARN') => {
    const variants: Record<string, string> = {
      PASS: 'bg-green-500/10 text-green-600 border-green-500/20',
      FAIL: 'bg-destructive/10 text-destructive border-destructive/20',
      WARN: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    };
    return (
      <Badge variant="outline" className={variants[status]}>
        {status}
      </Badge>
    );
  };

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Time Tracking Diagnostics</h1>
            <p className="text-muted-foreground">Verify system configuration and health</p>
          </div>
          <Button onClick={runDiagnostics} disabled={isRunning || !activeOrganization}>
            {isRunning ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Running...</>
            ) : (
              <><Play className="h-4 w-4 mr-2" />Run Diagnostics</>
            )}
          </Button>
        </div>

        {!activeOrganization && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>No Organization</AlertTitle>
            <AlertDescription>Please select an organization to run diagnostics.</AlertDescription>
          </Alert>
        )}

        {result && (
          <>
            {/* Summary Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {getStatusIcon(result.summary.overall)}
                      Overall Status
                    </CardTitle>
                    <CardDescription>
                      Run at {new Date(result.timestamp).toLocaleString()}
                    </CardDescription>
                  </div>
                  {getStatusBadge(result.summary.overall)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold">{result.summary.total}</div>
                    <div className="text-sm text-muted-foreground">Total Checks</div>
                  </div>
                  <div className="p-3 rounded-lg bg-green-500/10">
                    <div className="text-2xl font-bold text-green-600">{result.summary.pass}</div>
                    <div className="text-sm text-muted-foreground">Passed</div>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-500/10">
                    <div className="text-2xl font-bold text-amber-600">{result.summary.warn}</div>
                    <div className="text-sm text-muted-foreground">Warnings</div>
                  </div>
                  <div className="p-3 rounded-lg bg-destructive/10">
                    <div className="text-2xl font-bold text-destructive">{result.summary.fail}</div>
                    <div className="text-sm text-muted-foreground">Failed</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Individual Checks */}
            <Card>
              <CardHeader>
                <CardTitle>Diagnostic Checks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.checks.map((check, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                  >
                    <div className="mt-0.5">{getStatusIcon(check.status)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{check.name}</span>
                        {getStatusBadge(check.status)}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{check.message}</p>
                      {check.details && (
                        <pre className="text-xs bg-muted/50 p-2 rounded mt-2 overflow-x-auto">
                          {JSON.stringify(check.details, null, 2)}
                        </pre>
                      )}
                      {check.fix && (
                        <div className="mt-2 p-2 bg-amber-500/5 border border-amber-500/20 rounded">
                          <p className="text-xs font-medium text-amber-700 mb-1">Suggested Fix:</p>
                          <code className="text-xs text-muted-foreground break-all">{check.fix}</code>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}

        {!result && !isRunning && activeOrganization && (
          <Card>
            <CardContent className="py-12 text-center">
              <RefreshCw className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Ready to Run</h3>
              <p className="text-muted-foreground mb-4">
                Click "Run Diagnostics" to verify time tracking configuration.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
