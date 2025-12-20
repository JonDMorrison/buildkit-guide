import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Loader2, AlertTriangle, CheckCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface BackfillResult {
  total_scanned: number;
  total_updated: number;
  total_failed: number;
  dry_run: boolean;
  sample_updates: Array<{ id: string; hash_prefix: string }>;
  errors: Array<{ id: string; error: string }>;
}

export const BackfillHashesButton = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BackfillResult | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const { toast } = useToast();

  const runBackfill = async (dryRun: boolean) => {
    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("backfill-safety-hashes", {
        body: {
          dry_run: dryRun,
          limit: 200,
        },
      });

      if (error) throw error;

      setResult(data);
      
      if (dryRun) {
        toast({
          title: "Dry Run Complete",
          description: `Found ${data.total_scanned} forms to backfill`,
        });
      } else {
        toast({
          title: "Backfill Complete",
          description: `Updated ${data.total_updated} forms, ${data.total_failed} failed`,
        });
      }
    } catch (err: any) {
      console.error("Backfill error:", err);
      toast({
        title: "Backfill Failed",
        description: err.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDryRun = () => runBackfill(true);
  
  const handleLiveRun = () => {
    setShowConfirm(true);
  };

  const confirmLiveRun = () => {
    setShowConfirm(false);
    runBackfill(false);
  };

  return (
    <>
      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Backfill Missing Record Hashes</h3>
        </div>
        
        <p className="text-sm text-muted-foreground">
          Generate tamper-evidence hashes for historical safety forms that were created before hash generation was added.
          This only updates the <code className="text-xs bg-muted px-1 rounded">record_hash</code> field - no other data is modified.
        </p>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleDryRun}
            disabled={loading}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Preview (Dry Run)
          </Button>
          
          <Button
            variant="default"
            onClick={handleLiveRun}
            disabled={loading || (result?.dry_run === true && result.total_scanned === 0)}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Run Backfill
          </Button>
        </div>

        {/* Results */}
        {result && (
          <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
            <div className="flex items-center gap-2">
              {result.dry_run ? (
                <Badge variant="outline">Dry Run</Badge>
              ) : (
                <Badge className="bg-green-600">Live</Badge>
              )}
              <span className="text-sm font-medium">
                Scanned: {result.total_scanned} | 
                {result.dry_run ? " Would update" : " Updated"}: {result.total_updated} | 
                Failed: {result.total_failed}
              </span>
            </div>

            {result.total_scanned === 0 && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">All forms already have record hashes!</span>
              </div>
            )}

            {result.sample_updates.length > 0 && (
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Sample {result.dry_run ? "to be updated" : "updates"} (first 10):
                </span>
                <div className="grid grid-cols-1 gap-1 text-xs font-mono">
                  {result.sample_updates.map((s) => (
                    <div key={s.id} className="flex justify-between bg-background p-1 rounded">
                      <span className="text-muted-foreground">{s.id.substring(0, 8)}...</span>
                      <span>{s.hash_prefix}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.errors.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-xs font-medium">Errors:</span>
                </div>
                <div className="text-xs text-destructive">
                  {result.errors.slice(0, 5).map((e) => (
                    <div key={e.id}>{e.id.substring(0, 8)}: {e.error}</div>
                  ))}
                  {result.errors.length > 5 && (
                    <div>...and {result.errors.length - 5} more</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Live Backfill</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently update up to 200 safety forms with computed record hashes.
              Only the <code className="text-xs bg-muted px-1 rounded">record_hash</code> field will be modified.
              <br /><br />
              This action is safe but irreversible. Proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLiveRun}>
              Run Backfill
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
