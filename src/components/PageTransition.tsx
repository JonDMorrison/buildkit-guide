import { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export const PageTransition = ({ children, className }: PageTransitionProps) => {
  return (
    <div className={`animate-fade-in ${className ?? ""}`}>
      {children}
    </div>
  );
};
