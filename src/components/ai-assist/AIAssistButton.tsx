import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AIAssistButtonProps {
  onClick: () => void;
  hasNotification?: boolean;
  className?: string;
}

export const AIAssistButton = ({ onClick, hasNotification, className }: AIAssistButtonProps) => {
  return (
    <Button
      onClick={onClick}
      size="icon"
      className={cn(
        "fixed z-50 h-14 w-14 rounded-full shadow-lg",
        "bg-accent hover:bg-accent/90 text-accent-foreground",
        "transition-all duration-300 hover:scale-105",
        "animate-pulse hover:animate-none",
        // Desktop: bottom right
        "bottom-6 right-6",
        // Mobile: centered above tab bar
        "md:bottom-6 md:right-6",
        "max-md:bottom-[calc(var(--tab-bar-height)+16px)] max-md:left-1/2 max-md:-translate-x-1/2 max-md:right-auto",
        className
      )}
      aria-label="Open AI Assist"
    >
      <Sparkles className="h-6 w-6" />
      
      {/* Notification badge */}
      {hasNotification && (
        <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive flex items-center justify-center">
          <span className="h-2 w-2 rounded-full bg-destructive-foreground animate-ping" />
        </span>
      )}
    </Button>
  );
};
