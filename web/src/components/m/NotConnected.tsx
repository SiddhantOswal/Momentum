import type { ReactNode } from "react";
import { Card } from "./Card";

/**
 * The designed state for an element whose backend does not exist yet (Insights "Capacity"
 * pattern): the element's title and one plain sentence that says what is missing. It never
 * shows a figure.
 */
export function NotConnected({ title, missing, span, children }: {
  title: string; missing: string; span?: 3 | 4 | 5 | 6 | 7 | 8 | 12; children?: ReactNode;
}) {
  return (
    <Card title={title} span={span}>
      <p className="lb" style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>{missing}</p>
      <div className="ncbar" aria-hidden="true" />
      {children}
    </Card>
  );
}
