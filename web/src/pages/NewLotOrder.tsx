import { NotConnected, PageHeader, Stepper } from "../components/m";

export function NewLotOrder() {
  return (
    <>
      <PageHeader title="New lot" sub="Check each value against the order before you confirm." />
      <Stepper current={1} />
      <div className="g">
        <NotConnected span={12} title="Order" missing="Reading a sample order is not connected to this page yet." />
      </div>
    </>
  );
}
