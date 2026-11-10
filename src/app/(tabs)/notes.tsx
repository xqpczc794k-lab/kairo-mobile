import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../../../supabase';

interface Note {
  id: string;
  content: string;
  created_at: string;
}

export default function NotesScreen() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotes = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setNotes([]);
    } else {
      setError(null);
      setNotes((data as Note[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const addNote = async () => {
    if (!newNote.trim()) return;
    setSaving(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      Alert.alert('Error', 'No active session');
      setSaving(false);
      return;
    }

    const { error: insertError } = await supabase
      .from('notes')
      .insert([{ content: newNote.trim(), user_id: session.user.id }]);

    if (insertError) {
      Alert.alert('Error', insertError.message);
    } else {
      setNewNote('');
      await fetchNotes();
    }
    setSaving(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Notes</Text>
          <Text style={styles.headerCount}>{notes.length}</Text>
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Write a new note..."
            placeholderTextColor="#888888"
            value={newNote}
            onChangeText={setNewNote}
            multiline
          />
          <TouchableOpacity
            style={[styles.addButton, (!newNote.trim() || saving) && styles.addButtonDisabled]}
            onPress={addNote}
            disabled={!newNote.trim() || saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.addButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color="#007AFF" style={styles.loader} />
        ) : error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Notes table unavailable</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorHint}>
              Run the `notes` SQL in Supabase (SQL Editor) to create the table + RLS policy.
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchNotes}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={notes}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={styles.noteCard}>
                <Text style={styles.noteText}>{item.content}</Text>
                <Text style={styles.noteDate}>
                  {new Date(item.created_at).toLocaleString()}
                </Text>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>No notes yet. Write one above!</Text>}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  headerTitle: { fontSize: 32, fontWeight: 'bold', color: '#FFFFFF' },
  headerCount: { color: '#8A8A8E', fontSize: 16, fontWeight: '600' },
  inputContainer: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#1C1C1E',
  },
  input: {
    flex: 1,
    backgroundColor: '#2C2C2E',
    color: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    minHeight: 44,
    maxHeight: 120,
    fontSize: 16,
  },
  addButton: {
    marginLeft: 12,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonDisabled: { backgroundColor: '#333333' },
  addButtonText: { color: '#FFFFFF', fontWeight: 'bold' },
  loader: { marginTop: 40 },
  listContent: { padding: 16 },
  noteCard: { backgroundColor: '#1C1C1E', padding: 16, borderRadius: 12, marginBottom: 12 },
  noteText: { color: '#FFFFFF', fontSize: 16, lineHeight: 22 },
  noteDate: { color: '#888888', fontSize: 12, marginTop: 8 },
  emptyText: { color: '#888888', textAlign: 'center', marginTop: 40, fontSize: 16 },
  errorCard: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#FF453A55',
  },
  errorTitle: { color: '#FF453A', fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  errorText: { color: '#FFFFFF', fontSize: 13, marginBottom: 8 },
  errorHint: { color: '#A1A1A6', fontSize: 12, lineHeight: 18, marginBottom: 12 },
  retryButton: {
    backgroundColor: '#2C2C2E',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  retryText: { color: '#007AFF', fontWeight: '600' },
});
