import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Button, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { SessionProvider } from '@/features/auth/session';
import { databaseStartupMessage, initializeDatabase } from '@/features/auth/database-startup';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [databaseState, setDatabaseState] = useState<'loading' | 'ready' | string>('loading');
  const [attempt, setAttempt] = useState(0);
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
    ...MaterialCommunityIcons.font,
  });

  useEffect(() => {
    if ((fontsLoaded || fontError) && databaseState !== 'loading') {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, databaseState]);

  useEffect(() => {
    let active = true;
    void initializeDatabase().then(
      () => {
        if (active) setDatabaseState('ready');
      },
      (error: unknown) => {
        if (active) setDatabaseState(databaseStartupMessage(error));
      },
    );
    return () => {
      active = false;
    };
  }, [attempt]);

  if ((!fontsLoaded && !fontError) || databaseState === 'loading') {
    return null;
  }

  if (databaseState !== 'ready') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <Text accessibilityRole="alert">{databaseState}</Text>
        <Button
          title="Tentar novamente"
          onPress={() => {
            setDatabaseState('loading');
            setAttempt((value) => value + 1);
          }}
        />
      </View>
    );
  }

  // O quadro de desenho (#9) e a assinatura do TCLE (#21) usam gestos, que só
  // funcionam dentro desta raiz.
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SessionProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </SessionProvider>
    </GestureHandlerRootView>
  );
}
