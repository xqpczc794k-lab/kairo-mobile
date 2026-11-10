import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../../../supabase';

interface Flashcard {
  question?: string;
  answer?: string;
}

interface KnowledgeData {
  status?: string;
  math_score?: number;
  flashcards_due?: number;
  flashcards?: Flashcard[];
}

const BASE_URL = 'https://api.kairomtz.com';
const SAMPLE_CARD: Flashcard = {
  question: 'What is the MTZ framework?',
  answer: 'Mediated Transitional Zone — the architecture powering Kairo.',
};

export default function KnowledgeScreen() {
  const [data, setData] = useState<KnowledgeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reveal, setReveal] = useState<Record<number, boolean>>({});

  const fetchKnowledge = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const res = await fetch(`${BASE_URL}/api/knowledge`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as KnowledgeData;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to load knowledge hub');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKnowledge();
  }, [fetchKnowledge]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#007AFF" size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Knowledge Hub unavailable</Text>
        <Text style={styles.errorDetail}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchKnowledge}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (data?.status === 'not_connected') {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No knowledge hub data connected yet.</Text>
      </View>
    );
  }

  const cards: Flashcard[] = Array.isArray(data?.flashcards) && data?.flashcards.length ? data!.flashcards! : [SAMPLE_CARD];
  const isSample = !(Array.isArray(data?.flashcards) && data?.flashcards.length);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>Knowledge Hub</Text>
        <Text style={styles.subtitle}>Your academic progress and flashcards.</Text>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Math Score</Text>
          <Text style={styles.statValue}>{data?.math_score ?? 0}%</Text>
        </View>

        <Text style={styles.sectionTitle}>Flashcards Due ({data?.flashcards_due ?? 0})</Text>

        {cards.map((card, index) => (
          <TouchableOpacity
            key={`${card.question ?? 'card'}-${index}`}
            style={styles.flashcard}
            onPress={() => setReveal((prev) => ({ ...prev, [index]: !prev[index] }))}>
            {isSample && index === 0 && <Text style={styles.sampleBadge}>Sample flashcard (demo)</Text>}
            <Text style={styles.flashcardQ}>{card.question ?? 'Untitled card'}</Text>
            {reveal[index] ? (
              <Text style={styles.flashcardA}>{card.answer ?? 'No answer provided.'}</Text>
            ) : (
              <Text style={styles.tapToReveal}>Tap to reveal answer</Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  center: { flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center', padding: 24 },
  content: { padding: 16 },
  header: { fontSize: 32, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#888888', marginBottom: 24 },
  statCard: {
    backgroundColor: '#007AFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  statLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 16, marginBottom: 8 },
  statValue: { color: '#FFFFFF', fontSize: 48, fontWeight: 'bold' },
  sectionTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '600', marginBottom: 16 },
  flashcard: {
    backgroundColor: '#1C1C1E',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    marginBottom: 12,
  },
  sampleBadge: { color: '#8A8A8E', fontSize: 11, marginBottom: 8, textTransform: 'uppercase' },
  flashcardQ: { color: '#FFFFFF', fontSize: 18, fontWeight: '500', marginBottom: 12 },
  flashcardA: { color: '#34C759', fontSize: 16, marginTop: 12 },
  tapToReveal: { color: '#888888', fontSize: 14, fontStyle: 'italic' },
  emptyText: { color: '#888888', fontSize: 16, textAlign: 'center' },
  errorDetail: { color: '#FF453A', fontSize: 12, marginTop: 8, marginBottom: 16, textAlign: 'center' },
  retryButton: {
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: { color: '#007AFF', fontWeight: '600' },
});
