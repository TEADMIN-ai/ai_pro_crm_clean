import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 40 },
  title: { fontSize: 20, marginBottom: 20 },
  field: { marginBottom: 10 }
});

export default function CarSalePDF({ sale }) {
  return (
    <Document>
      <Page style={styles.page}>
        <Text style={styles.title}>Car Sale Invoice</Text>

        <Text style={styles.field}>Vehicle: {sale.vehicle}</Text>
        <Text style={styles.field}>Buyer: {sale.buyer}</Text>
        <Text style={styles.field}>Price: ${sale.price}</Text>
        <Text style={styles.field}>Status: {sale.status}</Text>
      </Page>
    </Document>
  );
}
