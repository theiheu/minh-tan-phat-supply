import { PagePlaceholder } from "@/components/page-placeholder";

export default async function RequisitionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PagePlaceholder
      title="Chi tiết phiếu yêu cầu"
      description={`Xem chi tiết, timeline trạng thái và thao tác theo vai trò (phiếu ${id}).`}
    />
  );
}
