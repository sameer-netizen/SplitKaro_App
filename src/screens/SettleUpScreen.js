import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../firebase';
import { useAuth } from '../context/AuthContext';
import { formatINR } from '../utils/calculations';

const COLORS = { primary: '#1B5E20', accent: '#4CAF50', bg: '#F5F5F5' };

export default function SettleUpScreen({ route, navigation }) {
  const { groupId, transaction, memberNames } = route.params;
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const fromName = transaction.from === user.uid ? 'You' : memberNames[transaction.from] || 'Someone';
  const toName = transaction.to === user.uid ? 'You' : memberNames[transaction.to] || 'Someone';

  const confirmSettle = async () => {
    setSaving(true);
    try {
      const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      await addDoc(collection(db, 'groups', groupId, 'settlements'), {
        paidBy: transaction.from,
        paidByName: memberNames[transaction.from] || 'Unknown',
        paidTo: transaction.to,
        paidToName: memberNames[transaction.to] || 'Unknown',
        amount: transaction.amount,
        date: serverTimestamp(),
        dateStr,
        recordedBy: user.uid,
      });
      Alert.alert('Settled!', `₹${transaction.amount.toFixed(2)} settlement recorded.`, [
        { text: 'OK', onPress: () => navigation.pop(2) },
      ]);
    } catch (err) {
      Alert.alert('Error', 'Could not record settlement. Please try again.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
      {/* Visual summary */}
      <View style={styles.card}>
        <Ionicons name="swap-horizontal" size={48} color={COLORS.accent} style={{ marginBottom: 16 }} />
        <Text style={styles.title}>Record Settlement</Text>
        <Text style={styles.sub}>This will mark the following payment as settled</Text>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={styles.personBadge}>
            <Text style={styles.personInitial}>{(transaction.from === user.uid ? 'Y' : (memberNames[transaction.from] || 'S')).charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.arrow}>pays</Text>
          <View style={styles.personBadge}>
            <Text style={styles.personInitial}>{(transaction.to === user.uid ? 'Y' : (memberNames[transaction.to] || 'S')).charAt(0).toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.names}>{fromName} → {toName}</Text>
        <Text style={styles.amount}>{formatINR(transaction.amount)}</Text>
      </View>

      <TouchableOpacity style={styles.btn} onPress={confirmSettle} disabled={saving}>
        {saving
          ? <ActivityIndicator color="#fff" />
          : (
            <>
              <Ionicons name="checkmark-circle" size={22} color="#fff" />
              <Text style={styles.btnText}>Confirm Settlement</Text>
            </>
          )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>

      <Text style={styles.notice}>
        Note: Both parties should agree on the payment before recording it. No money is transferred through this app — it only records the settlement.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 28, alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.primary, marginBottom: 6 },
  sub: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 16 },
  divider: { height: 1, backgroundColor: '#F0F0F0', width: '100%', marginBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 14 },
  personBadge: { width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center' },
  personInitial: { color: '#fff', fontSize: 26, fontWeight: '800' },
  arrow: { fontSize: 14, color: '#aaa', fontWeight: '600' },
  names: { fontSize: 16, color: '#555', fontWeight: '600', marginBottom: 10 },
  amount: { fontSize: 36, fontWeight: '900', color: COLORS.primary },
  btn: { backgroundColor: COLORS.accent, borderRadius: 14, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, elevation: 3, marginBottom: 12 },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  cancelBtn: { paddingVertical: 14, alignItems: 'center' },
  cancelText: { color: '#888', fontSize: 15 },
  notice: { marginTop: 16, fontSize: 12, color: '#bbb', textAlign: 'center', lineHeight: 18 },
});
