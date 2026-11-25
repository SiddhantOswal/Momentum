import { NotConnected, PageHeader } from "../components/m";

export function PhotoDiagnosis() {
  return (
    <>
      <PageHeader title="Photo diagnosis" sub="Ten approved photos only." />
      <div className="g">
        <NotConnected span={12} title="Photo diagnosis" missing="The approved photos and their check are not connected to this page yet." />
      </div>
    </>
  );
}
