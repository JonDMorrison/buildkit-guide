import { HelpCircle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface SectionHelpProps {
  text: string;
}

/**
 * A small `?` icon that shows a plain-English popover
 * explaining what a dashboard section or card does.
 * Triggered on click for better mobile support.
 */
export function SectionHelp({ text }: SectionHelpProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full p-0.5 text-muted-foreground/60 hover:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label="Section help"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="max-w-xs text-xs leading-relaxed p-3">
        {text}
      </PopoverContent>
    </Popover>
  );
}
