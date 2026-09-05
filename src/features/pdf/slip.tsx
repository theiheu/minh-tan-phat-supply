import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Roboto" },
  title: { fontSize: 18, fontWeight: "bold", textAlign: "center", marginBottom: 4 },
  subtitle: { fontSize: 13, textAlign: "center", marginBottom: 16, fontWeight: "bold" },
  row: { flexDirection: "row", marginBottom: 3 },
  label: { width: 130, fontWeight: "bold" },
  table: { marginTop: 12, borderTopWidth: 1, borderColor: "#000" },
  th: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#000", paddingVertical: 4, fontWeight: "bold", backgroundColor: "#f3f4f6" },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#ccc", paddingVertical: 3 },
  cell: { paddingHorizontal: 3 },
  total: { marginTop: 10, fontWeight: "bold" },
  sign: { marginTop: 32, flexDirection: "row", justifyContent: "space-between" },
});

export interface SlipColumn {
  label: string;
  flex: number;
}

export function SlipDocument({
  title,
  code,
  date,
  info,
  columns,
  rows,
  signers,
  totalNote,
}: {
  title: string;
  code: string;
  date: string;
  info: [string, string][];
  columns: SlipColumn[];
  rows: (string | number)[][];
  signers: string[];
  totalNote?: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>TRẠI GÀ MINH TÂN PHÁT</Text>
        <Text style={styles.subtitle}>{title}</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Mã phiếu:</Text>
          <Text>{code}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Ngày:</Text>
          <Text>{date}</Text>
        </View>
        {info.map(([k, v], i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.label}>{k}:</Text>
            <Text>{v || "—"}</Text>
          </View>
        ))}

        <View style={styles.table}>
          <View style={styles.th}>
            <Text style={[styles.cell, { flex: 0.4 }]}>STT</Text>
            {columns.map((c) => (
              <Text key={c.label} style={[styles.cell, { flex: c.flex }]}>
                {c.label}
              </Text>
            ))}
          </View>
          {rows.map((r, i) => (
            <View key={i} style={styles.tr}>
              <Text style={[styles.cell, { flex: 0.4 }]}>{i + 1}</Text>
              {r.map((cell, j) => (
                <Text key={j} style={[styles.cell, { flex: columns[j].flex }]}>
                  {cell ?? "—"}
                </Text>
              ))}
            </View>
          ))}
        </View>

        {totalNote ? <Text style={styles.total}>{totalNote}</Text> : null}

        <View style={styles.sign}>
          {signers.map((s) => (
            <Text key={s}>{s}</Text>
          ))}
        </View>
      </Page>
    </Document>
  );
}
