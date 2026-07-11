import { Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { getCorporateEmail, TORQUE_EMPIRE_COMPANY_PROFILE } from "@/lib/corporate/companyProfile";

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
      <Text style={styles.company}>{TORQUE_EMPIRE_COMPANY_PROFILE.tradingName}</Text>
      <Text style={styles.info}>{TORQUE_EMPIRE_COMPANY_PROFILE.tagline}</Text>
      <Text style={styles.info}>{getCorporateEmail("info")}</Text>
    </View>
  );
}
