import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SmartSuggestionChipsProps {
  label?: string;
  items: Array<{ id: string; name: string }>;
  onSelect: (id: string) => void;
  className?: string;
}

export const SmartSuggestionChips = ({
  label = 'Recently used',
  items,
  onSelect,
  className,
}: SmartSuggestionChipsProps) => {
  if (items.length === 0) return null;

  return (
    <div className={cn('flex items-center gap-1.5 flex-wrap', className)}>
      <span className="text-xs text-muted-foreground">{label}:</span>
      {items.map((item) => (
        <Badge
          key={item.id}
          variant="outline"
          className="cursor-pointer text-xs px-2 py-0.5 hover:bg-accent active:scale-95 transition-all"
          onClick={() => onSelect(item.id)}
        >
          {item.name}
        </Badge>
      ))}
    </div>
  );
};

interface LocationSuggestionChipsProps {
  locations: string[];
  onSelect: (location: string) => void;
  className?: string;
}

export const LocationSuggestionChips = ({
  locations,
  onSelect,
  className,
}: LocationSuggestionChipsProps) => {
  if (locations.length === 0) return null;

  return (
    <div className={cn('flex items-center gap-1.5 flex-wrap', className)}>
      <span className="text-xs text-muted-foreground">Recent:</span>
      {locations.map((loc) => (
        <Badge
          key={loc}
          variant="outline"
          className="cursor-pointer text-xs px-2 py-0.5 hover:bg-accent active:scale-95 transition-all"
          onClick={() => onSelect(loc)}
        >
          {loc}
        </Badge>
      ))}
    </div>
  );
};
