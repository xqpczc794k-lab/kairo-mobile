import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

// TODO: replace with the real values from Supabase → Settings → API.
// The anon key is safe to ship in the app (it is a public key).
const supabaseUrl = 'https://efkcjicyzuxorikfgcbk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVma2NqaWN5enV4b3Jpa2ZnY2JrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQzMjYyNDEsImV4cCI6MjEwOTkwMjI0MX0.u5OyQ8hGJ1_H5M0F7klNu0kpII7Z5l3XMq9VOC6vsto';

// SecureStore is native-only; the web bundle (and any Node export) must not
// touch it. EAS iOS builds compile a web bundle too, and expo-secure-store
// throws in Node ("getValueWithKeyAsync is not a function").
const authStorage = Platform.OS === 'web' ? undefined : ExpoSecureStoreAdapter;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    ...(authStorage ? { storage: authStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
