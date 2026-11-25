import { NotConnected, PageHeader, Stepper } from "../components/m";

export function NewLotConditions() {
  return (
    <>
      <PageHeader title="New lot" sub="Confirm today's conditions and your planned settings." />
      <Stepper current={2} />
      <div className="g">
        <NotConnected span={12} title="Conditions" missing="Today's conditions and your planned settings are not connected to this page yet." />
      </div>
    </>
  );
}
