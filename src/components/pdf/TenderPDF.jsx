import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 40 },
  title: { fontSize: 20, marginBottom: 20 },
  field: { marginBottom: 10 }
});

export default function TenderPDF({ tender }) {
  return (
    <Document>
      <Page style={styles.page}>
        <Text style={styles.title}>Tender Document</Text>

        <Text style={styles.field}>Title: {tender.title}</Text>
        <Text style={styles.field}>Client: {tender.client}</Text>
        <Text style={styles.field}>Value: ${tender.value}</Text>
        <Text style={styles.field}>Status: {tender.status}</Text>
      </Page>
    </Document>
  );
}
