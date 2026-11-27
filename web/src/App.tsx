import type { ComponentType } from "react";
import { Frame } from "./components/Frame";
import { useRoute, type RouteId } from "./lib/routes";
import { useTheme } from "./lib/useApp";
import { Home } from "./pages/Home";
import { Insights } from "./pages/Insights";
import { NewLotApprove } from "./pages/NewLotApprove";
import { NewLotConditions } from "./pages/NewLotConditions";
import { NewLotOrder } from "./pages/NewLotOrder";
import { NewLotSettings } from "./pages/NewLotSettings";
import { Operator } from "./pages/Operator";
import { PhotoDiagnosis } from "./pages/PhotoDiagnosis";
import { Planning } from "./pages/Planning";
import { PlantExplorer } from "./pages/PlantExplorer";
import { PrepFlow } from "./pages/PrepFlow";

const PAGES: Record<Exclude<RouteId, "operator">, ComponentType> = {
  "home": Home,
  "new-lot/order": NewLotOrder,
  "new-lot/conditions": NewLotConditions,
  "new-lot/settings": NewLotSettings,
  "new-lot/approve": NewLotApprove,
  "explorer": PlantExplorer,
  "prep-flow": PrepFlow,
  "insights": Insights,
  "photo": PhotoDiagnosis,
  "planning": Planning,
};

export function App() {
  const route = useRoute();
  const { theme, toggle } = useTheme();
  if (route.id === "operator") return <div className="m"><Operator theme={theme} toggleTheme={toggle} /></div>;
  const Page = PAGES[route.id];
  return (
    <Frame route={route} theme={theme} toggleTheme={toggle}>
      <Page key={route.id} />
    </Frame>
  );
}
