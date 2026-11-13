import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Linking, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../../../supabase';

const BASE_URL = 'https://api.kairomtz.com';
const PAT_KEY = 'kairo.github_pat';
const PROVIDER_NAME_KEY = 'kairo.provider_name';
const PROVIDER_KEY = 'kairo.provider_key';

const PROVIDER_OPTIONS = [
  { id: 'deepseek',   label: 'DeepSeek' },
  { id: 'openai',     label: 'OpenAI' },
  { id: 'openrouter', label: 'OpenRouter' },
  { id: 'ollama',     label: 'Ollama (local)' },
  { id: 'gemini',     label: 'Gemini' },
] as const;

type Mode = 'self_heal' | 'external' | 'feature';
type Stage = 0 | 1 | 2 | 3 | 4;

interface DispatchResult {
  status: 'idle' | 'processing' | 'done' | 'pending_review' | 'error';
  error?: string;
  reply?: string;
  prUrl?: string;
}

export default function BuildScreen() {
  const [mode, setMode] = useState<Mode>('external');
  const [demand, setDemand] = useState('');
  const [repo, setRepo] = useState('');
  const [filePath, setFilePath] = useState('README.md');
  const [branch, setBranch] = useState('main');
  const [pat, setPat] = useState('');
  const [savedPat, setSavedPat] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>(0);
  const [result, setResult] = useState<DispatchResult>({ status: 'idle' });
  const [busy, setBusy] = useState(false);
  const [providerName, setProviderName] = useState<string>('');
  const [providerKey, setProviderKey] = useState<string>('');
  const [byokOpen, setByokOpen] = useState<boolean>(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    (async () => {
      try { const s = await SecureStore.getItemAsync(PAT_KEY); if (s) setSavedPat(s); } catch {}
      try {
        const n = await SecureStore.getItemAsync(PROVIDER_NAME_KEY);
        const k = await SecureStore.getItemAsync(PROVIDER_KEY);
        if (n) setProviderName(n);
        if (k) setProviderKey(k);
      } catch {}
    })();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const stopPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };

  const getJwt = async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No active session');
    return session.access_token;
  };

  const submitCanonical = async (prompt: string) => {
    setBusy(true); setStage(1); setResult({ status: 'processing' });
    try {
      const jwt = await getJwt();
      const res = await fetch(`${BASE_URL}/api/talk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify(
        (() => {
          const _b: any = { message: prompt, context: {}, no_merge: false };
          _b.self_heal = mode === 'self_heal';
          if (mode !== 'self_heal' && providerName.trim() && providerKey.trim()) {
            _b.provider_config = {
              provider: providerName.trim(),
              api_key:  providerKey.trim(),
            };
          }
          return _b;
        })()
      ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Dispatch failed');
      if (!data.talk_id) throw new Error('No talk_id returned');
      pollCanonical(String(data.talk_id));
    } catch (err) {
      setBusy(false);
      setResult({ status: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  };

  const pollCanonical = (talkId: string) => {
    let polls = 0; stopPoll();
    pollRef.current = setInterval(async () => {
      polls += 1;
      if (polls > 150) { stopPoll(); setBusy(false); setResult({ status: 'error', error: 'Build timed out.' }); return; }
      try {
        const jwt = await getJwt();
        const res = await fetch(`${BASE_URL}/api/talk-status?id=${encodeURIComponent(talkId)}`, {
          headers: { Authorization: `Bearer ${jwt}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.demand_id) { pollRegister(String(data.demand_id)); return; }
        if (data.status === 'done') {
          stopPoll(); setBusy(false);
          const reply = String(data.reply ?? '');
          const m = reply.match(/https:\/\/github\.com\/[^\s)]+/);
          if (m) {
            setStage(4);
            setResult({ status: 'done', reply, prUrl: m[0] });
          } else {
            setStage(0);
            setResult({ status: 'error', error: reply || 'Kairo declined to act on this request.' });
          }
        } else if (data.status === 'error') {
          stopPoll(); setBusy(false);
          setResult({ status: 'error', error: String(data.error ?? 'unknown error') });
        }
      } catch { /* transient */ }
    }, 2000);
  };

  const pollRegister = (demandId: string) => {
    stopPoll();
    let polls = 0;
    pollRef.current = setInterval(async () => {
      polls += 1;
      if (polls > 200) { stopPoll(); setBusy(false); setResult({ status: 'error', error: 'Review pending — merge not yet approved. Check the PR.' }); return; }
      try {
        const jwt = await getJwt();
        const res = await fetch(`${BASE_URL}/api/status?id=${encodeURIComponent(demandId)}`, {
          headers: { Authorization: `Bearer ${jwt}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.error_type) {
          stopPoll(); setBusy(false); setStage(0);
          setResult({ status: 'error', error: `Failed (${data.error_type}). Check logs or retry.` });
          return;
        }
        if (data.merged_at) { stopPoll(); setBusy(false); setStage(4); setResult({ status: 'done', reply: 'Merged and deployed.', prUrl: data.pr_url }); return; }
        if (data.q3_approved) { setStage(4); setResult({ status: 'processing', prUrl: data.pr_url }); return; }
        if (data.test_passed) { setStage(3); return; }
        if (data.q1_success) { setStage(2); return; }
        setStage(1);
      } catch { /* transient */ }
    }, 3000);
  };

  const submitExternal = async () => {
    setBusy(true); setStage(1); setResult({ status: 'processing' });
    try {
      const jwt = await getJwt();
      const effectivePat = (pat || savedPat || '').trim();
      if (!effectivePat) throw new Error('GitHub PAT required');
      if (!repo.trim() || !filePath.trim() || !demand.trim()) throw new Error('repo, file_path, and demand are required');
      try { await SecureStore.setItemAsync(PAT_KEY, effectivePat); setSavedPat(effectivePat); setPat(''); } catch {}
      const res = await fetch(`${BASE_URL}/external-dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({
          repo: repo.trim(),
          file_path: filePath.trim(),
          base_branch: branch.trim() || undefined,
          demand: demand.trim(),
          pat: effectivePat,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'External dispatch failed');
      if (!data.dispatch_id) throw new Error('No dispatch_id returned');
      pollExternal(String(data.dispatch_id));
    } catch (err) {
      setBusy(false);
      setResult({ status: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  };

  const pollExternal = (dispatchId: string) => {
    let polls = 0; stopPoll();
    pollRef.current = setInterval(async () => {
      polls += 1;
      if (polls > 150) { stopPoll(); setBusy(false); setResult({ status: 'error', error: 'External dispatch timed out.' }); return; }
      try {
        const jwt = await getJwt();
        const res = await fetch(`${BASE_URL}/api/external-status?id=${encodeURIComponent(dispatchId)}`, {
          headers: { Authorization: `Bearer ${jwt}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const st = String(data.status ?? '');
        const r: { ok?: boolean; pr_url?: string; test_gate?: boolean; error?: string } =
          (data.result && typeof data.result === 'object') ? data.result : {};
        if (r.test_gate) setStage(2);
        if (r.pr_url) setStage(3);
        if (st === 'done') {
          stopPoll(); setBusy(false); setStage(4);
          setResult({ status: 'done', reply: r.ok ? 'Merged.' : 'Completed.', prUrl: r.pr_url });
        } else if (st === 'error') {
          stopPoll(); setBusy(false);
          setResult({ status: 'error', error: String(r.error || 'external dispatch error') });
        }
      } catch { /* transient */ }
    }, 3000);
  };

  const handleSubmit = () => {
    if (busy) return;
    if (mode === 'external') return submitExternal();

    // Persist BYOK if both fields non-empty (best-effort; ignore storage errors)
    if (providerName.trim() && providerKey.trim()) {
      (async () => {
        try {
          await SecureStore.setItemAsync(PROVIDER_NAME_KEY, providerName.trim());
          await SecureStore.setItemAsync(PROVIDER_KEY, providerKey.trim());
        } catch {}
      })();
    }
    const hint = mode === 'self_heal'
      ? `Self-heal request: ${demand.trim()}\n\nUse list_kairo_repo_files to identify the relevant file, then call trigger_canonical_dispatch.`
      : `Feature request: ${demand.trim()}\n\nUse list_kairo_repo_files to identify the relevant file, then call trigger_canonical_dispatch.`;
    return submitCanonical(hint);
  };

  const disabled = busy || (mode === 'external'
    ? !repo.trim() || !filePath.trim() || !demand.trim() || (!pat.trim() && !savedPat)
    : !demand.trim());

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>Build</Text>
        <Text style={styles.subtitle}>Trigger autonomous code changes.</Text>

        <View style={styles.segmentRow}>
          {(['external', 'feature'] as Mode[]).map((m) => (
            <TouchableOpacity key={m}
              style={[styles.segment, mode === m && styles.segmentActive]}
              onPress={() => { if (!busy) { setMode(m); setStage(0); setResult({ status: 'idle' }); } }}>
              <Text style={[styles.segmentText, mode === m && styles.segmentTextActive]}>
                {m === 'external' ? 'Fix App' : 'Feature'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {mode === 'self_heal' && (
          <View style={styles.segmentRow}>
            <TouchableOpacity
              style={[styles.segment, styles.segmentActive, { flex: 1 }]}
              onPress={() => {
                if (busy) return;
                setMode('external');
                setDemand('');
                setStage(0);
                setResult({ status: 'idle' });
              }}>
              <Text style={[styles.segmentText, styles.segmentTextActive]}>
                Self-Heal (auto-triggered) — tap to exit
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {mode === 'external' && (
          <>
            <Text style={styles.label}>Repo URL</Text>
            <TextInput style={styles.input} value={repo} onChangeText={setRepo}
              placeholder="https://github.com/owner/repo" placeholderTextColor="#888"
              autoCapitalize="none" autoCorrect={false} />
            <Text style={styles.label}>File Path</Text>
            <TextInput style={styles.input} value={filePath} onChangeText={setFilePath}
              placeholder="e.g., README.md" placeholderTextColor="#888"
              autoCapitalize="none" autoCorrect={false} />
            <Text style={styles.label}>Branch</Text>
            <TextInput style={styles.input} value={branch} onChangeText={setBranch}
              placeholder="main" placeholderTextColor="#888"
              autoCapitalize="none" autoCorrect={false} />
            <Text style={styles.label}>GitHub PAT {savedPat ? '(saved — leave blank to reuse)' : ''}</Text>
            <TextInput style={styles.input} value={pat} onChangeText={setPat}
              placeholder={savedPat ? '••••••••  saved' : 'ghp_...'}
              placeholderTextColor="#888" autoCapitalize="none" autoCorrect={false}
              secureTextEntry />
          </>
        )}

        {mode !== 'self_heal' && (
          <Text style={styles.label}>
            {mode === 'feature' ? 'What feature do you want?' : 'What should be fixed?'}
          </Text>
        )}
        <TextInput style={[styles.input, styles.textArea, mode === 'self_heal' && styles.inputReadonly]}
          value={demand} onChangeText={mode === 'self_heal' ? undefined : setDemand}
          editable={mode !== 'self_heal'}
          placeholder={mode === 'feature' ? 'Describe the request...' : 'Describe the issue or request...'}
          placeholderTextColor="#888" multiline />

        {/* V21.4.B3 — BYOK accordion (advanced); hidden in Self-Heal (local coder) */}
        {mode !== 'self_heal' && (
          <>
        <TouchableOpacity
          onPress={() => setByokOpen(!byokOpen)}
          style={styles.byokHeader}
        >
          <Text style={styles.byokHeaderText}>
            {byokOpen ? '\u25BC' : '\u25B6'} Advanced: Bring Your Own API Key
            {providerName && providerKey ? ' (set)' : ''}
          </Text>
        </TouchableOpacity>

        {byokOpen && (
          <View style={styles.byokBody}>
            <Text style={styles.label}>Provider</Text>
            <View style={styles.providerRow}>
              {PROVIDER_OPTIONS.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.providerChip,
                    providerName === p.id && styles.providerChipActive,
                  ]}
                  onPress={() => setProviderName(p.id)}
                >
                  <Text
                    style={[
                      styles.providerChipText,
                      providerName === p.id && styles.providerChipTextActive,
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>
              API Key {providerKey ? '(saved)' : ''}
            </Text>
            <TextInput
              style={styles.input}
              value={providerKey}
              onChangeText={setProviderKey}
              placeholder="sk-..."
              placeholderTextColor="#888"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />

            <TouchableOpacity
              onPress={async () => {
                try {
                  await SecureStore.deleteItemAsync(PROVIDER_NAME_KEY);
                  await SecureStore.deleteItemAsync(PROVIDER_KEY);
                } catch {}
                setProviderName('');
                setProviderKey('');
              }}
              style={styles.byokClearButton}
            >
              <Text style={styles.byokClearText}>Clear BYOK (use service keys)</Text>
            </TouchableOpacity>
          </View>
        )}
          </>
        )}

        <TouchableOpacity style={[styles.button, disabled && styles.buttonDisabled]}
          onPress={handleSubmit} disabled={disabled}>
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Dispatch to Engine</Text>}
        </TouchableOpacity>

        {stage > 0 && <StagesTracker stage={stage} busy={busy} />}

        {result.status !== 'idle' && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>
              {result.status === 'processing' ? 'Working…'
                : result.status === 'done' ? 'Complete'
                : result.status === 'pending_review' ? 'Ready for Review'
                : 'Failed'}
            </Text>
            {result.error ? <Text style={styles.resultText}>{result.error}</Text> : null}
            {result.reply ? <Text style={styles.resultText}>{result.reply}</Text> : null}
            {result.prUrl ? (
              <TouchableOpacity style={styles.prButton} onPress={() => Linking.openURL(result.prUrl as string)}>
                <Text style={styles.prButtonText}>View Pull Request</Text>
              </TouchableOpacity>
            ) : null}
            {result.status === 'error' ? (
              <TouchableOpacity
                style={[styles.prButton, { backgroundColor: '#FF9500', marginTop: 8 }]}
                onPress={() => {
                  setMode('self_heal');
                  const err = result.error ?? 'unknown error';
                  setDemand(`The previous action failed with this error: ${err}. Investigate the codebase to identify the file most likely to generate this error. Use list_kairo_repo_files to search, then call trigger_canonical_dispatch with that target_file (do not guess; verify the file exists). Do not set no_merge; if the Docker gate and tests pass, merge automatically so the fix is live for retest.`);
                  setResult({ status: 'idle' });
                  setStage(0);
                }}>
                <Text style={[styles.prButtonText, { color: '#FFFFFF' }]}>Send Error to Self-Heal</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StagesTracker({ stage, busy }: { stage: Stage; busy: boolean }) {
  const items = [
    { id: 1, icon: '⏳', label: 'Q1: Editing code (LLM working)…' },
    { id: 2, icon: '🧪', label: 'Q2: Running tests in sandbox…' },
    { id: 3, icon: '👤', label: 'Q3: Pending human review (PR opened)…' },
    { id: 4, icon: '✅', label: 'Q4: Merged and deployed.' },
  ];
  return (
    <View style={styles.stagesCard}>
      {items.map((it) => {
        const isActive = stage === it.id;
        const isDone = stage > it.id;
        return (
          <View key={it.id} style={styles.stageRow}>
            <Text style={[styles.stageIcon, !isActive && !isDone && styles.stageDim]}>{it.icon}</Text>
            <Text style={[styles.stageLabel, isActive && styles.stageActive, isDone && styles.stageDone]}>{it.label}</Text>
            {isActive && busy ? <ActivityIndicator size="small" color="#007AFF" /> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  content: { padding: 16, paddingBottom: 48 },
  header: { fontSize: 32, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#888888', marginBottom: 16 },
  segmentRow: { flexDirection: 'row', marginBottom: 20, backgroundColor: '#1C1C1E', borderRadius: 12, padding: 4 },
  segment: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  segmentActive: { backgroundColor: '#007AFF' },
  segmentText: { color: '#A1A1A6', fontSize: 14, fontWeight: '600' },
  segmentTextActive: { color: '#FFFFFF' },
  label: { color: '#A1A1A6', fontSize: 14, marginBottom: 8, fontWeight: '500' },
  input: { backgroundColor: '#1C1C1E', color: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 16, fontSize: 16 },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  inputReadonly: { opacity: 0.85, borderWidth: 1, borderColor: '#FF9500' },
  button: { backgroundColor: '#007AFF', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { backgroundColor: '#333333' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  stagesCard: { marginTop: 24, backgroundColor: '#1C1C1E', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#2C2C2E' },
  stageRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  stageIcon: { fontSize: 18, marginRight: 12 },
  stageDim: { opacity: 0.3 },
  stageLabel: { color: '#666', fontSize: 14, flex: 1 },
  stageActive: { color: '#FFFFFF', fontWeight: '600' },
  stageDone: { color: '#34C759' },
  resultCard: { marginTop: 16, backgroundColor: '#1C1C1E', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#2C2C2E' },
  resultTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  resultText: { color: '#A1A1A6', fontSize: 14, lineHeight: 20 },
  prButton: { marginTop: 16, backgroundColor: '#2C2C2E', padding: 12, borderRadius: 8, alignItems: 'center' },
  prButtonText: { color: '#007AFF', fontWeight: 'bold' },
  byokHeader: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1C1C1E',
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 4,
  },
  byokHeaderText: {
    color: '#A1A1A6',
    fontSize: 13,
    fontWeight: '600',
  },
  byokBody: {
    padding: 16,
    backgroundColor: '#1C1C1E',
    borderRadius: 8,
    marginTop: 4,
  },
  providerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  providerChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    marginRight: 8,
    marginBottom: 8,
  },
  providerChipActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  providerChipText: {
    color: '#A1A1A6',
    fontSize: 13,
  },
  providerChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  byokClearButton: {
    marginTop: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  byokClearText: {
    color: '#FF453A',
    fontSize: 13,
  },
});
