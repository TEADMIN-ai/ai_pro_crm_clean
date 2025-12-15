import { Document, Page, Text, StyleSheet } from "@react-pdf/renderer";
import Brand from "./Brand";

const styles = StyleSheet.create({
  page: { padding: 40 },
  field: { marginBottom: 10 }
});

export default function ContractorPDF({ contractor }) {
  return (
    <Document>
      <Page style={styles.page}>
        <Brand />
        <Text style={styles.field}>Name: {contractor.name}</Text>
        <Text style={styles.field}>Company: {contractor.company}</Text>
        <Text style={styles.field}>Email: {contractor.email}</Text>
        <Text style={styles.field}>CIDB: {contractor.cidb}</Text>
      </Page>
    </Document>
  );
}
