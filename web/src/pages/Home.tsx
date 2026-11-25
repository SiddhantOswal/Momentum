import { NotConnected, PageHeader } from "../components/m";

export function Home() {
  return (
    <>
      <PageHeader title="Home" />
      <div className="g">
        <NotConnected span={12} title="Home" missing="The lot list, the reference run and the model scores are not connected to this page yet." />
      </div>
    </>
  );
}
