import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';

const QUEUE_KEY = '@splitkaro_pending_expenses';

/**
 * Retrieve all queued offline expenses.
 */
export async function getQueuedExpenses() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Add an expense to the offline queue.
 */
export async function enqueueExpense(expense) {
  const queue = await getQueuedExpenses();
  queue.push({ ...expense, queuedAt: Date.now() });
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return queue.length;
}

/**
 * Sync all pending offline expenses to Firestore.
 * Returns the number of successfully synced items.
 */
export async function syncOfflineExpenses() {
  const queue = await getQueuedExpenses();
  if (!queue.length) return 0;

  let synced = 0;
  const remaining = [];

  for (const item of queue) {
    try {
      const { groupId, queuedAt, ...data } = item;
      await addDoc(collection(db, 'groups', groupId, 'expenses'), {
        ...data,
        date: serverTimestamp(),
        syncedOffline: true,
      });
      synced++;
    } catch {
      remaining.push(item);
    }
  }

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  return synced;
}
