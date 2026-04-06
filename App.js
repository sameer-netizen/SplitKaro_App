import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  const [updateState, setUpdateState] = useState('idle'); // idle | checking | downloading

  useEffect(() => {
    const syncUpdates = async () => {
      try {
        // Only check in builds with expo-updates enabled.
        if (!Updates.isEnabled) return;
        setUpdateState('checking');
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          setUpdateState('downloading');
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch {
        // Keep app usable if update check fails.
      } finally {
        setUpdateState('idle');
      }
    };

    syncUpdates();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <StatusBar style="light" backgroundColor="#1B5E20" />
          <AppNavigator />

          {updateState !== 'idle' && (
            <View style={styles.updateOverlay} pointerEvents="none">
              <View style={styles.updateCard}>
                <ActivityIndicator size="small" color="#1B5E20" />
                <Text style={styles.updateTitle}>
                  {updateState === 'checking' ? 'Checking for updates...' : 'Updating app...'}
                </Text>
                <Text style={styles.updateSubtext}>Please keep the app open.</Text>
              </View>
            </View>
          )}
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  updateOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    alignItems: 'center',
    paddingTop: 56,
    zIndex: 999,
  },
  updateCard: {
    minWidth: 240,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
    alignItems: 'center',
  },
  updateTitle: {
    marginTop: 8,
    color: '#1B5E20',
    fontWeight: '700',
    fontSize: 14,
  },
  updateSubtext: {
    marginTop: 4,
    color: '#5F6368',
    fontSize: 12,
  },
});
