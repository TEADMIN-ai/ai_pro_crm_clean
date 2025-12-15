import { Text, View, Image, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  header: {
    marginBottom: 20,
    borderBottom: "1px solid #ccc",
    paddingBottom: 10
  },
  company: { fontSize: 14, fontWeight: "bold" },
  info: { fontSize: 10 }
});

export default function Brand() {
  return (
    <View style={styles.header}>
      {/* Replace with hosted logo later */}
      <Text style={styles.company}>Torque Empire</Text>
      <Text style={styles.info}>AI Pro CRM</Text>
      <Text style={styles.info}>info@torqueempire.com</Text>
    </View>
  );
}
