import { NotConnected, PageHeader } from "../components/m";

export function Planning() {
  return (
    <>
      <PageHeader title="Planning" sub="The next phase of Momentum. A roadmap, not live features." />
      <div className="g">
        <NotConnected span={12} title="Planning" missing="The roadmap is not on this page yet." />
      </div>
    </>
  );
}
