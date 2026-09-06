// Engine mẫu in chuẩn cho mọi phiếu (Task 2): SlipDocument.
//
// A4 + khung viền mỏng; header thương hiệu (logo + BRAND); title + ngày dài
// tự vẽ từ createdAt; cột trái fields + ô phải rightPanel (tuỳ chọn); bảng
// dữ liệu viền đủ kèm STT tự đánh, header cột lặp lại qua <View fixed>;
// các dòng totals/amountInWords nằm trong cùng khung viền bao bảng (react-pdf
// không hỗ trợ colspan); footer mỗi trang "Số phiếu … / Trang x/y".
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
export interface SlipTotals {
  left?: string;
  right?: string;
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Roboto",
    fontSize: 10,
    color: "#000",
    paddingTop: 34,
    paddingBottom: 52,
    paddingHorizontal: 36,
  },
  // Khung ngoài viền mỏng — fixed + absolute để lặp lại trên mọi trang.
  frame: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    bottom: 10,
    borderWidth: 1,
    borderColor: "#000",
  },
  footerText: {
    position: "absolute",
    bottom: 18,
    fontSize: 8.5,
    color: "#000",
  },
  footerLeft: { left: 36 },
  footerRight: { right: 36 },

  // --- Header thương hiệu ---
  brandRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  logo: { width: 152, height: 117, marginRight: 14, objectFit: "contain" },
  brandBlock: { flex: 1 },
  brandName: { fontSize: 13, fontWeight: "bold", marginBottom: 2 },
  brandLine: { fontSize: 8.5, color: "#222", marginBottom: 1 },
  codeBlock: { alignItems: "flex-end", paddingTop: 1 },
  codeText: { fontSize: 10.5, fontWeight: "bold" },

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
  },
  headerText: { fontSize: 9.5, fontWeight: "bold" },
  bodyRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#555" },
  bodyRowLast: { flexDirection: "row" },
  cell: { paddingVertical: 4, paddingHorizontal: 5, borderRightWidth: 0.5, borderRightColor: "#000" },
  cellNoBorder: { paddingVertical: 4, paddingHorizontal: 5 },
  cellStt: { flex: 0.45, paddingVertical: 4, paddingHorizontal: 5, borderRightWidth: 0.5, borderRightColor: "#000" },
  cellText: { fontSize: 9.5 },
  cellAlignLeft: { textAlign: "left" },
  cellAlignRight: { textAlign: "right" },
  cellAlignCenter: { textAlign: "center" },

  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#000",
    paddingVertical: 4,
    paddingHorizontal: 5,
  },
  totalsLeft: { fontWeight: "bold", fontSize: 9.5 },
  totalsRight: { fontWeight: "bold", fontSize: 9.5 },

  amountRow: { paddingVertical: 4, paddingHorizontal: 5 },
  amountText: { fontSize: 9.5 },

  notesBlock: { marginTop: 10 },
  notesText: { fontSize: 9.5 },

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
  rows: (string | number | null | undefined)[][]; // không kèm STT — STT tự đánh
  signers?: string[];
  totals?: SlipTotals[]; // dòng "TỔNG CỘNG" cuối bảng (có viền trên)
  amountInWords?: string; // "Thành tiền bằng chữ: …" (có money-words cung cấp)
  notes?: string; // "Ghi chú" tự do cuối phiếu
}): JSX.Element {
  const {
    title,
    code,
    createdAt,
    fields = [],
    rightPanel,
    columns,
    rows,
    signers = [],
    totals = [],
    amountInWords,
    notes,
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

  const bodyCell = (col: SlipColumn, value: string | number | null | undefined, index: number, last: boolean) => (
    <View key={`c${index}`} style={[last ? styles.cellNoBorder : styles.cell, { flex: col.flex }]}>
      <Text style={[styles.cellText, ALIGN_STYLES[col.align ?? "left"]]}>
        {value == null ? "" : String(value)}
      </Text>
    </View>
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
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
          {code ? (
            <View style={styles.codeBlock}>
              <Text style={styles.codeText}>Số phiếu: {code}</Text>
            </View>
          ) : null}
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

          {rows.map((row, rowIndex) => {
            const isLast = rowIndex === rows.length - 1;
            return (
              <View key={`r${rowIndex}`} wrap={false} style={isLast ? styles.bodyRowLast : styles.bodyRow}>
                <View style={styles.cellStt}>
                  <Text style={[styles.cellText, styles.cellAlignCenter]}>{rowIndex + 1}</Text>
                </View>
                {columns.map((col, i) =>
                  bodyCell(col, row[i], i, i === columns.length - 1),
                )}
              </View>
            );
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

        {notes ? (
          <View style={styles.notesBlock}>
            <Text style={styles.notesText}>{notes}</Text>
          </View>
        ) : null}

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
