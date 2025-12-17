import { useState, useEffect } from 'react';
import { differenceInSeconds } from 'date-fns';

interface ProgressRingTimerProps {
  checkInAt: string;
  targetHours?: number; // Default 8 hours
  size?: number;
  strokeWidth?: number;
}

export function ProgressRingTimer({ 
  checkInAt, 
  targetHours = 8, 
  size = 120, 
  strokeWidth = 8 
}: ProgressRingTimerProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const checkInTime = new Date(checkInAt);
    
    const updateElapsed = () => {
      const now = new Date();
      setElapsed(differenceInSeconds(now, checkInTime));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [checkInAt]);

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;

  const targetSeconds = targetHours * 3600;
  const progress = Math.min((elapsed / targetSeconds) * 100, 100);
  
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // Color transitions: green -> yellow -> orange -> red
  const getProgressColor = () => {
    if (progress < 50) return 'hsl(var(--primary))';
    if (progress < 75) return 'hsl(45, 93%, 47%)'; // Yellow
    if (progress < 100) return 'hsl(24, 95%, 53%)'; // Orange
    return 'hsl(0, 72%, 51%)'; // Red (overtime)
  };

  const formatTime = () => {
    if (hours > 0) {
      return (
        <>
          <span className="text-3xl font-bold tabular-nums">{hours}</span>
          <span className="text-lg text-muted-foreground">h </span>
          <span className="text-3xl font-bold tabular-nums">{minutes.toString().padStart(2, '0')}</span>
          <span className="text-lg text-muted-foreground">m</span>
        </>
      );
    }
    return (
      <>
        <span className="text-3xl font-bold tabular-nums">{minutes}</span>
        <span className="text-lg text-muted-foreground">m </span>
        <span className="text-3xl font-bold tabular-nums">{seconds.toString().padStart(2, '0')}</span>
        <span className="text-lg text-muted-foreground">s</span>
      </>
    );
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getProgressColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-300 ease-out"
        />
      </svg>
      
      {/* Center time display */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-center">
          {formatTime()}
        </div>
        {progress >= 100 && (
          <span className="text-xs text-destructive font-medium mt-1">
            +{Math.floor((elapsed - targetSeconds) / 60)}m OT
          </span>
        )}
      </div>
    </div>
  );
}
