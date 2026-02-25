import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Eye, ExternalLink } from 'lucide-react';
import type { ActionBundle } from '@/lib/actionRouter';

interface ActionRowProps {
  bundle: ActionBundle;
}

export function ActionRow({ bundle }: ActionRowProps) {
  return (
    <div className="flex items-center gap-2 pt-3 mt-3 border-t border-border/40 flex-wrap">
      <span className="text-xs text-muted-foreground mr-auto truncate max-w-[50%]">
        {bundle.description}
      </span>
      <div className="flex items-center gap-1.5 shrink-0">
        {bundle.tertiary && (
          <Button variant="link" size="sm" className="h-7 text-[11px] px-2" asChild>
            <Link to={bundle.tertiary.to}>
              <ExternalLink className="h-3 w-3 mr-1" />
              {bundle.tertiary.label}
            </Link>
          </Button>
        )}
        {bundle.secondary && (
          <Button variant="ghost" size="sm" className="h-7 text-[11px] px-2" asChild>
            <Link to={bundle.secondary.to}>
              <Eye className="h-3 w-3 mr-1" />
              {bundle.secondary.label}
            </Link>
          </Button>
        )}
        <Button variant="outline" size="sm" className="h-7 text-[11px] px-3" asChild>
          <Link to={bundle.primary.to}>
            <ArrowRight className="h-3 w-3 mr-1" />
            {bundle.primary.label}
          </Link>
        </Button>
      </div>
    </div>
  );
}
