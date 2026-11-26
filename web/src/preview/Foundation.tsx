import { useState } from "react";
import { Alert, Button, Card, CheckRow, Chip, KeyValue, NotConnected, PageHeader, Status, Stepper, TableRow } from "../ui/components";

// Reference page for the shared components. Reachable only in development at #/_foundation.
export default function Foundation() {
  const [checked, setChecked] = useState(false);
  return (
    <>
      <PageHeader title="Foundation" subtitle="Shared components in the current theme." actions={<Button variant="secondary" size="small">Secondary</Button>} />
      <Stepper steps={[
        { label: "Order", state: "done" }, { label: "Conditions", state: "done" },
        { label: "Settings and risk", state: "current" }, { label: "Review and approve", state: "upcoming" },
      ]} />
      <div className="grid">
        <Card title="Values" meta="Example" span={4}>
          <KeyValue label="Roll temperature" value="170" unit="°C" />
          <KeyValue label="Gum viscosity" value="35" unit="s" />
          <KeyValue label="Gum application" value="MEDIUM" />
        </Card>
        <Card title="Provenance" span={4}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
            <Chip>Confirmed by operator</Chip>
            <Chip kind="modeled">Model estimate</Chip>
            <Chip kind="example">Example</Chip>
            <Chip kind="missing">Missing</Chip>
            <Chip kind="accent">Demo session (simulated approval)</Chip>
          </div>
        </Card>
        <Card title="Status" span={4}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Status tone="ok">Approved</Status>
            <Status tone="active">In progress</Status>
            <Status tone="warn">Needs a person</Status>
            <Status tone="bad">Stopped</Status>
            <Status tone="idle">Not reached</Status>
          </div>
        </Card>
        <Card title="Approval" span={6} kraft>
          <CheckRow checked={checked} onChange={setChecked}>I reviewed the settings and limits on this card.</CheckRow>
          <div style={{ marginTop: 14 }}><Button disabled={!checked}>Approve</Button></div>
        </Card>
        <Card title="Table" span={6}>
          <TableRow columns="1.5fr 1fr 1fr" head><span>Setting</span><span>Was</span><span>Now</span></TableRow>
          <TableRow columns="1.5fr 1fr 1fr"><span>Roll temperature</span><span>162 °C</span><span>170 °C</span></TableRow>
          <TableRow columns="1.5fr 1fr 1fr"><span>Gum viscosity</span><span>32 s</span><span>35 s</span></TableRow>
        </Card>
        <div className="span-12" style={{ display: "grid", gap: 12 }}>
          <Alert tone="ok" title="Job card approved">The card is stored and checked.</Alert>
          <Alert tone="warn" title="Conditions not confirmed" />
          <Alert tone="bad" title="Explanation unavailable">Planning continues without it.</Alert>
          <NotConnected title="Not connected" />
        </div>
      </div>
    </>
  );
}
