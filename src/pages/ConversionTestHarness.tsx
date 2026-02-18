import { useState, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { CheckCircle, XCircle, AlertTriangle, Play, Trash2, Download, Loader2 } from 'lucide-react';

type StepStatus = 'PASS' | 'FAIL' | 'NEEDS_MANUAL' | 'PENDING' | 'RUNNING';

interface StepResult {
  id: string;
  name: string;
  status: StepStatus;
  expected: string;
  actual: string;
  evidence: string;
}

interface FixtureData {
  parent_client_id: string;
  project_id: string;
  quote_id: string;
  quote_number: string;
  notes: string;
}

const normalize = (s: string | null | undefined): string => (s ?? '').trim().replace(/\s+/g, ' ');

const statusIcon = (s: StepStatus) => {
  switch (s) {
    case 'PASS': return <CheckCircle className="h-5 w-5 text-primary" />;
    case 'FAIL': return <XCircle className="h-5 w-5 text-destructive" />;
    case 'NEEDS_MANUAL': return <AlertTriangle className="h-5 w-5 text-accent-foreground" />;
    case 'RUNNING': return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
    default: return <div className="h-5 w-5 rounded-full border-2 border-muted" />;
  }
};

const statusBadge = (s: StepStatus) => {
  const v = s === 'PASS' ? 'default' : s === 'FAIL' ? 'destructive' : 'secondary';
  return <Badge variant={v as any}>{s}</Badge>;
};

export default function ConversionTestHarness() {
  const { user } = useAuth();
  const { activeOrganizationId, orgRole } = useOrganization();
  const [fixture, setFixture] = useState<FixtureData | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepResult[]>([]);
  const [running, setRunning] = useState(false);

  const updateStep = useCallback((id: string, update: Partial<StepResult>) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...update } : s));
  }, []);

  const addStep = useCallback((step: StepResult) => {
    setSteps(prev => {
      const idx = prev.findIndex(s => s.id === step.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = step;
        return copy;
      }
      return [...prev, step];
    });
  }, []);

  // Step 1: Create fixture
  const createFixture = async (): Promise<FixtureData | null> => {
    const stepId = 'create_fixture';
    addStep({ id: stepId, name: 'Create Test Fixture', status: 'RUNNING', expected: 'Parent client + project + approved quote + 2 line items', actual: '', evidence: '' });

    if (!activeOrganizationId || !user) {
      updateStep(stepId, { status: 'NEEDS_MANUAL', actual: 'No org or user session', evidence: 'Log in and select an organization first.' });
      return null;
    }

    try {
      const { data, error } = await (supabase as any).rpc('rpc_create_conversion_test_fixture', { p_org_id: activeOrganizationId });
      if (error) throw error;
      const d = data as FixtureData;
      setFixture(d);
      updateStep(stepId, {
        status: 'PASS',
        actual: `Created: client=${d.parent_client_id}, project=${d.project_id}, quote=${d.quote_number}`,
        evidence: JSON.stringify(d, null, 2),
      });
      return d;
    } catch (e: any) {
      updateStep(stepId, { status: 'FAIL', actual: `Error: ${e.message}`, evidence: e.message });
      return null;
    }
  };

  // Step 2: Convert quote
  const convertQuote = async (quoteId: string): Promise<string | null> => {
    const stepId = 'convert_quote';
    addStep({ id: stepId, name: 'Convert Quote to Invoice', status: 'RUNNING', expected: 'RPC returns invoice_id, quote.converted_invoice_id set', actual: '', evidence: '' });

    try {
      const { data, error } = await supabase.rpc('convert_quote_to_invoice', { p_quote_id: quoteId, p_actor_id: user!.id });
      if (error) throw error;
      const invId = data as string;
      setInvoiceId(invId);

      // Verify quote.converted_invoice_id is set
      const { data: q } = await (supabase as any).from('quotes').select('converted_invoice_id').eq('id', quoteId).maybeSingle();
      const match = q?.converted_invoice_id === invId;

      updateStep(stepId, {
        status: match ? 'PASS' : 'FAIL',
        actual: match ? `invoice_id=${invId}, converted_invoice_id matches` : `Mismatch: rpc=${invId}, column=${q?.converted_invoice_id}`,
        evidence: JSON.stringify({ rpc_returned: invId, column_value: q?.converted_invoice_id }),
      });
      return invId;
    } catch (e: any) {
      updateStep(stepId, { status: 'FAIL', actual: `Error: ${e.message}`, evidence: e.message });
      return null;
    }
  };

  // Step 3: Idempotency test
  const testIdempotency = async (quoteId: string, expectedInvoiceId: string) => {
    const stepId = 'idempotency';
    addStep({ id: stepId, name: 'Idempotency (re-call conversion)', status: 'RUNNING', expected: 'RPC raises "already converted" or returns same ID', actual: '', evidence: '' });

    try {
      const { data, error } = await supabase.rpc('convert_quote_to_invoice', { p_quote_id: quoteId, p_actor_id: user!.id });

      if (error) {
        // RPC raises exception on already-converted -- this IS the expected idempotency guard
        const msg = (error.message || '').toLowerCase();
        const isAlreadyConverted = msg.includes('already converted');
        updateStep(stepId, {
          status: isAlreadyConverted ? 'PASS' : 'FAIL',
          actual: isAlreadyConverted ? 'RPC correctly rejected duplicate conversion' : `Unexpected error: ${error.message}`,
          evidence: `Error code: ${error.code}, message: ${error.message}`,
        });
        return;
      }

      // RPC succeeded -- check if it returned the same ID (alternative idempotency approach)
      if (data === expectedInvoiceId) {
        updateStep(stepId, { status: 'PASS', actual: `Same invoice_id returned: ${data}`, evidence: `Expected: ${expectedInvoiceId}, Got: ${data}` });
      } else {
        updateStep(stepId, { status: 'FAIL', actual: `DUPLICATE INVOICE CREATED: ${data}`, evidence: `Expected: ${expectedInvoiceId}, Got: ${data}. This is a P0 vulnerability.` });
      }
    } catch (e: any) {
      updateStep(stepId, { status: 'FAIL', actual: `Exception: ${e.message}`, evidence: e.message });
    }
  };

  // Step 4: Verify snapshot source integrity
  const verifySnapshots = async (quoteId: string, invoiceIdParam: string) => {
    const stepId = 'snapshot_integrity';
    addStep({ id: stepId, name: 'Snapshot Source Integrity', status: 'RUNNING', expected: 'bill_to from parent client, ship_to from project.location, send_to from AP email (not PM)', actual: '', evidence: '' });

    try {
      // Load quote with parent client + project
      const { data: quote } = await (supabase as any)
        .from('quotes')
        .select('id, parent_client_id, client_id, project_id, customer_pm_email, converted_invoice_id')
        .eq('id', quoteId)
        .maybeSingle();

      if (!quote) {
        updateStep(stepId, { status: 'FAIL', actual: 'Quote not found', evidence: `quote_id=${quoteId}` });
        return;
      }

      // Load parent client
      const clientId = quote.parent_client_id || quote.client_id;
      let parentClient: any = null;
      if (clientId) {
        const { data } = await (supabase as any).from('clients').select('name, billing_address, ap_email, email').eq('id', clientId).maybeSingle();
        parentClient = data;
      }

      // Load project
      let project: any = null;
      if (quote.project_id) {
        const { data } = await (supabase as any).from('projects').select('location').eq('id', quote.project_id).maybeSingle();
        project = data;
      }

      // Load invoice
      const { data: invoice } = await (supabase as any)
        .from('invoices')
        .select('bill_to_name, bill_to_address, ship_to_address, send_to_emails')
        .eq('id', invoiceIdParam)
        .maybeSingle();

      if (!invoice) {
        updateStep(stepId, {
          status: 'FAIL',
          actual: 'Invoice not found (missing OR not visible due to RLS)',
          evidence: `invoice_id=${invoiceIdParam}, user=${user?.id}, org=${activeOrganizationId}. Check RLS policies on invoices table.`,
        });
        return;
      }

      const issues: string[] = [];
      const evidence: Record<string, any> = { parentClient, project, invoice, pmEmail: quote.customer_pm_email };

      // bill_to check
      if (parentClient) {
        const expectedBillName = normalize(parentClient.name);
        const actualBillName = normalize(invoice.bill_to_name);
        if (expectedBillName && actualBillName && actualBillName !== expectedBillName) {
          issues.push(`bill_to_name mismatch: expected="${expectedBillName}", got="${actualBillName}"`);
        }
        const expectedBillAddr = normalize(parentClient.billing_address);
        const actualBillAddr = normalize(invoice.bill_to_address);
        if (expectedBillAddr && actualBillAddr && actualBillAddr !== expectedBillAddr) {
          issues.push(`bill_to_address mismatch: expected="${expectedBillAddr}", got="${actualBillAddr}"`);
        }
      }
      if (!invoice.bill_to_name && !invoice.bill_to_address) {
        issues.push('bill_to_name AND bill_to_address both empty on invoice');
      }

      // ship_to check
      if (project?.location) {
        const expectedShip = normalize(project.location);
        const actualShip = normalize(invoice.ship_to_address);
        if (expectedShip && actualShip && actualShip !== expectedShip) {
          issues.push(`ship_to_address mismatch: expected="${expectedShip}", got="${actualShip}"`);
        }
      }
      if (!invoice.ship_to_address) {
        issues.push('ship_to_address empty on invoice');
      }

      // send_to_emails check
      const sendTo = normalize(invoice.send_to_emails);
      if (!sendTo) {
        issues.push('send_to_emails empty on invoice');
      } else {
        // Must contain AP email
        const apEmail = parentClient?.ap_email || parentClient?.email;
        if (apEmail && !sendTo.toLowerCase().includes(apEmail.toLowerCase())) {
          issues.push(`send_to_emails does not contain AP email: expected "${apEmail}" in "${sendTo}"`);
        }
        // Must NOT contain PM email
        const pmEmail = quote.customer_pm_email;
        if (pmEmail && sendTo.toLowerCase().includes(pmEmail.toLowerCase())) {
          issues.push(`send_to_emails CONTAINS PM email "${pmEmail}" -- this is a regression`);
        }
      }

      updateStep(stepId, {
        status: issues.length === 0 ? 'PASS' : 'FAIL',
        actual: issues.length === 0 ? 'All snapshot fields match source data' : issues.join('; '),
        evidence: JSON.stringify(evidence, null, 2),
      });
    } catch (e: any) {
      updateStep(stepId, { status: 'FAIL', actual: `Error: ${e.message}`, evidence: e.message });
    }
  };

  // Run all steps
  const runAll = async () => {
    setRunning(true);
    setSteps([]);
    setFixture(null);
    setInvoiceId(null);

    const f = await createFixture();
    if (!f) { setRunning(false); return; }

    const invId = await convertQuote(f.quote_id);
    if (!invId) { setRunning(false); return; }

    await testIdempotency(f.quote_id, invId);
    await verifySnapshots(f.quote_id, invId);
    setRunning(false);
  };

  // Cleanup
  const cleanupTestData = async () => {
    const stepId = 'cleanup';
    addStep({ id: stepId, name: 'Clean Up Test Data', status: 'RUNNING', expected: 'All [TEST-CONV] records deleted', actual: '', evidence: '' });

    try {
      const deletions: string[] = [];

      // Delete line items for test quotes
      const { data: testQuotes } = await (supabase as any).from('quotes').select('id').like('bill_to_name', '%[TEST-CONV]%');
      const quoteIds = (testQuotes || []).map((q: any) => q.id);
      if (quoteIds.length > 0) {
        await (supabase as any).from('quote_line_items').delete().in('quote_id', quoteIds);
        deletions.push(`quote_line_items for ${quoteIds.length} quotes`);

        // Delete quote_events
        await (supabase as any).from('quote_events').delete().in('quote_id', quoteIds);
        deletions.push('quote_events');

        // Delete quote_conversions
        await (supabase as any).from('quote_conversions').delete().in('quote_id', quoteIds);
        deletions.push('quote_conversions');
      }

      // Delete test invoices (by name prefix)
      const { error: invErr } = await (supabase as any).from('invoices').delete().like('bill_to_name', '%[TEST-CONV]%');
      deletions.push(`invoices${invErr ? ` (error: ${invErr.message})` : ''}`);

      // Delete test quotes
      const { error: qErr } = await (supabase as any).from('quotes').delete().like('bill_to_name', '%[TEST-CONV]%');
      deletions.push(`quotes${qErr ? ` (error: ${qErr.message})` : ''}`);

      // Delete test projects
      const { error: pErr } = await (supabase as any).from('projects').delete().like('name', '%[TEST-CONV]%');
      deletions.push(`projects${pErr ? ` (error: ${pErr.message})` : ''}`);

      // Delete test clients
      const { error: cErr } = await (supabase as any).from('clients').delete().like('name', '%[TEST-CONV]%');
      deletions.push(`clients${cErr ? ` (error: ${cErr.message})` : ''}`);

      const anyErrors = [invErr, qErr, pErr, cErr].filter(Boolean);
      updateStep(stepId, {
        status: anyErrors.length === 0 ? 'PASS' : 'NEEDS_MANUAL',
        actual: anyErrors.length === 0 ? 'All test data cleaned up' : 'Some deletions blocked (likely RLS)',
        evidence: deletions.join('\n'),
      });

      setFixture(null);
      setInvoiceId(null);
    } catch (e: any) {
      updateStep(stepId, { status: 'FAIL', actual: `Error: ${e.message}`, evidence: 'Clean up as admin via backend SQL if needed.' });
    }
  };

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify({ ran_at: new Date().toISOString(), fixture, invoiceId, steps }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `conversion-test-${Date.now()}.json`;
    a.click();
  };

  const passCount = steps.filter(s => s.status === 'PASS').length;
  const failCount = steps.filter(s => s.status === 'FAIL').length;
  const manualCount = steps.filter(s => s.status === 'NEEDS_MANUAL').length;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Conversion Test Harness</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Deterministic Quote &rarr; Invoice conversion test with snapshot source integrity verification.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="text-sm space-y-1">
              <p><span className="font-medium">Organization:</span> {activeOrganizationId ?? 'None'} <span className="text-muted-foreground">({orgRole ?? 'unknown role'})</span></p>
              <p><span className="font-medium">User:</span> {user?.email ?? 'Not logged in'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={runAll} disabled={running || !activeOrganizationId}>
                {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                Run All Steps
              </Button>
              <Button variant="outline" onClick={() => createFixture()} disabled={running}>Create Fixture Only</Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={running}>
                    <Trash2 className="h-4 w-4 mr-2" /> Clean Up Test Data
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete all [TEST-CONV] records?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will delete all clients, projects, quotes, line items, and invoices with names containing [TEST-CONV]. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={cleanupTestData}>Delete Test Data</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              {steps.length > 0 && (
                <Button variant="ghost" size="sm" onClick={downloadJson}>
                  <Download className="h-4 w-4 mr-2" /> JSON
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {steps.length > 0 && (
          <>
            <div className="flex gap-3">
              <Badge variant="default">{passCount} PASS</Badge>
              <Badge variant="destructive">{failCount} FAIL</Badge>
              <Badge variant="secondary">{manualCount} MANUAL</Badge>
            </div>

            <Accordion type="multiple" className="space-y-2">
              {steps.map(step => (
                <AccordionItem key={step.id} value={step.id} className="border rounded-lg px-4">
                  <AccordionTrigger className="py-3 hover:no-underline">
                    <div className="flex items-center gap-3 text-left">
                      {statusIcon(step.status)}
                      <span className="font-medium">{step.name}</span>
                      {step.status !== 'PENDING' && step.status !== 'RUNNING' && statusBadge(step.status)}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-2 pb-4">
                    <div className="grid grid-cols-[100px_1fr] gap-1 text-sm">
                      <span className="font-medium text-muted-foreground">Expected:</span>
                      <span>{step.expected}</span>
                      <span className="font-medium text-muted-foreground">Actual:</span>
                      <span className={step.status === 'FAIL' ? 'text-destructive font-medium' : ''}>{step.actual}</span>
                    </div>
                    {step.evidence && (
                      <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-60 whitespace-pre-wrap">{step.evidence}</pre>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </>
        )}
      </div>
    </Layout>
  );
}
