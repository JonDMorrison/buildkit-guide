import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { JobCostReport, LaborRow, MaterialRow } from '@/types/job-cost-report';

interface UseJobCostReportOptions {
  projectId: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
}

export const useJobCostReport = ({ projectId, startDate, endDate }: UseJobCostReportOptions) => {
  const [report, setReport] = useState<JobCostReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setReport(null);
      return;
    }

    const fetchReport = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch time entries (closed only) with user info
        let timeQuery = supabase
          .from('time_entries')
          .select('user_id, duration_hours, check_in_at')
          .eq('project_id', projectId)
          .eq('status', 'closed')
          .not('duration_hours', 'is', null);

        if (startDate) {
          timeQuery = timeQuery.gte('check_in_at', startDate.toISOString());
        }
        if (endDate) {
          timeQuery = timeQuery.lte('check_in_at', endDate.toISOString());
        }

        const [timeResult, membersResult, receiptsResult] = await Promise.all([
          timeQuery,
          supabase
            .from('project_members')
            .select('user_id, bill_rate, profiles(full_name, email)')
            .eq('project_id', projectId),
          (() => {
            let q = supabase
              .from('receipts')
              .select('id, amount, vendor, category, notes, created_at')
              .eq('project_id', projectId);
            if (startDate) q = q.gte('created_at', startDate.toISOString());
            if (endDate) q = q.lte('created_at', endDate.toISOString());
            return q.order('created_at', { ascending: false });
          })(),
        ]);

        if (timeResult.error) throw timeResult.error;
        if (membersResult.error) throw membersResult.error;
        if (receiptsResult.error) throw receiptsResult.error;

        // Build member lookup
        const memberMap = new Map<string, { name: string; billRate: number | null }>();
        for (const m of membersResult.data || []) {
          const profile = m.profiles as any;
          memberMap.set(m.user_id, {
            name: profile?.full_name || profile?.email || 'Unknown',
            billRate: m.bill_rate as number | null,
          });
        }

        // Aggregate labor by user
        const laborAgg = new Map<string, number>();
        for (const entry of timeResult.data || []) {
          const hours = Number(entry.duration_hours) || 0;
          laborAgg.set(entry.user_id, (laborAgg.get(entry.user_id) || 0) + hours);
        }

        const laborRows: LaborRow[] = [];
        let totalHours = 0;
        let totalLaborCost = 0;

        for (const [userId, hours] of laborAgg) {
          const member = memberMap.get(userId);
          const billRate = member?.billRate ?? null;
          const cost = billRate ? hours * billRate : 0;
          laborRows.push({
            userId,
            userName: member?.name || 'Unknown',
            hoursWorked: Math.round(hours * 100) / 100,
            billRate,
            totalCost: Math.round(cost * 100) / 100,
          });
          totalHours += hours;
          totalLaborCost += cost;
        }

        laborRows.sort((a, b) => a.userName.localeCompare(b.userName));

        // Materials
        const materialRows: MaterialRow[] = (receiptsResult.data || []).map((r) => ({
          id: r.id,
          date: r.created_at,
          vendor: r.vendor,
          category: r.category,
          amount: Number(r.amount) || 0,
          notes: r.notes,
        }));

        const totalMaterialsCost = materialRows.reduce((sum, r) => sum + r.amount, 0);

        setReport({
          labor: {
            rows: laborRows,
            totalHours: Math.round(totalHours * 100) / 100,
            totalCost: Math.round(totalLaborCost * 100) / 100,
          },
          materials: {
            rows: materialRows,
            totalCost: Math.round(totalMaterialsCost * 100) / 100,
          },
          grandTotal: Math.round((totalLaborCost + totalMaterialsCost) * 100) / 100,
        });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [projectId, startDate?.getTime(), endDate?.getTime()]);

  return { report, loading, error };
};
