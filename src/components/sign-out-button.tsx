import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { supabase } from '../../supabase';

export function SignOutButton() {
  const handleSignOut = async () => {
    console.log('[signout] tapped');
    try {
      // scope:'local' clears the persisted session WITHOUT a network call, so
      // SIGNED_OUT fires immediately and the auth gate can flip.
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) console.log('[signout] local signout error:', error.message);
    } catch (e) {
      console.log('[signout] local signout threw:', e instanceof Error ? e.message : String(e));
    }
    console.log('[signout] navigating to /login');
    router.replace('/login');
  };

  return (
    <Pressable onPress={handleSignOut} hitSlop={12} style={styles.button}>
      <Text style={styles.text}>Sign Out</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { paddingHorizontal: 12, paddingVertical: 6 },
  text: { color: '#FF453A', fontSize: 14, fontWeight: '600' },
});
