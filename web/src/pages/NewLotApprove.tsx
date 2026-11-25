import { NotConnected, PageHeader, Stepper } from "../components/m";

export function NewLotApprove() {
  return (
    <>
      <PageHeader title="New lot" sub="Review the job card. Approving issues it." />
      <Stepper current={4} />
      <div className="g">
        <NotConnected span={12} title="Review and approve" missing="The job card review and approval are not connected to this page yet." />
      </div>
    </>
  );
}
