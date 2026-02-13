import { NavLink } from "./NavLink";
import { useNavigationTabs } from "@/hooks/useNavigationTabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";

export const AppSidebar = () => {
  const { visibleTabs, isLoading } = useNavigationTabs();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <SidebarMenuItem key={i}>
                      <SidebarMenuButton>
                        <Skeleton className="h-4 w-4 rounded" />
                        <Skeleton className="h-4 w-20 rounded" />
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))
                : visibleTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <SidebarMenuItem key={tab.path}>
                        <SidebarMenuButton asChild tooltip={tab.name}>
                          <NavLink
                            to={tab.path}
                            className="hover:bg-sidebar-accent/50"
                            activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          >
                            <Icon className="h-4 w-4" />
                            <span>{tab.name}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};
