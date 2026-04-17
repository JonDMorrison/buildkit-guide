import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Printer, Check, HardHat } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';

interface PPERequirementsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

// Trade-specific PPE additions
const TRADE_PPE: Record<string, { label: string; items: string[] }> = {
  electrical: {
    label: 'Electrical',
    items: ['Arc flash PPE (face shield + flash suit)', 'Rubber insulating gloves (voltage-rated)'],
  },
  concrete: {
    label: 'Concrete',
    items: ['Respirator (N95 minimum)', 'Knee pads'],
  },
  roofing: {
    label: 'Roofing',
    items: ['Fall arrest harness + lanyard', 'Non-slip footwear'],
  },
  framing: {
    label: 'Framing / Carpentry',
    items: ['Fall arrest above 3 m / 10 ft', 'Hearing protection (ear plugs or muffs)'],
  },
  excavation: {
    label: 'Excavation',
    items: ['Class 3 high-visibility vest', 'Spotter protocol in place'],
  },
  welding: {
    label: 'Welding',
    items: ['Welding face shield (auto-darkening)', 'Leather apron', 'Respirator (fume-rated)'],
  },
};

function getOHSLink(code: string): string {
  switch (code) {
    case 'BC': return 'https://www.worksafebc.com';
    case 'AB': return 'https://www.alberta.ca/ohs-legislation';
    case 'ON': return 'https://www.ontario.ca/page/ministry-labour-immigration-training-skills-development';
    default:   return 'https://www.osha.gov/workers';
  }
}

export function PPERequirementsDialog({
  open,
  onOpenChange,
  onConfirm,
}: PPERequirementsDialogProps) {
  const { activeOrganizationId } = useOrganization();
  const [jurisdiction, setJurisdiction] = useState('');
  const [expandedTrade, setExpandedTrade] = useState<string | null>(null);

  useEffect(() => {
    if (!activeOrganizationId || !open) return;
    supabase
      .from('organization_settings')
      .select('jurisdiction_code')
      .eq('organization_id', activeOrganizationId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.jurisdiction_code) setJurisdiction(data.jurisdiction_code);
      });
  }, [activeOrganizationId, open]);

  const ohsLink = getOHSLink(jurisdiction);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <HardHat className="h-5 w-5" />
            PPE Requirements for Your Team
          </DialogTitle>
          <DialogDescription>
            Review the baseline and trade-specific requirements below, then confirm.
          </DialogDescription>
        </DialogHeader>

        {/* Section 1 — Universal baseline */}
        <div className="space-y-3 mt-2">
          <h3 className="text-sm font-semibold text-foreground">Required on every site</h3>
          <ul className="space-y-2">
            {[
              'Hard hat (CSA certified in Canada, ANSI Z89.1 in the US)',
              'High-visibility vest (Class 2 minimum)',
              'Steel-toed safety footwear (CSA Grade 1 in Canada, ASTM F2413 in the US)',
              'Safety glasses or goggles',
              'Work gloves appropriate to the task',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Section 2 — Trade-specific additions */}
        <div className="space-y-3 mt-6">
          <h3 className="text-sm font-semibold text-foreground">Common trade additions</h3>
          <p className="text-xs text-muted-foreground">Click a trade to see additional PPE.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(TRADE_PPE).map(([key, trade]) => (
              <div key={key}>
                <Badge
                  variant={expandedTrade === key ? 'default' : 'outline'}
                  className="w-full justify-center cursor-pointer py-1.5 text-xs"
                  onClick={() =>
                    setExpandedTrade(expandedTrade === key ? null : key)
                  }
                >
                  {trade.label}
                </Badge>
                {expandedTrade === key && (
                  <ul className="mt-2 space-y-1 pl-1 animate-in fade-in-0 slide-in-from-top-1 duration-150">
                    {trade.items.map((item) => (
                      <li
                        key={item}
                        className="text-xs text-muted-foreground flex items-start gap-1.5"
                      >
                        <span className="text-muted-foreground/50 mt-0.5 shrink-0">
                          &bull;
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Section 3 — Jurisdiction note */}
        <div className="mt-6 rounded-lg bg-muted/50 border border-border/50 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Requirements vary by province and state. Verify with your local
            OH&amp;S authority before site work.
          </p>
          <a
            href={ohsLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1.5"
          >
            Find your local authority
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3 mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
          >
            <Printer className="h-3.5 w-3.5 mr-1.5" />
            Save as PDF
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            <Check className="h-3.5 w-3.5 mr-1.5" />
            Got it — requirements reviewed
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
