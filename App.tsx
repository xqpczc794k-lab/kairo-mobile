import React from 'react';

import TalkScreen from './TalkScreen';

// NOTE: this project is an Expo Router app (`"main": "expo-router/entry"`),
// so the real entry is src/app/index.tsx (which also renders TalkScreen).
// This file is kept for reference/compatibility with a classic App.tsx entry.
export default function App() {
  return <TalkScreen />;
}
