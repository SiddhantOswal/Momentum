import { NotConnected, PageHeader, Stepper } from "../components/m";

export function NewLotSettings() {
  return (
    <>
      <PageHeader title="New lot" sub="Compare the two plans, then decide." />
      <Stepper current={3} />
      <div className="g">
        <NotConnected span={12} title="Settings and risk" missing="The plan comparison is not connected to this page yet." />
      </div>
    </>
  );
}
