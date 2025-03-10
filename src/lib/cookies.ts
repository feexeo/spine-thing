import { SIDEBAR_COOKIE_NAME, SidebarCookie } from "@/components/ui/sidebar";

export const setCookie = (value: unknown, name: string, age: string) => {
  const encoded = btoa(JSON.stringify(value));
  document.cookie = `${name}=${encoded}; path=/; max-age=${age}; SameSite=Lax`;
};

const DEFAULT_SIDEBAR_COOKIE: SidebarCookie = {
  state: false,
  activeItem: undefined,
  version: 1,
};

export const getSidebarCookie = (): SidebarCookie => {
  try {
    const cookieValue = document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${SIDEBAR_COOKIE_NAME}=`))
      ?.split("=")[1];

    if (!cookieValue) {
      return DEFAULT_SIDEBAR_COOKIE;
    }

    const decodedValue = atob(cookieValue);
    const parsedCookie = JSON.parse(decodedValue) as Partial<SidebarCookie>;

    if (
      typeof parsedCookie.state === "boolean" &&
      (parsedCookie.activeItem === undefined ||
        typeof parsedCookie.activeItem === "string") &&
      typeof parsedCookie.version === "number"
    ) {
      return {
        state: parsedCookie.state,
        activeItem: parsedCookie.activeItem,
        version: parsedCookie.version,
      };
    }

    console.warn("Invalid sidebar cookie format. Resetting to default.");

    return DEFAULT_SIDEBAR_COOKIE;
  } catch (error) {
    console.error("Error parsing sidebar cookie:", error);
    return DEFAULT_SIDEBAR_COOKIE;
  }
};
