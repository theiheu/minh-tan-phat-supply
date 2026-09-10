// Engine mẫu in chuẩn cho mọi phiếu (Task 2): SlipDocument.
//
// A4 + khung viền mỏng; header thương hiệu (logo + BRAND); title + ngày dài
// tự vẽ từ createdAt; cột trái fields + ô phải rightPanel (tuỳ chọn); bảng
// dữ liệu viền đủ kèm STT tự đánh, header cột lặp lại qua <View fixed>;
// các dòng totals/amountInWords nằm trong cùng khung viền bao bảng (react-pdf
// không hỗ trợ colspan); footer mỗi trang luôn "Trang x/y", kèm "Số phiếu: …"
// phía trái chỉ khi có truyền prop code (mẫu phiếu — bảng tồn kho không truyền).
//
// Font: mọi Text thừa kế "Roboto" từ Page; các route phải gọi ensurePdfFonts()
// trước renderToBuffer như hiện tại.
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { JSX } from "react";
import { formatDateLong } from "@/lib/format";
import { BRAND, brandLogoDataUri } from "./brand";

/** Cột dữ liệu của bảng phiếu (không kể cột STT). */
export interface SlipColumn {
  label: string;
  flex: number;
  align?: "left" | "right" | "center";
}

/** Dòng thông tin dạng "nhãn: giá trị" (cột trái fields hoặc ô phải rightPanel). */
export interface SlipField {
  label: string;
  value?: string | null;
}

/** Dòng tổng cộng cuối bảng — 1 dòng riêng có borderTop, `left` sát lề trái, `right` sát lề phải. */

export interface SlipRowGroup {
  items: (string | number | null | undefined)[][];
  mergeColumns?: number[]; // indices of columns to merge
}
export type SlipRowItem = (string | number | null | undefined)[] | SlipRowGroup;

export interface SlipTotals {
  left?: string;
  right?: string;
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Roboto",
    fontSize: 10,
    color: "#000",
    paddingTop: 16,
    paddingBottom: 48,
    paddingHorizontal: 18,
  },
  // Khung ngoài viền mỏng — fixed + absolute để lặp lại trên mọi trang.
  frame: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    bottom: 8,
    borderWidth: 1,
    borderColor: "#000",
  },
  footerText: {
    position: "absolute",
    bottom: 16,
    fontSize: 8.5,
    color: "#000",
  },
  footerLeft: { left: 18 },
  footerRight: { right: 18 },

  // --- Header thương hiệu ---
  brandRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  logo: { width: 72, height: 72, marginRight: 14, objectFit: "contain" },
  brandBlock: { flex: 1, justifyContent: "center" },
  brandName: { fontSize: 13.5, fontWeight: "bold", marginBottom: 3 },
  brandLine: { fontSize: 9, color: "#222", marginBottom: 1.5 },
  codeBlock: { alignItems: "flex-end", justifyContent: "center" },
  qrImage: { width: 50, height: 50, marginBottom: 2 },
  codeText: { fontSize: 10.5, fontWeight: "bold", textAlign: "right" },

  // --- Title + ngày ---
  title: { fontSize: 17, fontWeight: "bold", textAlign: "center", marginBottom: 2 },
  dateLine: { fontSize: 10.5, textAlign: "center", color: "#222", marginBottom: 10 },

  // --- Fields trái + rightPanel ---
  metaRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  metaFull: { flex: 1 },
  metaLeft: { flex: 0.55, paddingRight: 10 },
  metaRight: { flex: 0.45, borderWidth: 1, borderColor: "#000", padding: 6 },
  fieldRow: { flexDirection: "row", marginBottom: 2 },
  fieldLabel: { width: 92, fontWeight: "bold", fontSize: 9.5 },
  fieldValue: { flex: 1, fontSize: 9.5 },
  panelHeading: { fontWeight: "bold", fontSize: 9.5, marginBottom: 3 },
  panelFieldLabel: { width: 70, fontWeight: "bold", fontSize: 9.5 },

  // --- Bảng (khung viền bao cả header/dữ liệu/totals/amountInWords) ---
  tableFrame: { borderWidth: 1, borderColor: "#000" },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    backgroundColor: "#F8FAFC",
  },
  headerText: { fontSize: 9.5, fontWeight: "bold" },
  bodyRow: { flexDirection: "row" },
  bodyRowLast: { flexDirection: "row" },
  cell: { paddingVertical: 10, paddingHorizontal: 6, borderRightWidth: 0.5, borderRightColor: "#000" },
  cellNoBorder: { paddingVertical: 10, paddingHorizontal: 6 },
  cellStt: { flex: 0.45, paddingVertical: 10, paddingHorizontal: 6, borderRightWidth: 0.5, borderRightColor: "#000" },
  cellText: { fontSize: 9.5 },
  cellAlignLeft: { textAlign: "left" },
  cellAlignRight: { textAlign: "right" },
  cellAlignCenter: { textAlign: "center" },

  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#000",
    paddingVertical: 9,
    paddingHorizontal: 6,
  },
  totalsLeft: { fontWeight: "bold", fontSize: 9.5 },
  totalsRight: { fontWeight: "bold", fontSize: 9.5 },

  amountRow: { paddingVertical: 8, paddingHorizontal: 6 },
  amountText: { fontSize: 9.5 },

  // --- Chữ ký ---
  signBlock: { marginTop: 24 },
  signSpace: { height: 70 },
  signRow: { flexDirection: "row" },
  signCol: { flex: 1, alignItems: "center" },
  signName: { fontSize: 10, fontWeight: "bold" },
  signHint: { fontSize: 7.5, color: "#333", marginTop: 2 },
});

const ALIGN_STYLES = {
  left: styles.cellAlignLeft,
  right: styles.cellAlignRight,
  center: styles.cellAlignCenter,
} as const;

function displayValue(value: string | null | undefined): string {
  return value == null || value === "" ? "—" : value;
}

export function SlipDocument(props: {
  title: string; // ví dụ "PHIẾU XUẤT KHO"
  code?: string; // "PXK-0001" — vẽ "Số phiếu: …" (header phải + footer trái); bỏ trống với mẫu không phải phiếu (bảng tồn kho…)
  createdAt: string; // ISO → tự vẽ "Ngày 06 tháng 09 năm 2026" dưới title
  fields?: SlipField[]; // cột trái (Bên nhận hàng…)
  rightPanel?: { heading?: string; fields: SlipField[] }; // ô phải (Thông tin xe…)
  columns: SlipColumn[];
  rows: SlipRowItem[]; // không kèm STT — STT tự đánh
  signers?: string[];
  totals?: SlipTotals[]; // dòng "TỔNG CỘNG" cuối bảng (có viền trên)
  amountInWords?: string; // "Thành tiền bằng chữ: …" (có money-words cung cấp)
  qrCode?: string; // Data URI ảnh mã QR ở góc phải trên cùng
  orientation?: "portrait" | "landscape";
}): JSX.Element {
  const { title, orientation = "portrait",
    code,
    createdAt,
    fields = [],
    rightPanel,
    columns,
    rows,
    signers = [],
    totals = [],
    amountInWords,
    qrCode,
  } = props;

  const logo = brandLogoDataUri();
  const dateLine = formatDateLong(createdAt);
  const leftFields = fields.length > 0 ? fields : null;
  const rightFields = rightPanel && rightPanel.fields.length > 0 ? rightPanel : null;
  const hasMeta = leftFields !== null || rightFields !== null;
  const hasTotals = totals.length > 0;
  const signersList = signers.length > 0 ? signers : null;

  // Header + body đều đánh số cột theo columns (row có thể thiếu/thừa ô).
  const headerCell = (col: SlipColumn, index: number, last: boolean) => (
    <View key={`h${index}`} style={[last ? styles.cellNoBorder : styles.cell, { flex: col.flex }]}>
      <Text style={[styles.headerText, ALIGN_STYLES[col.align ?? "left"]]}>{col.label}</Text>
    </View>
  );

  return (
    <Document>
      <Page size="A4" orientation={orientation} style={styles.page}>
        {/* Khung viền + footer lặp lại trên mọi trang */}
        <View fixed style={styles.frame} />
        {code ? (
          <Text fixed style={[styles.footerText, styles.footerLeft]}>Số phiếu: {code}</Text>
        ) : null}
        <Text
          fixed
          style={[styles.footerText, styles.footerRight]}
          render={({ pageNumber, totalPages }) => `Trang ${pageNumber}/${totalPages}`}
        />

        {/* Header thương hiệu */}
        <View style={styles.brandRow}>
          {logo ? (
            // react-pdf <Image> vẽ ảnh trong PDF (không có DOM/alt).
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={logo} style={styles.logo} />
          ) : null}
          <View style={styles.brandBlock}>
            <Text style={styles.brandName}>{BRAND.name}</Text>
            <Text style={styles.brandLine}>{BRAND.address}</Text>
            <Text style={styles.brandLine}>{BRAND.phone}</Text>
          </View>
          <View style={styles.codeBlock}>
            {qrCode ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={qrCode} style={styles.qrImage} />
            ) : null}
            {code ? (
              <Text style={styles.codeText}>Số phiếu: {code}</Text>
            ) : null}
          </View>
        </View>

        <Text style={styles.title}>{title}</Text>
        {dateLine ? <Text style={styles.dateLine}>{dateLine}</Text> : null}

        {/* Cột trái + ô phải (chỉ vẽ khi có dữ liệu) */}
        {hasMeta ? (
          <View style={styles.metaRow}>
            {leftFields ? (
              <View style={[styles.metaLeft, rightFields === null ? styles.metaFull : undefined]}>
                {leftFields.map((f, i) => (
                  <View key={`f${i}`} style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>{f.label}:</Text>
                    <Text style={styles.fieldValue}>{displayValue(f.value)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {rightFields ? (
              <View style={[styles.metaRight, leftFields === null ? styles.metaFull : undefined]}>
                {rightFields.heading ? <Text style={styles.panelHeading}>{rightFields.heading}</Text> : null}
                {rightFields.fields.map((f, i) => (
                  <View key={`r${i}`} style={styles.fieldRow}>
                    <Text style={styles.panelFieldLabel}>{f.label}:</Text>
                    <Text style={styles.fieldValue}>{displayValue(f.value)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Bảng: header cố định lặp lại khi tràn trang */}
        <View style={styles.tableFrame}>
          <View fixed wrap={false} style={styles.tableHeader}>
            <View style={styles.cellStt}>
              <Text style={[styles.headerText, styles.cellAlignCenter]}>STT</Text>
            </View>
            {columns.map((col, i) => headerCell(col, i, i === columns.length - 1))}
          </View>

          {rows.map((rowItem, rowIndex) => {
            const isGroup = rowItem !== null && typeof rowItem === "object" && !Array.isArray(rowItem) && "items" in rowItem;
            const group = isGroup ? rowItem : { items: [rowItem], mergeColumns: [] };
            
            const { items, mergeColumns = [] } = group as import("./slip").SlipRowGroup;
            
            return items.map((item, iIndex) => {
              const isFirstItem = iIndex === 0;
              const isLastItem = iIndex === items.length - 1;
              const isLastRowOverall = rowIndex === rows.length - 1 && isLastItem;

              return (
                <View key={`r${rowIndex}_i${iIndex}`} wrap={false} style={isLastRowOverall ? styles.bodyRowLast : styles.bodyRow}>
                  <View style={[styles.cellStt, 
                    !isLastRowOverall && (!isFirstItem || !isLastItem) ? { borderBottomWidth: isLastItem ? 0.5 : 0, borderBottomColor: "#555" } : undefined,
                    !isLastRowOverall && isFirstItem && isLastItem ? { borderBottomWidth: 0.5, borderBottomColor: "#555" } : undefined
                  ]}>
                    <Text style={[styles.cellText, styles.cellAlignCenter]}>
                      {isFirstItem ? rowIndex + 1 : ""}
                    </Text>
                  </View>
                  {columns.map((col, cIndex) => {
                    const isLastCol = cIndex === columns.length - 1;
                    const isMerged = mergeColumns.includes(cIndex);
                    
                    const hideBottomBorder = isMerged ? !isLastItem : false;
                    const drawBottomBorder = !isLastRowOverall && !hideBottomBorder;

                    const borderStyle = drawBottomBorder ? { borderBottomWidth: 0.5, borderBottomColor: "#555" } : {};
                    
                    return (
                      <View key={`c${cIndex}`} style={[isLastCol ? styles.cellNoBorder : styles.cell, { flex: col.flex }, borderStyle]}>
                        <Text style={[styles.cellText, ALIGN_STYLES[col.align ?? "left"]]}>
                          {isMerged && !isFirstItem ? "" : (item[cIndex] == null ? "" : String(item[cIndex]))}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              );
            });
          })}

          {hasTotals
            ? totals.map((t, i) => (
                <View key={`t${i}`} wrap={false} style={styles.totalsRow}>
                  <Text style={styles.totalsLeft}>{t.left ?? ""}</Text>
                  <Text style={styles.totalsRight}>{t.right ?? ""}</Text>
                </View>
              ))
            : null}

          {amountInWords ? (
            <View style={styles.amountRow}>
              <Text style={styles.amountText}>{amountInWords}</Text>
            </View>
          ) : null}
        </View>

        {/* Chữ ký */}
        {signersList ? (
          <View style={styles.signBlock} wrap={false}>
            <View style={styles.signSpace} />
            <View style={styles.signRow}>
              {signersList.map((s) => (
                <View key={s} style={styles.signCol}>
                  <Text style={styles.signName}>{s}</Text>
                  <Text style={styles.signHint}>(Ký, ghi rõ họ tên)</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
