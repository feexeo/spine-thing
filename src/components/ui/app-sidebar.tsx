import React from "react";
import { useSidebarStore } from "@/store/sidebar-store";
import { Home, LucideIcon, Settings } from "lucide-react";

import { cn } from "@/lib/utils";
import { UseSpine } from "@/hooks/use-pixi-spine";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";

import { SpineFileUploader } from "./sidebar-home";
import SpineControlPanel from "./sidebar-settings";

export type SpineControls = Pick<
  UseSpine,
  | "animationList"
  | "exportToGif"
  | "exportToVideo"
  | "toggleDebugMode"
  | "isExporting"
  | "setDefaultPositionAndScale"
  | "takeScreenshot"
  | "playAnimation"
>;

type SideBarItem = {
  title: string;
  icon: LucideIcon;
  panel: React.FC<SpineControls>;
};
const items: SideBarItem[] = [
  {
    title: "Home",
    icon: Home,
    panel: SpineFileUploader,
  },

  {
    title: "Settings",
    icon: Settings,
    panel: SpineControlPanel,
  },
];

export const AppSidebar: React.FC<SpineControls> = (controls) => {
  return (
    <SidebarProvider>
      <Sidebar variant="sidebar" collapsible="icon">
        <SidebarContent>
          <SidebarGroup className="flex-row overflow-hidden p-0">
            <SidebarGroupContent className="w-12 p-2">
              <SidebarMenu className="w-12 items-start">
                {items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarButton title={item.title} icon={item.icon} />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
            <SidebarItemContent {...controls} />
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  );
};

const SidebarButton = ({ title, icon: LIcon }: Omit<SideBarItem, "panel">) => {
  const { setActiveItem, activeItem } = useSidebarStore();
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

const SidebarItemContent: React.FC<SpineControls> = (controls) => {
  const { activeItem: title } = useSidebarStore();
  const item = items.find((item) => item.title === title);

  return (
    <SidebarGroupContent className="h-full flex-1 border-l">
      <div className="flex h-full flex-col">
        <div className="px-1">
          <div className="flex w-full items-center justify-center py-1 text-xs font-semibold tracking-wide uppercase">
            {title}
          </div>
          <div className="via-border mb-2 h-[1px] w-full bg-gradient-to-r from-transparent to-transparent" />
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="h-full p-1">
            {item ? (
              <div className="h-full overflow-hidden">
                <item.panel {...controls} />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </SidebarGroupContent>
  );
};
