import { Home, LucideIcon, Settings } from "lucide-react";

import { cn } from "@/lib/utils";
import { useSidebar } from "@/hooks/use-sidebar";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type SideBarItem = {
  title: string;
  icon: LucideIcon;
  panel: React.ReactNode;
};
const items: SideBarItem[] = [
  {
    title: "Home",
    icon: Home,
    panel: <></>,
  },

  {
    title: "Settings",
    icon: Settings,
    panel: <></>,
  },
];

export function AppSidebar() {
  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarContent>
        <SidebarGroup className="flex-row p-0">
          <SidebarGroupContent className="w-12 p-2">
            <SidebarMenu className="w-12 items-start">
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarButton title={item.title} icon={item.icon} />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
          <SidebarItemContent />
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

const SidebarButton = ({ title, icon: LIcon }: Omit<SideBarItem, "panel">) => {
  const { setActiveItem, activeItem } = useSidebar();
  return (
    <SidebarMenuButton
      tooltip={title}
      onClick={() => setActiveItem(title)}
      className={cn(
        title === activeItem &&
          "bg-sidebar-accent text-sidebar-accent-foreground shadow-xs",
      )}
    >
      <LIcon />
    </SidebarMenuButton>
  );
};

const SidebarItemContent = () => {
  const { activeItem: title } = useSidebar();
  return (
    <SidebarGroupContent className="h-full min-h-screen flex-1 border-l">
      <div className="px-1">
        <div className="flex w-full items-center justify-center py-1 text-xs font-semibold tracking-wide uppercase">
          {title}
        </div>
        <div className="via-border mb-3 h-[1px] w-full bg-gradient-to-r from-transparent to-transparent"></div>
      </div>
    </SidebarGroupContent>
  );
};
