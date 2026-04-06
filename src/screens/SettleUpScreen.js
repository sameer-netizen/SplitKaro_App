import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, TextInput,
} from 'react-native';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../firebase';
import { useAuth } from '../context/AuthContext';
import { formatINR } from '../utils/calculations';

const COLORS = { primary: '#1B5E20', accent: '#4CAF50', bg: '#F5F5F5', owe: '#C62828' };

export default function SettleUpScreen({ route, navigation }) {
  const { groupId, transaction, memberNames = {} } = route.params || {};
  const { user } = useAuth();
  const currentUserId = user?.uid || '';
  const txnFrom = transaction?.from ? String(transaction.from) : '';
  const txnTo = transaction?.to ? String(transaction.to) : '';
  const safeAmount = Number(transaction?.amount || 0);
  const safeTxnAmount = Number.isFinite(safeAmount) ? safeAmount : 0;
  const [saving, setSaving] = useState(false);
  const [customAmount, setCustomAmount] = useState(safeTxnAmount.toFixed(2));
  const [note, setNote] = useState('');

  if (!groupId || !txnFrom || !txnTo || safeTxnAmount <= 0) {
    return (
      <View style={[styles.container, { justifyContent: 'center', padding: 24 }]}>
        <Text style={[styles.title, { textAlign: 'center' }]}>Settlement data missing</Text>
        <Text style={[styles.sub, { marginBottom: 20 }]}>Please go back and try again.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('Balances', { groupId })}>
          <Text style={styles.btnText}>Back to Balances</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const getSafeName = (uid, fallback) => {
    const val = memberNames?.[uid];
    if (typeof val === 'string' && val.trim()) return val;
    return fallback;
  };

  const fromName = txnFrom === currentUserId ? 'You' : getSafeName(txnFrom, 'Someone');
  const toName = txnTo === currentUserId ? 'You' : getSafeName(txnTo, 'Someone');

  const parsedAmount = parseFloat(customAmount);
  const isPartial = !isNaN(parsedAmount) && parsedAmount < safeTxnAmount - 0.01;

  const goToPreviousScreen = () => {
    navigation.replace('Balances', { groupId });
  };

  const confirmSettle = async () => {
    if (!currentUserId) {
      Alert.alert('Session expired', 'Please sign in again and retry settlement.');
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid amount greater than ₹0.');
      return;
    }
    if (parsedAmount > safeTxnAmount + 0.01) {
      Alert.alert('Too much', `Amount cannot exceed ${formatINR(safeTxnAmount)}.`);
      return;
    }
    setSaving(true);
    try {
      const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      await addDoc(collection(db, 'groups', groupId, 'settlements'), {
        paidBy: txnFrom,
        paidByName: getSafeName(txnFrom, 'Unknown'),
        paidTo: txnTo,
        paidToName: getSafeName(txnTo, 'Unknown'),
        amount: Math.round(parsedAmount * 100) / 100,
        isPartial,
        note: note.trim(),
        date: serverTimestamp(),
        dateStr,
        recordedBy: currentUserId,
      });
      const msg = isPartial
        ? `Partial payment of ${formatINR(parsedAmount)} recorded.`
        : `${formatINR(parsedAmount)} settlement recorded.`;
      Alert.alert('Settled! ✅', msg, [{ text: 'OK', onPress: goToPreviousScreen }]);
    } catch (err) {
      Alert.alert('Error', 'Could not record settlement. Please try again.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
      <View style={styles.card}>
        <Ionicons name="swap-horizontal" size={48} color={COLORS.accent} style={{ marginBottom: 16 }} />
        <Text style={styles.title}>Record Settlement</Text>
        <Text style={styles.sub}>Enter the amount paid and optionally add a note.</Text>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={styles.personBadge}>
            <Text style={styles.personInitial}>{String(txnFrom === currentUserId ? 'Y' : getSafeName(txnFrom, 'S')).charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.arrow}>pays</Text>
          <View style={styles.personBadge}>
            <Text style={styles.personInitial}>{String(txnTo === currentUserId ? 'Y' : getSafeName(txnTo, 'S')).charAt(0).toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.names}>{fromName} → {toName}</Text>
        <Text style={styles.maxLabel}>Suggested: {formatINR(safeTxnAmount)}</Text>

        {/* Amount input */}
        <View style={styles.amountRow}>
          <Text style={styles.rupeeSign}>₹</Text>
          <TextInput
            style={styles.amountInput}
            value={customAmount}
            onChangeText={setCustomAmount}
            keyboardType="decimal-pad"
            selectTextOnFocus
          />
        </View>
        {isPartial && (
          <Text style={styles.partialNote}>Partial payment — remaining {formatINR(Math.max(safeTxnAmount - parsedAmount, 0))} still owed</Text>
        )}

        {/* Optional note */}
        <TextInput
          style={styles.noteInput}
          placeholder="Add a note (optional)"
          value={note}
          onChangeText={setNote}
          maxLength={60}
        />
      </View>

      <TouchableOpacity style={styles.btn} onPress={confirmSettle} disabled={saving}>
        {saving
          ? <ActivityIndicator color="#fff" />
          : (
            <>
              <Ionicons name="checkmark-circle" size={22} color="#fff" />
              <Text style={styles.btnText}>{isPartial ? 'Record Partial Payment' : 'Confirm Full Settlement'}</Text>
            </>
          )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>

      <Text style={styles.notice}>
        No money is transferred through this app — it only records the settlement.
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
  names: { fontSize: 16, color: '#555', fontWeight: '600', marginBottom: 6 },
  maxLabel: { fontSize: 13, color: '#aaa', marginBottom: 16 },
  amountRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: COLORS.accent, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8, marginBottom: 8, width: '80%' },
  rupeeSign: { fontSize: 24, fontWeight: '800', color: COLORS.primary, marginRight: 4 },
  amountInput: { flex: 1, fontSize: 28, fontWeight: '800', color: COLORS.primary, textAlign: 'center' },
  partialNote: { fontSize: 12, color: '#E65100', textAlign: 'center', marginBottom: 12, fontStyle: 'italic' },
  noteInput: { borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#555', width: '100%', backgroundColor: '#FAFAFA', marginTop: 8 },
  btn: { backgroundColor: COLORS.accent, borderRadius: 14, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, elevation: 3, marginBottom: 12 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { paddingVertical: 14, alignItems: 'center' },
  cancelText: { color: '#888', fontSize: 15 },
  notice: { marginTop: 16, fontSize: 12, color: '#bbb', textAlign: 'center', lineHeight: 18 },
});
