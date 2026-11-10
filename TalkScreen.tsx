import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { router } from 'expo-router';

import { supabase } from './supabase';

type Role = 'user' | 'assistant';

interface Message {
  id: string;
  role: Role;
  content: string;
}

interface TalkStartResponse {
  ok?: boolean;
  status?: string;
  talk_id?: string;
  error?: string;
}

interface TalkStatusResponse {
  status?: 'processing' | 'done' | 'error';
  reply?: string;
  error?: string;
}

const BASE_URL = 'https://api.kairomtz.com';
const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 150; // 5 minutes

export default function TalkScreen() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 'welcome', role: 'assistant', content: 'Hello! I am Kairo. How can I help you today?' },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const scrollRef = useRef<React.ComponentRef<typeof ScrollView> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  useEffect(
    () => () => {
      mountedRef.current = false;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    },
    [],
  );

  const appendMessage = useCallback((role: Role, content: string) => {
    if (!mountedRef.current) return;
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, role, content },
    ]);
  }, []);

  const getAccessToken = useCallback(async (forceRefresh = false): Promise<string | null> => {
    if (forceRefresh) {
      const { data } = await supabase.auth.refreshSession();
      return data.session?.access_token ?? null;
    }
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  // fetch wrapper: attaches the session JWT and retries once after a refresh on 401.
  const authFetch = useCallback(
    async (url: string, init: RequestInit = {}, retried = false): Promise<Response> => {
      const token = await getAccessToken();
      const headers: Record<string, string> = {
        ...((init.headers as Record<string, string> | undefined) ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const res = await fetch(url, { ...init, headers });
      if (res.status === 401 && !retried) {
        await getAccessToken(true);
        return authFetch(url, init, true);
      }
      return res;
    },
    [getAccessToken],
  );

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (mountedRef.current) setIsLoading(false);
  }, []);

  const pollStatus = useCallback(
    (talkId: string) => {
      let polls = 0;
      pollRef.current = setInterval(async () => {
        polls += 1;
        if (polls > MAX_POLLS) {
          stopPolling();
          appendMessage('assistant', 'This is taking longer than expected. Please try again.');
          return;
        }
        try {
          const res = await authFetch(`${BASE_URL}/api/talk-status?id=${encodeURIComponent(talkId)}`);
          const data = (await res.json()) as TalkStatusResponse;
          if (!mountedRef.current) return;
          if (data.status === 'done') {
            stopPolling();
            appendMessage('assistant', data.reply || 'I could not complete that request.');
          } else if (data.status === 'error') {
            stopPolling();
            appendMessage('assistant', `Error: ${data.error || 'unknown error'}`);
          }
        } catch {
          // transient network error — keep polling until MAX_POLLS
        }
      }, POLL_INTERVAL_MS);
    },
    [appendMessage, authFetch, stopPolling],
  );

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput('');
    appendMessage('user', text);
    setIsLoading(true);

    try {
      const res = await authFetch(`${BASE_URL}/api/talk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, context: {} }),
      });
      const data = (await res.json()) as TalkStartResponse;
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (!data.talk_id) throw new Error('no talk_id returned');
      pollStatus(data.talk_id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'network error';
      if (!mountedRef.current) return;
      setIsLoading(false);
      appendMessage('assistant', `Network Error: ${message}`);
    }
  }, [appendMessage, authFetch, input, isLoading, pollStatus]);


  const handleSignOut = async () => {
    console.log('[signout] floating button pressed!');
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) console.log('[signout] local error:', error.message);
    } catch (e) {
      console.log('[signout] error:', e instanceof Error ? e.message : String(e));
    }
    router.replace('/login');
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Talk</Text>
          <TouchableOpacity onPress={handleSignOut} hitSlop={20} style={styles.signOutButton}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          ref={scrollRef}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          contentContainerStyle={styles.scrollContent}
        >
          {messages.map((m) => (
            <View
              key={m.id}
              style={[styles.bubble, m.role === 'user' ? styles.userBubble : styles.aiBubble]}
            >
              <Text style={styles.messageText}>{m.content}</Text>
            </View>
          ))}

          {isLoading && (
            <View style={[styles.bubble, styles.aiBubble, styles.loadingBubble]}>
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text style={styles.loadingText}>Kairo is thinking…</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask Kairo anything..."
            placeholderTextColor="#888888"
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, (!input.trim() || isLoading) && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!input.trim() || isLoading}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      </SafeAreaView>

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#121212' },
  safeArea: { flex: 1, backgroundColor: '#121212' },
  container: { flex: 1, backgroundColor: '#121212' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 54,
    backgroundColor: '#121212',
  },
  headerTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: 'bold' },
  signOutButton: {
    backgroundColor: '#FF453A',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minWidth: 96,
    alignItems: 'center',
  },
  signOutText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
  scrollContent: { padding: 16, paddingBottom: 32 },
  bubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  userBubble: {
    backgroundColor: '#007AFF',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: '#2C2C2E',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  loadingBubble: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  loadingText: { color: '#B0B0B0', fontSize: 14, marginLeft: 8 },
  messageText: { color: '#FFFFFF', fontSize: 16, lineHeight: 22 },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#1C1C1E',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#2C2C2E',
    color: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 16,
    maxHeight: 120,
    minHeight: 40,
  },
  sendButton: {
    marginLeft: 12,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 20,
  },
  sendButtonDisabled: { backgroundColor: '#333333' },
  sendButtonText: { color: '#FFFFFF', fontWeight: 'bold' },
});
