import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SensesScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>Senses</Text>
        <Text style={styles.subtitle}>Kairo&apos;s connection to your digital world.</Text>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Gmail</Text>
            <View style={[styles.badge, styles.badgeDisconnected]}>
              <Text style={styles.badgeText}>Not Connected</Text>
            </View>
          </View>
          <Text style={styles.cardDesc}>Allow Kairo to read and triage your emails.</Text>
          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>Connect Gmail</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Google Drive</Text>
            <View style={[styles.badge, styles.badgeDisconnected]}>
              <Text style={styles.badgeText}>Not Connected</Text>
            </View>
          </View>
          <Text style={styles.cardDesc}>Sync your documents and study materials.</Text>
          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>Connect Drive</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Slack</Text>
            <View style={[styles.badge, styles.badgeDisconnected]}>
              <Text style={styles.badgeText}>Not Connected</Text>
            </View>
          </View>
          <Text style={styles.cardDesc}>Let Kairo monitor your messages for important updates.</Text>
          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>Connect Slack</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  content: { padding: 16 },
  header: { fontSize: 32, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#888888', marginBottom: 24 },
  card: { backgroundColor: '#1C1C1E', borderRadius: 16, padding: 16, marginBottom: 16 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#FFFFFF' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeDisconnected: { backgroundColor: '#3A3A3C' },
  badgeText: { color: '#A1A1A6', fontSize: 12, fontWeight: '500' },
  cardDesc: { fontSize: 14, color: '#A1A1A6', marginBottom: 16, lineHeight: 20 },
  button: { backgroundColor: '#2C2C2E', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
});
