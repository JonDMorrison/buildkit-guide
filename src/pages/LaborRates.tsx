import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/hooks/useOrganization";
import { useOrganizationRole } from "@/hooks/useOrganizationRole";
import { NoAccess } from "@/components/NoAccess";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Save, DollarSign } from "lucide-react";

interface MemberRate {
  membership_id: string;
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  hourly_cost_rate: number | null;
  hourly_bill_rate: number | null;
  rates_currency: string;
  dirty: boolean;
}

export default function LaborRates() {
  const { activeOrganizationId } = useOrganization();
  const { role: orgRole, isLoading: roleLoading } = useOrganizationRole();
  const { toast } = useToast();
  const [members, setMembers] = useState<MemberRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isAdmin = orgRole === "admin" || orgRole === "hr";

  useEffect(() => {
    if (!activeOrganizationId) return;
    const fetch = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("organization_memberships")
        .select("id, user_id, role, is_active, hourly_cost_rate, hourly_bill_rate, rates_currency, profiles(full_name, email)")
        .eq("organization_id", activeOrganizationId)
        .eq("is_active", true)
        .order("role");
      if (error) {
        toast({ title: "Failed to load members", variant: "destructive" });
        setLoading(false);
        return;
      }
      setMembers(
        (data || []).map((m: any) => ({
          membership_id: m.id,
          user_id: m.user_id,
          full_name: m.profiles?.full_name || m.profiles?.email || "Unknown",
          email: m.profiles?.email || "",
          role: m.role,
          hourly_cost_rate: m.hourly_cost_rate,
          hourly_bill_rate: m.hourly_bill_rate,
          rates_currency: m.rates_currency || "CAD",
          dirty: false,
        }))
      );
      setLoading(false);
    };
    fetch();
  }, [activeOrganizationId, toast]);

  if (roleLoading) {
    return (
      <Layout>
        <div className="container max-w-4xl mx-auto px-4 py-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64" />
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return (
      <Layout>
        <NoAccess />
      </Layout>
    );
  }

  const updateRate = (idx: number, field: "hourly_cost_rate" | "hourly_bill_rate", value: string) => {
    setMembers((prev) =>
      prev.map((m, i) =>
        i === idx
          ? { ...m, [field]: value === "" ? null : parseFloat(value), dirty: true }
          : m
      )
    );
  };

  const dirtyMembers = members.filter((m) => m.dirty);
  const missingRateCount = members.filter(
    (m) => m.hourly_cost_rate == null && ["foreman", "internal_worker", "external_trade"].includes(m.role)
  ).length;

  const handleSave = async () => {
    if (!dirtyMembers.length) return;
    setSaving(true);
    let errorCount = 0;
    for (const m of dirtyMembers) {
      const { error } = await supabase
        .from("organization_memberships")
        .update({
          hourly_cost_rate: m.hourly_cost_rate,
          hourly_bill_rate: m.hourly_bill_rate,
        } as any)
        .eq("id", m.membership_id);
      if (error) errorCount++;
    }
    if (errorCount) {
      toast({ title: `${errorCount} rate(s) failed to save`, variant: "destructive" });
    } else {
      toast({ title: "Labor rates saved" });
      setMembers((prev) => prev.map((m) => ({ ...m, dirty: false })));
    }
    setSaving(false);
  };

  const roleLabel = (r: string) => {
    const map: Record<string, string> = {
      admin: "Admin",
      hr: "HR",
      pm: "PM",
      foreman: "Foreman",
      internal_worker: "Worker",
      external_trade: "Trade",
    };
    return map[r] || r;
  };

  return (
    <Layout>
      <div className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-primary" />
              Labor Rates
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Set default hourly cost and bill rates for your team. These are used when project-level rates aren't set.
            </p>
          </div>
          {dirtyMembers.length > 0 && (
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : `Save ${dirtyMembers.length} Change${dirtyMembers.length > 1 ? "s" : ""}`}
            </Button>
          )}
        </div>

        {missingRateCount > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Missing Cost Rates</AlertTitle>
            <AlertDescription>
              {missingRateCount} field member{missingRateCount > 1 ? "s" : ""} ha{missingRateCount > 1 ? "ve" : "s"} no hourly cost rate set. Job costing will be incomplete for their time entries.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Organization Members</CardTitle>
            <CardDescription>
              Cost Rate is used for job costing. Bill Rate is used for invoicing calculations. Project-level rates override these defaults.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Cost Rate ($/hr)</TableHead>
                    <TableHead className="text-right">Bill Rate ($/hr)</TableHead>
                    <TableHead className="text-right">Currency</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m, idx) => (
                    <TableRow key={m.membership_id} className={m.dirty ? "bg-primary/5" : ""}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{m.full_name}</p>
                          <p className="text-xs text-muted-foreground">{m.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{roleLabel(m.role)}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={m.hourly_cost_rate ?? ""}
                          onChange={(e) => updateRate(idx, "hourly_cost_rate", e.target.value)}
                          className="w-24 ml-auto text-right"
                          placeholder="—"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={m.hourly_bill_rate ?? ""}
                          onChange={(e) => updateRate(idx, "hourly_bill_rate", e.target.value)}
                          className="w-24 ml-auto text-right"
                          placeholder="—"
                        />
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {m.rates_currency}
                      </TableCell>
                    </TableRow>
                  ))}
                  {members.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No active members found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
