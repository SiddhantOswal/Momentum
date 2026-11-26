import { lazy, Suspense } from "react";
import { Shell } from "./ui/Shell";
import { NotConnected, PageHeader } from "./ui/components";
import { useRoute } from "./lib/useRoute";
import { useTheme } from "./lib/useApp";
import { Home } from "./pages/Home";
import { NewLot } from "./pages/NewLot";
import { PlantExplorer } from "./pages/PlantExplorer";
import { Insights } from "./pages/Insights";
import { PhotoDiagnosis } from "./pages/PhotoDiagnosis";
import { Planning } from "./pages/Planning";
import { PreparationFlow } from "./pages/prep-flow/PreparationFlow";

// Development-only reference for the shared components; excluded from production builds.
const Preview = import.meta.env.DEV ? lazy(() => import("./preview/Foundation")) : null;

const PrepFlowPreview = import.meta.env.DEV ? lazy(() => import("./preview/PrepFlow")) : null;

export function App() {
  const { route, hash, go } = useRoute();
  const { theme, toggle } = useTheme();
  const showPreview = Preview !== null && hash === "#/_foundation";
  const showPrepFlow = PrepFlowPreview !== null && hash.startsWith("#/_prep-flow");
  return (
    <Shell route={route} onNavigate={go} theme={theme} onToggleTheme={toggle}>
      {showPreview && Preview ? (
        <Suspense fallback={null}><Preview /></Suspense>
      ) : showPrepFlow && PrepFlowPreview ? (
        <Suspense fallback={null}><PrepFlowPreview /></Suspense>
      ) : route.key === "home" ? (
        <Home />
      ) : route.key === "new-lot" ? (
        <NewLot />
      ) : route.key === "plant-explorer" ? (
        <PlantExplorer />
      ) : route.key === "preparation-flow" ? (
        <PreparationFlow />
      ) : route.key === "insights" ? (
        <Insights />
      ) : route.key === "photo-diagnosis" ? (
        <PhotoDiagnosis />
      ) : route.key === "planning" ? (
        <Planning />
      ) : (
        <>
          <PageHeader title={route.title} subtitle={route.subtitle} />
          <NotConnected title="This page is not built yet." />
        </>
      )}
    </Shell>
  );
}
