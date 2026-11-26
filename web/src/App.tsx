import { lazy, Suspense } from "react";
import { Shell } from "./ui/Shell";
import { NotConnected, PageHeader } from "./ui/components";
import { useRoute } from "./lib/useRoute";
import { useTheme } from "./lib/useApp";
import { Home } from "./pages/Home";
import { NewLot } from "./pages/NewLot";
import { PlantExplorer } from "./pages/PlantExplorer";

// Development-only reference for the shared components; excluded from production builds.
const Preview = import.meta.env.DEV ? lazy(() => import("./preview/Foundation")) : null;

export function App() {
  const { route, hash, go } = useRoute();
  const { theme, toggle } = useTheme();
  const showPreview = Preview !== null && hash === "#/_foundation";
  return (
    <Shell route={route} onNavigate={go} theme={theme} onToggleTheme={toggle}>
      {showPreview && Preview ? (
        <Suspense fallback={null}><Preview /></Suspense>
      ) : route.key === "home" ? (
        <Home />
      ) : route.key === "new-lot" ? (
        <NewLot />
      ) : route.key === "plant-explorer" ? (
        <PlantExplorer />
      ) : (
        <>
          <PageHeader title={route.title} subtitle={route.subtitle} />
          <NotConnected title="This page is not built yet." />
        </>
      )}
    </Shell>
  );
}
