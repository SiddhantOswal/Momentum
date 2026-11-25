import { NotConnected, PageHeader } from "../components/m";

export function PlantExplorer() {
  return (
    <>
      <PageHeader title="Plant Explorer" sub="Stage by stage. Illustrative, no live readings." />
      <div className="g">
        <NotConnected span={12} title="Plant Explorer" missing="The stage-by-stage view of the current lot is not connected yet." />
      </div>
    </>
  );
}
