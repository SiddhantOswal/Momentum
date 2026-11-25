import { NotConnected, PageHeader } from "../components/m";

export function Insights() {
  return (
    <>
      <PageHeader title="Insights" sub="Quality, impact and next steps. Every view is labelled." />
      <div className="g">
        <NotConnected span={12} title="Insights" missing="Model scores, impact and the evidence tiles are not connected to this page yet." />
      </div>
    </>
  );
}
