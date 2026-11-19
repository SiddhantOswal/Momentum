import { Shell } from "./components/Shell";
import { Empty } from "./components/ui";
import { Floor } from "./screens/Floor";
import { Lots } from "./screens/Lots";
import { Defects } from "./screens/Defects";
import { useScreen, useTheme, type Screen } from "./lib/useApp";

const TITLES: Record<Screen, { title: string; subtitle: string }> = {
  floor: { title: "Floor", subtitle: "Pune plant · live view of Line 1" },
  lots: { title: "Lots", subtitle: "Plan, review and approve production lots" },
  defects: { title: "Defects", subtitle: "Diagnose a defect and find what fixed it before" },
  impact: { title: "Impact", subtitle: "Scrap, savings and sustainability" },
  models: { title: "Models", subtitle: "How each defect model performs" },
};

export function App() {
  const { screen, go } = useScreen();
  const { theme, toggle } = useTheme();
  const { title, subtitle } = TITLES[screen];
  return (
    <Shell screen={screen} go={go} theme={theme} toggleTheme={toggle} title={title} subtitle={subtitle}>
      {screen === "floor" ? <Floor /> : screen === "lots" ? <Lots /> : screen === "defects" ? <Defects /> : <div className="panel p-6"><Empty title={`${title} is being built`} hint="Coming in the next build." /></div>}
    </Shell>
  );
}
