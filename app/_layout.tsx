import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { initDatabase } from '../lib/database';

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initDatabase().then(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="index" options={{ title: '101 Stats' }} />
        <Stack.Screen name="room/[roomId]/index" options={{ title: 'Oda' }} />
        <Stack.Screen name="room/[roomId]/stats" options={{ title: 'İstatistikler' }} />
        <Stack.Screen name="room/[roomId]/session/[sessionId]/index" options={{ title: 'Oyun' }} />
        <Stack.Screen name="room/[roomId]/session/[sessionId]/hand/new" options={{ title: 'Yeni El' }} />
        <Stack.Screen name="room/[roomId]/session/[sessionId]/hand/[handId]" options={{ title: 'El Detayı' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
