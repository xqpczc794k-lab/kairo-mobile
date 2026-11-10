import React, { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../../../supabase';

const BASE_URL = 'https://api.kairomtz.com';

export default function BuildScreen() {
  const [targetFile, setTargetFile] = useState('README.md');
  const [demand, setDemand] = useState('');
  const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [resultText, setResultText] = useState('');
  const [prUrl, setPrUrl] = useState<string | null>(null);

  const pollStatus = (talkId: string) => {
    let polls = 0;
    const interval = setInterval(async () => {
      polls += 1;
      if (polls > 60) {
        // 2 minutes — generous for the README/direct-dispatch demo
        clearInterval(interval);
        setStatus('error');
        setResultText('Build timed out.');
        return;
      }
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const res = await fetch(`${BASE_URL}/api/talk-status?id=${encodeURIComponent(talkId)}`, {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        const data = await res.json();
        if (data.status === 'done') {
          clearInterval(interval);
          setStatus('done');
          setResultText(data.reply ?? '');
          const urlMatch = typeof data.reply === 'string' ? data.reply.match(/https:\/\/github\.com\/[^\s)]+/) : null;
          if (urlMatch) setPrUrl(urlMatch[0]);
        } else if (data.status === 'error') {
          clearInterval(interval);
          setStatus('error');
          setResultText(data.error ?? 'unknown error');
        }
      } catch {
        // transient — keep polling
      }
    }, 2000);
  };

  const handleDispatch = async () => {
    if (!targetFile.trim() || !demand.trim()) return;

    setStatus('processing');
    setResultText('');
    setPrUrl(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const prompt = `Dispatch a canonical demand to ${targetFile.trim()} with the following instruction: ${demand.trim()}`;

      const res = await fetch(`${BASE_URL}/api/talk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ message: prompt, context: {} }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch');
      if (!data.talk_id) throw new Error('no talk_id returned');
      pollStatus(data.talk_id);
    } catch (err) {
      setStatus('error');
      setResultText(err instanceof Error ? err.message : 'dispatch failed');
    }
  };

  const disabled = !targetFile.trim() || !demand.trim() || status === 'processing';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>Build</Text>
        <Text style={styles.subtitle}>Trigger autonomous code changes.</Text>

        <Text style={styles.label}>Target File</Text>
        <TextInput
          style={styles.input}
          value={targetFile}
          onChangeText={setTargetFile}
          placeholder="e.g., README.md"
          placeholderTextColor="#888888"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Demand / Instruction</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={demand}
          onChangeText={setDemand}
          placeholder="Describe the fix or feature..."
          placeholderTextColor="#888888"
          multiline
        />

        <TouchableOpacity
          style={[styles.button, disabled && styles.buttonDisabled]}
          onPress={handleDispatch}
          disabled={disabled}>
          {status === 'processing' ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Dispatch to Engine</Text>
          )}
        </TouchableOpacity>

        {status !== 'idle' && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>
              {status === 'processing'
                ? 'Dispatching…'
                : status === 'done'
                  ? 'Build Complete'
                  : 'Build Failed'}
            </Text>
            <Text style={styles.resultText}>{resultText}</Text>

            {prUrl && (
              <TouchableOpacity style={styles.prButton} onPress={() => Linking.openURL(prUrl)}>
                <Text style={styles.prButtonText}>View Pull Request</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  content: { padding: 16 },
  header: { fontSize: 32, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#888888', marginBottom: 24 },
  label: { color: '#A1A1A6', fontSize: 14, marginBottom: 8, fontWeight: '500' },
  input: {
    backgroundColor: '#1C1C1E',
    color: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
  },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { backgroundColor: '#333333' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  resultCard: {
    marginTop: 24,
    backgroundColor: '#1C1C1E',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  resultTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  resultText: { color: '#A1A1A6', fontSize: 14, lineHeight: 20 },
  prButton: {
    marginTop: 16,
    backgroundColor: '#2C2C2E',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  prButtonText: { color: '#007AFF', fontWeight: 'bold' },
});
