import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { JSX } from "react";

export interface VehicleQrLabelData {
  code: string;
  name: string;
  fuelTypeName?: string | null;
  zoneName?: string | null;
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Roboto",
    color: "#10231a",
    backgroundColor: "#ffffff",
    padding: 8,
  },
  frame: {
    height: "100%",
    borderWidth: 1.5,
    borderColor: "#166534",
    borderRadius: 5,
    padding: 7,
    flexDirection: "row",
    alignItems: "center",
  },
  qrPanel: {
    width: 104,
    alignItems: "center",
    justifyContent: "center",
  },
  qr: {
    width: 96,
    height: 96,
  },
  details: {
    flex: 1,
    height: "100%",
    paddingLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: "#bbd5c4",
    justifyContent: "center",
  },
  brand: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#166534",
    marginBottom: 2,
  },
  purpose: {
    fontSize: 6,
    color: "#52645b",
    marginBottom: 7,
  },
  code: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#0b2015",
    marginBottom: 4,
  },
  name: {
    fontSize: 8.5,
    fontWeight: "bold",
    marginBottom: 5,
  },
  meta: {
    fontSize: 7,
    color: "#37483f",
    marginBottom: 2,
  },
  hint: {
    fontSize: 5.5,
    color: "#64736b",
    marginTop: 4,
  },
});

/** Tem decal 60 x 40 mm; dữ liệu QR đã được tạo ở server để component không dùng browser API. */
export function VehicleQrLabelDocument({
  vehicle,
  qrCode,
}: {
  vehicle: VehicleQrLabelData;
  qrCode: string;
}): JSX.Element {
  return (
    <Document title={`Tem QR ${vehicle.code}`} author="Trại Lê Văn Dương">
      <Page size={[170.08, 113.39]} style={styles.page}>
        <View style={styles.frame}>
          <View style={styles.qrPanel}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={qrCode} style={styles.qr} />
          </View>
          <View style={styles.details}>
            <Text style={styles.brand}>TRẠI LÊ VĂN DƯƠNG</Text>
            <Text style={styles.purpose}>QUẢN LÝ NHIÊN LIỆU</Text>
            <Text style={styles.code}>{vehicle.code}</Text>
            <Text style={styles.name}>{vehicle.name}</Text>
            <Text style={styles.meta}>Nhiên liệu: {vehicle.fuelTypeName || "Chưa thiết lập"}</Text>
            <Text style={styles.meta}>Khu vực: {vehicle.zoneName || "Chưa phân khu"}</Text>
            <Text style={styles.hint}>Quét mã khi cấp phát nhiên liệu</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
