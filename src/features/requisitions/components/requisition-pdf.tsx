import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { REQUISITION_STATUS, REQUISITION_TYPE } from "@/lib/labels";
import { formatDate } from "@/lib/format";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 12, fontFamily: "Helvetica" },
  title: { fontSize: 18, fontWeight: "bold", textAlign: "center", marginBottom: 4 },
  subtitle: { fontSize: 12, textAlign: "center", marginBottom: 16, color: "#444" },
  row: { flexDirection: "row", marginBottom: 4 },
  label: { width: 140, fontWeight: "bold" },
  value: { flex: 1 },
  table: { marginTop: 12, borderTopWidth: 1, borderColor: "#000" },
  th: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#000", paddingVertical: 4, fontWeight: "bold", backgroundColor: "#f3f4f6" },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#ccc", paddingVertical: 4 },
  cell: { flex: 1, paddingHorizontal: 4 },
  sign: { marginTop: 32, flexDirection: "row", justifyContent: "space-between" },
});

export interface ReqPdfItem {
  name: string;
  label: string;
  unit: string | null;
  quantity: number;
}

export function RequisitionPDF({
  code,
  status,
  type,
  requester,
  zone,
  purpose,
  createdAt,
  items,
}: {
  code: string;
  status: string;
  type: string;
  requester: string;
  zone: string;
  purpose: string;
  createdAt: string;
  items: ReqPdfItem[];
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>TRẠI GÀ MINH TÂN PHÁT</Text>
        <Text style={styles.subtitle}>PHIẾU YÊU CẦU VẬT TƯ</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Mã phiếu:</Text>
          <Text style={styles.value}>{code}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Ngày:</Text>
          <Text style={styles.value}>{formatDate(createdAt)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Người yêu cầu:</Text>
          <Text style={styles.value}>{requester}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Khu vực:</Text>
          <Text style={styles.value}>{zone}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Loại:</Text>
          <Text style={styles.value}>{REQUISITION_TYPE[type] ?? type}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Trạng thái:</Text>
          <Text style={styles.value}>{REQUISITION_STATUS[status] ?? status}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Mục đích:</Text>
          <Text style={styles.value}>{purpose}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.th}>
            <Text style={[styles.cell, { flex: 0.4 }]}>STT</Text>
            <Text style={[styles.cell, { flex: 1.6 }]}>Tên vật tư</Text>
            <Text style={[styles.cell, { flex: 1.4 }]}>Biến thể</Text>
            <Text style={[styles.cell, { flex: 0.8 }]}>Đơn vị</Text>
            <Text style={[styles.cell, { flex: 0.8 }]}>Số lượng</Text>
          </View>
          {items.map((it, i) => (
            <View key={i} style={styles.tr}>
              <Text style={[styles.cell, { flex: 0.4 }]}>{i + 1}</Text>
              <Text style={[styles.cell, { flex: 1.6 }]}>{it.name}</Text>
              <Text style={[styles.cell, { flex: 1.4 }]}>{it.label}</Text>
              <Text style={[styles.cell, { flex: 0.8 }]}>{it.unit ?? "—"}</Text>
              <Text style={[styles.cell, { flex: 0.8 }]}>{it.quantity}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sign}>
          <Text>Người yêu cầu</Text>
          <Text>Người duyệt</Text>
          <Text>Người cấp phát</Text>
          <Text>Người nhận</Text>
        </View>
      </Page>
    </Document>
  );
}
