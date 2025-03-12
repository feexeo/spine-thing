import { useCallback } from "react";

import { AppSidebar } from "./components/ui/app-sidebar";
import Loading from "./components/ui/loading";
import { SidebarTrigger } from "./components/ui/sidebar";
import { Toaster } from "./components/ui/sonner";
import useSpine from "./hooks/use-pixi-spine";
import { cn } from "./lib/utils";
import { useSpineStore } from "./store/spine-store";

function App() {
  const spine = useSpineStore((state) => state.spine);
  const isExporting = useSpineStore((state) => state.isLoading);
  const { setCanvaState, bindGestures, ...controls } = useSpine(spine);

  const setCanvasRef = useCallback(
    (node: HTMLCanvasElement | null) => {
      if (node) setCanvaState(node);
    },
    [setCanvaState],
  );

  return (
    <>
      <SidebarTrigger className="absolute top-0 left-0 p-8 md:hidden" />
      <AppSidebar {...controls} />
      <main className="h-screen w-screen">
        <canvas
          {...bindGestures()}
          ref={setCanvasRef}
          className={cn("size-full", isExporting ? "invisible" : "visible")}
          style={{ backgroundColor: "transparent" }}
        />
        {isExporting && (
          <Loading variant="dots" size="lg" message="Exporting" />
        )}
      </main>
      <Toaster />
    </>
  );
}

export default App;
