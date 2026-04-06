import { useState, useEffect } from 'react';
import { AppState } from 'react-native';
import * as Network from 'expo-network';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { enqueueExpense, syncOfflineExpenses } from '../utils/syncOfflineExpenses';

const QUEUE_KEY = '@splitkaro_pending_expenses';

/**
 * Hook that tracks online status and manages offline expense queue.
 * Automatically syncs queued expenses when connectivity is restored.
 */
export function useOfflineQueue() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  const refreshStatus = async () => {
    try {
      const state = await Network.getNetworkStateAsync();
      const online = !!(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(online);
      if (online) {
        const synced = await syncOfflineExpenses();
        if (synced > 0) console.log(`[offline] synced ${synced} expense(s)`);
      }
    } catch {
      // If expo-network fails, assume online
      setIsOnline(true);
    }
    // Refresh pending count
    try {
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      setPendingCount(raw ? JSON.parse(raw).length : 0);
    } catch {}
  };

  useEffect(() => {
    refreshStatus();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshStatus();
    });
    return () => sub.remove();
  }, []);

  const addToQueue = async (expense) => {
    const newCount = await enqueueExpense(expense);
    setPendingCount(newCount);
  };

  return { isOnline, pendingCount, addToQueue, refreshStatus };
}
