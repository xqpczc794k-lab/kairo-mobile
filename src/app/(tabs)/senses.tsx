import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { supabase } from '../../../supabase';

const BASE_URL = 'https://api.kairomtz.com';
const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 60000;

type Phase = 'idle' | 'starting' | 'waiting' | 'connected' | 'error';

interface StartResponse {
  authorize_url: string;
  state: string;
}

interface StatusResponse {
  status: 'pending' | 'connected' | 'error' | 'consumed_no_token' | 'unknown';
  email?: string;
  scopes?: string[];
  connected_at?: number;
  error?: string;
}

interface GoogleInfo {
  email?: string;
  scopes?: string[];
}

export default function SensesScreen() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [info, setInfo] = useState<GoogleInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef<boolean>(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollTimer.current) {
        clearTimeout(pollTimer.current);
        pollTimer.current = null;
      }
    };
  }, []);

  const pollStatus = async (state: string, deadline: number) => {
    if (!mountedRef.current) return;
    if (Date.now() > deadline) {
      setPhase('error');
      setError('Connection timed out. Please try again.');
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (mountedRef.current) { setPhase('error'); setError('No active session'); }
        return;
      }
      const res = await fetch(`${BASE_URL}/api/oauth/google/status?state=${encodeURIComponent(state)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        if (mountedRef.current) { setPhase('error'); setError(`Status check failed (HTTP ${res.status})`); }
        return;
      }
      const data: StatusResponse = await res.json();
      if (!mountedRef.current) return;
      if (data.status === 'connected') {
        setPhase('connected');
        setInfo({ email: data.email, scopes: data.scopes });
        setError(null);
        return;
      }
      if (data.status === 'error') {
        setPhase('error');
        setError(data.error || 'Google returned an error');
        return;
      }
      pollTimer.current = setTimeout(() => pollStatus(state, deadline), POLL_INTERVAL_MS);
    } catch (e) {
      if (mountedRef.current) {
        setPhase('error');
        setError(e instanceof Error ? e.message : 'Network error');
      }
    }
  };

  const connectGoogle = async () => {
    if (phase === 'starting' || phase === 'waiting') return;
    setPhase('starting');
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setPhase('error');
        setError('No active session');
        return;
      }
      const res = await fetch(`${BASE_URL}/api/oauth/google/start`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        setPhase('error');
        setError(`Start failed (HTTP ${res.status})`);
        return;
      }
      const data: StartResponse = await res.json();
      if (!data.authorize_url || !data.state) {
        setPhase('error');
        setError('Server returned an incomplete start response');
        return;
      }
      setPhase('waiting');
      await openBrowserAsync(data.authorize_url, {
        presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
      });
      const deadline = Date.now() + POLL_TIMEOUT_MS;
      void pollStatus(data.state, deadline);
    } catch (e) {
      setPhase('error');
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
  };

  const isConnected = phase === 'connected';
  const isBusy = phase === 'starting' || phase === 'waiting';
  const badgeLabel = isConnected ? 'Connected' : isBusy ? 'Connecting…' : 'Not Connected';
  const badgeStyle = isConnected ? styles.badgeConnected : isBusy ? styles.badgePending : styles.badgeDisconnected;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>Senses</Text>
        <Text style={styles.subtitle}>Kairo&apos;s connection to your digital world.</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Gmail</Text>
            <View style={[styles.badge, badgeStyle]}>
              <Text style={styles.badgeText}>{badgeLabel}</Text>
            </View>
          </View>
          <Text style={styles.cardDesc}>Allow Kairo to read and triage your emails.</Text>
          {isConnected && info?.email ? <Text style={styles.cardMeta}>{info.email}</Text> : null}
          <TouchableOpacity
            style={[styles.button, isBusy ? styles.buttonDisabled : null]}
            onPress={connectGoogle}
            disabled={isBusy}
          >
            {isBusy ? <ActivityIndicator color="#FFFFFF" /> : (
              <Text style={styles.buttonText}>{isConnected ? 'Reconnect Gmail' : 'Connect Gmail'}</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Google Drive</Text>
            <View style={[styles.badge, badgeStyle]}>
              <Text style={styles.badgeText}>{badgeLabel}</Text>
            </View>
          </View>
          <Text style={styles.cardDesc}>Sync your documents and study materials.</Text>
          <Text style={styles.cardHint}>Included with the Gmail connection above.</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Slack</Text>
            <View style={[styles.badge, styles.badgeDisconnected]}>
              <Text style={styles.badgeText}>Not Connected</Text>
            </View>
          </View>
          <Text style={styles.cardDesc}>Let Kairo monitor your messages for important updates.</Text>
          <Text style={styles.cardHint}>Coming soon.</Text>
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
  cardMeta: { fontSize: 13, color: '#A1A1A6', marginBottom: 8 },
  cardHint: { fontSize: 13, color: '#6E6E73', fontStyle: 'italic' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeDisconnected: { backgroundColor: '#3A3A3C' },
  badgePending: { backgroundColor: '#3A3A3C' },
  badgeConnected: { backgroundColor: '#1F4E3D' },
  badgeText: { color: '#A1A1A6', fontSize: 12, fontWeight: '500' },
  cardDesc: { fontSize: 14, color: '#A1A1A6', marginBottom: 16, lineHeight: 20 },
  button: { backgroundColor: '#2C2C2E', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  errorText: { color: '#FF6B6B', fontSize: 14, marginBottom: 16, lineHeight: 20 },
});
