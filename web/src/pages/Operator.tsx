import { ThemeSwitch } from "../components/Frame";
import { NotConnected } from "../components/m";
import type { Theme } from "../lib/useApp";

/** The operator's phone view. It has no sidebar or top bar, as in Operator-Phone. */
export function Operator({ theme, toggleTheme }: { theme: Theme; toggleTheme: () => void }) {
  return (
    <main id="main" style={{ maxWidth: 480, margin: "0 auto", padding: "40px 16px" }}>
      <div className="th">Operator handoff</div>
      <h1 className="d" style={{ margin: "8px 0 6px", fontSize: 34, lineHeight: "40px", fontWeight: 600, letterSpacing: "-.6px" }}>The same card, on the operator's phone.</h1>
      <p className="lb" style={{ margin: "0 0 24px", fontSize: 16 }}>Opens the exact revision the supervisor approved.</p>
      <NotConnected title="Approved job card" missing="The approved card for the operator's phone is not connected yet." />
      <div style={{ marginTop: 24 }}><ThemeSwitch theme={theme} toggle={toggleTheme} /></div>
    </main>
  );
}
