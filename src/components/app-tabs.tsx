import { NativeTabs } from 'expo-router/native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Talk</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="message.fill" md="chat" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="senses">
        <NativeTabs.Trigger.Label>Senses</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="eye.fill" md="visibility" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="build">
        <NativeTabs.Trigger.Label>Build</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="hammer.fill" md="build" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="notes">
        <NativeTabs.Trigger.Label>Notes</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="note.text" md="note" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="library">
        <NativeTabs.Trigger.Label>Library</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="books.vertical.fill" md="menu_book" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="knowledge">
        <NativeTabs.Trigger.Label>Knowledge</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="graduationcap.fill" md="school" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
