// Nhãn in mã QR đa kích thước (A4, máy in nhiệt K58, K80, tem decal 50x30).
//
// 1 mm ≈ 2.83465 pt
// - A4: 595.28 x 841.89 pt (khung nét đứt căn giữa để cắt dán)
// - K58 (58mm): 164.4 x 230 pt (vừa cuộn in nhiệt 58mm di động)
// - K80 (80mm): 226.8 x 280 pt (vừa cuộn in nhiệt 80mm)
// - 50x30 (50x30mm): 141.7 x 85.0 pt (tem decal dán vật tư)
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { JSX } from "react";

export type QrLabelSize = "k58" | "k80" | "50x30" | "a4";

const styles = StyleSheet.create({
  // --- Khổ A4 ---
  a4Page: {
    fontFamily: "Roboto",
    color: "#000",
  },
  a4CenterLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  a4CutBox: {
    borderWidth: 1.5,
    borderColor: "#000",
    borderStyle: "dashed",
    borderRadius: 8,
    paddingVertical: 36,
    paddingHorizontal: 46,
    alignItems: "center",
  },
  a4Title: {
    fontSize: 15,
    fontWeight: "bold",
    textAlign: "center",
    color: "#111",
    marginBottom: 26,
  },
  a4Caption: {
    fontSize: 11,
    color: "#444",
    marginBottom: 4,
  },
  a4Code: {
    fontSize: 23,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 22,
  },
  a4Qr: {
    width: 230,
    height: 230,
    marginBottom: 24,
  },
  a4Hint: {
    fontSize: 9.5,
    color: "#555",
    textAlign: "center",
  },

  // --- Khổ K58 (58mm) ---
  k58Page: {
    fontFamily: "Roboto",
    color: "#000",
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  k58Title: {
    fontSize: 8.5,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 4,
  },
  k58Code: {
    fontSize: 13,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 6,
  },
  k58Qr: {
    width: 110,
    height: 110,
    marginBottom: 6,
  },
  k58Hint: {
    fontSize: 7,
    color: "#333",
    textAlign: "center",
  },

  // --- Khổ K80 (80mm) ---
  k80Page: {
    fontFamily: "Roboto",
    color: "#000",
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  k80Title: {
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 5,
  },
  k80Code: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  k80Qr: {
    width: 145,
    height: 145,
    marginBottom: 8,
  },
  k80Hint: {
    fontSize: 8,
    color: "#333",
    textAlign: "center",
  },

  // --- Khổ tem decal 50x30mm ---
  label50x30Page: {
    fontFamily: "Roboto",
    color: "#000",
    padding: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label50x30Qr: {
    width: 68,
    height: 68,
  },
  label50x30Right: {
    flex: 1,
    paddingLeft: 6,
    justifyContent: "center",
  },
  label50x30Title: {
    fontSize: 6.5,
    color: "#444",
    marginBottom: 2,
  },
  label50x30Code: {
    fontSize: 10.5,
    fontWeight: "bold",
    marginBottom: 3,
  },
  label50x30Hint: {
    fontSize: 5.5,
    color: "#666",
  },
});

export function QrLabelDocument(props: {
  title: string; // ví dụ "PHIẾU XUẤT KHO"
  code: string; // mã phiếu, ví dụ "PXK-2026-0001"
  qrCode: string; // Data URI ảnh mã QR
  size?: QrLabelSize; // Mặc định "k58" cho máy in mini cầm tay
}): JSX.Element {
  const { title, code, qrCode, size = "k58" } = props;

  if (size === "a4") {
    return (
      <Document>
        <Page size="A4" style={styles.a4Page}>
          <View style={styles.a4CenterLayer}>
            <View style={styles.a4CutBox}>
              <Text style={styles.a4Title}>{title}</Text>
              <Text style={styles.a4Caption}>Mã phiếu</Text>
              <Text style={styles.a4Code}>{code}</Text>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image src={qrCode} style={styles.a4Qr} />
              <Text style={styles.a4Hint}>Quét mã QR để mở thông tin phiếu trên hệ thống</Text>
            </View>
          </View>
        </Page>
      </Document>
    );
  }

  if (size === "k80") {
    return (
      <Document>
        {/* 80mm x 98mm = 226.8 x 280 pt */}
        <Page size={[226.8, 280]} style={styles.k80Page}>
          <Text style={styles.k80Title}>{title}</Text>
          <Text style={styles.k80Code}>{code}</Text>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={qrCode} style={styles.k80Qr} />
          <Text style={styles.k80Hint}>Quét mã để xem chi tiết phiếu</Text>
        </Page>
      </Document>
    );
  }

  if (size === "50x30") {
    return (
      <Document>
        {/* 50mm x 30mm = 141.7 x 85.0 pt */}
        <Page size={[141.7, 85.0]} style={styles.label50x30Page}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={qrCode} style={styles.label50x30Qr} />
          <View style={styles.label50x30Right}>
            <Text style={styles.label50x30Title}>{title}</Text>
            <Text style={styles.label50x30Code}>{code}</Text>
            <Text style={styles.label50x30Hint}>Quét xem phiếu</Text>
          </View>
        </Page>
      </Document>
    );
  }

  // Mặc định K58: 58mm x 81mm = 164.4 x 230 pt
  return (
    <Document>
      <Page size={[164.4, 230]} style={styles.k58Page}>
        <Text style={styles.k58Title}>{title}</Text>
        <Text style={styles.k58Code}>{code}</Text>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={qrCode} style={styles.k58Qr} />
        <Text style={styles.k58Hint}>Quét mã để xem chi tiết</Text>
      </Page>
    </Document>
  );
}
