import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SidebarState = {
  open: boolean;
  openMobile: boolean;
  activeItem?: string;
  isMobile: boolean;
};

export type SidebarActions = {
  setOpen: (open: boolean) => void;
  setOpenMobile: (open: boolean) => void;
  toggleSidebar: () => void;
  setActiveItem: (item: string) => void;
  setIsMobile: (isMobile: boolean) => void;
};

export type SidebarCookie = {
  state: boolean;
  activeItem?: string;
  version: 1;
};

export const useSidebarStore = create<SidebarState & SidebarActions>()(
  persist(
    (set, get) => ({
      open: true,
      openMobile: false,
      activeItem: undefined,
      isMobile: false,

      setOpen: (open) => {
        set({ open });
      },

      setOpenMobile: (openMobile) => set({ openMobile }),

      toggleSidebar: () => {
        const { isMobile, open, openMobile } = get();
        if (isMobile) {
          set({ openMobile: !openMobile });
        } else {
          const newOpen = !open;
          set({ open: newOpen });
        }
      },

      setActiveItem: (item) => {
        const state = get();
        const isTogglingOff = state.activeItem === item;
        const newActiveItem = isTogglingOff
          ? state.isMobile
            ? item
            : ""
          : item;
        let newOpen = state.open;
        let newOpenMobile = state.openMobile;

        if (isTogglingOff) {
          if (!state.isMobile) newOpen = false;
        } else if (!state.open) {
          if (state.isMobile) {
            newOpenMobile = true;
          } else {
            newOpen = true;
          }
        }

        set({
          activeItem: newActiveItem,
          open: newOpen,
          openMobile: newOpenMobile,
        });
      },

      setIsMobile: (isMobile) => set({ isMobile }),
    }),
    {
      name: "sidebar-store",
      partialize: (state) => ({
        open: state.open,
        activeItem: state.activeItem,
      }),
    },
  ),
);
