import { useEffect, useState } from 'react';
import { Check, LogIn, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CheckInSuccessAnimationProps {
  type: 'check_in' | 'check_out';
  show: boolean;
  onComplete?: () => void;
  duration?: number;
}

export function CheckInSuccessAnimation({
  type,
  show,
  onComplete,
  duration = 1500,
}: CheckInSuccessAnimationProps) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      setAnimating(true);
      
      // Trigger haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(type === 'check_in' ? [50, 30, 50] : [100]);
      }

      const timer = setTimeout(() => {
        setAnimating(false);
        setTimeout(() => {
          setVisible(false);
          onComplete?.();
        }, 300);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [show, duration, onComplete, type]);

  if (!visible) return null;

  const isCheckIn = type === 'check_in';
  const Icon = isCheckIn ? LogIn : LogOut;

  return (
    <div 
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center pointer-events-none",
        animating ? "animate-fade-in" : "animate-fade-out"
      )}
    >
      {/* Backdrop */}
      <div 
        className={cn(
          "absolute inset-0 transition-opacity duration-300",
          isCheckIn ? "bg-primary/20" : "bg-destructive/20",
          animating ? "opacity-100" : "opacity-0"
        )} 
      />
      
      {/* Success circle */}
      <div className="relative">
        {/* Burst rings */}
        <div 
          className={cn(
            "absolute inset-0 rounded-full border-4 transition-all duration-500",
            isCheckIn ? "border-primary" : "border-destructive",
            animating ? "scale-150 opacity-0" : "scale-100 opacity-100"
          )}
          style={{ 
            width: 120, 
            height: 120, 
            marginLeft: -60, 
            marginTop: -60,
            left: '50%',
            top: '50%',
          }}
        />
        <div 
          className={cn(
            "absolute inset-0 rounded-full border-2 transition-all duration-700 delay-100",
            isCheckIn ? "border-primary/50" : "border-destructive/50",
            animating ? "scale-[2] opacity-0" : "scale-100 opacity-50"
          )}
          style={{ 
            width: 120, 
            height: 120, 
            marginLeft: -60, 
            marginTop: -60,
            left: '50%',
            top: '50%',
          }}
        />
        
        {/* Main circle */}
        <div 
          className={cn(
            "relative flex items-center justify-center rounded-full shadow-2xl transition-transform duration-300",
            isCheckIn ? "bg-primary" : "bg-destructive",
            animating ? "scale-100" : "scale-90"
          )}
          style={{ width: 120, height: 120 }}
        >
          {/* Checkmark animation */}
          <div className={cn(
            "transition-all duration-300 delay-200",
            animating ? "scale-100 opacity-100" : "scale-50 opacity-0"
          )}>
            <Check className="h-16 w-16 text-primary-foreground stroke-[3]" />
          </div>
        </div>

        {/* Label */}
        <div 
          className={cn(
            "absolute -bottom-16 left-1/2 -translate-x-1/2 whitespace-nowrap transition-all duration-300 delay-300",
            animating ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
          )}
        >
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Icon className={cn(
              "h-5 w-5",
              isCheckIn ? "text-primary" : "text-destructive"
            )} />
            <span className={isCheckIn ? "text-primary" : "text-destructive"}>
              {isCheckIn ? "Checked In!" : "Checked Out!"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
