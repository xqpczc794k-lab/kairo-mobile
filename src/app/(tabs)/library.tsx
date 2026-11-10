import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';

import { supabase } from '../../../supabase';

interface DocumentRow {
  id: string;
  name: string;
  url: string;
  created_at: string;
}

const BUCKET = 'library';

export default function LibraryScreen() {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setDocuments([]);
    } else {
      setError(null);
      setDocuments((data as DocumentRow[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const pickAndUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert('Error', 'No active session');
        return;
      }

      setUploading(true);

      const response = await fetch(asset.uri);
      const arrayBuffer = await response.arrayBuffer();

      const safeName = asset.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${session.user.id}/${Date.now()}_${safeName}`;

      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, {
        contentType: asset.mimeType ?? 'application/octet-stream',
        upsert: false,
      });
      if (uploadError) throw new Error(uploadError.message);

      const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

      const { error: insertError } = await supabase.from('documents').insert([
        { user_id: session.user.id, name: asset.name, url: publicUrlData.publicUrl },
      ]);
      if (insertError) throw new Error(insertError.message);

      await fetchDocuments();
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'unknown error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Library</Text>
        <Text style={styles.headerCount}>{documents.length}</Text>
      </View>

      <TouchableOpacity
        style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
        onPress={pickAndUpload}
        disabled={uploading}>
        {uploading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.uploadButtonText}>+ Upload Document</Text>
        )}
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator color="#007AFF" style={styles.loader} />
      ) : error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Library data unavailable</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorHint}>
            Create the `library` bucket in Supabase Storage and run the `documents` SQL.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchDocuments}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={documents}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.docCard}>
              <View style={styles.docInfo}>
                <Text style={styles.docName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.docDate}>{new Date(item.created_at).toLocaleString()}</Text>
              </View>
              <TouchableOpacity style={styles.openButton} onPress={() => Linking.openURL(item.url)}>
                <Text style={styles.openText}>Open</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No documents yet. Upload a PDF, image, or text file.</Text>
          }
        />
      )}
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
  uploadButton: {
    margin: 16,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  uploadButtonDisabled: { backgroundColor: '#333333' },
  uploadButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  loader: { marginTop: 40 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1C1C1E',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  docInfo: { flex: 1, paddingRight: 12 },
  docName: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  docDate: { color: '#888888', fontSize: 12, marginTop: 4 },
  openButton: {
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  openText: { color: '#007AFF', fontWeight: '600' },
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
