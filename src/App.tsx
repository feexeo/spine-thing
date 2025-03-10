import reactLogo from "./assets/react.svg";
import { AppSidebar } from "./components/ui/app-sidebar";
import { SidebarProvider } from "./components/ui/sidebar";
import { getSidebarCookie } from "./lib/cookies";
import viteLogo from "/vite.svg";

function App() {
  const { state, activeItem } = getSidebarCookie();
  return (
    <SidebarProvider defaultOpen={state} defaultActiveItem={activeItem}>
      <AppSidebar />
      <main className="flex size-full h-screen items-center justify-center bg-gray-950 text-white">
        <section className="flex flex-col items-center gap-6 rounded-2xl bg-gray-900 p-8 shadow-xl">
          <header className="flex items-center gap-6">
            <a
              href="https://vite.dev"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src={viteLogo}
                className="h-20 transition-transform duration-300 hover:scale-110"
                alt="Vite logo"
              />
            </a>
            <a
              href="https://react.dev"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src={reactLogo}
                className="h-20 transition-transform duration-300 hover:scale-110"
                alt="React logo"
              />
            </a>
          </header>
          <h1 className="text-5xl font-bold tracking-tight">Vite + React</h1>
        </section>
      </main>
    </SidebarProvider>
  );
}

export default App;
