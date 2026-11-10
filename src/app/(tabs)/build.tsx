import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function BuildScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Build</Text>
      <Text style={styles.subtitle}>Coming in Phase 3…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 32, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#888888' },
});
