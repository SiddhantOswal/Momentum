import { NotConnected, PageHeader } from "../components/m";

export function PrepFlow() {
  return (
    <>
      <PageHeader title="Preparation flow" sub="Purchase order to approved job card, step by step." />
      <div className="g">
        <NotConnected span={12} title="Preparation flow" missing="The step-by-step record for each lot is not connected yet." />
      </div>
    </>
  );
}
