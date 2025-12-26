import { NavLink as RouterNavLink, NavLinkProps, useSearchParams } from "react-router-dom";
import { forwardRef, useMemo } from "react";
import { cn } from "@/lib/utils";

interface NavLinkCompatProps extends Omit<NavLinkProps, "className"> {
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
  preserveProjectId?: boolean;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName, to, preserveProjectId = true, ...props }, ref) => {
    const [searchParams] = useSearchParams();
    
    // Build the destination with projectId preserved
    const destination = useMemo(() => {
      if (!preserveProjectId) return to;
      
      const projectId = searchParams.get('projectId');
      if (!projectId) return to;
      
      // Handle string paths
      if (typeof to === 'string') {
        const hasQuery = to.includes('?');
        return hasQuery ? `${to}&projectId=${projectId}` : `${to}?projectId=${projectId}`;
      }
      
      // Handle object paths
      if (typeof to === 'object' && to !== null) {
        const existingSearch = to.search || '';
        const hasQuery = existingSearch.length > 0;
        const newSearch = hasQuery 
          ? `${existingSearch}&projectId=${projectId}` 
          : `?projectId=${projectId}`;
        return { ...to, search: newSearch };
      }
      
      return to;
    }, [to, searchParams, preserveProjectId]);

    return (
      <RouterNavLink
        ref={ref}
        to={destination}
        className={({ isActive, isPending }) =>
          cn(className, isActive && activeClassName, isPending && pendingClassName)
        }
        {...props}
      />
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
