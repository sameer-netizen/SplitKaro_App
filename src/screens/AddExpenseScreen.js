import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../firebase';
import { useAuth } from '../context/AuthContext';
import { splitEqually } from '../utils/calculations';
import { useOfflineQueue } from '../hooks/useOfflineQueue';

const COLORS = { primary: '#1B5E20', accent: '#4CAF50', bg: '#F5F5F5', danger: '#C62828' };

const CATEGORIES = [
  { key: 'food', label: 'Food', icon: 'fast-food-outline' },
  { key: 'transport', label: 'Transport', icon: 'car-outline' },
  { key: 'accommodation', label: 'Stay', icon: 'bed-outline' },
  { key: 'entertainment', label: 'Fun', icon: 'film-outline' },
  { key: 'shopping', label: 'Shopping', icon: 'cart-outline' },
  { key: 'utilities', label: 'Bills', icon: 'receipt-outline' },
  { key: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' },
];

export default function AddExpenseScreen({ route, navigation }) {
  const { groupId, group, expense = null, editMode = false } = route.params;
  const { user } = useAuth();
  const { isOnline, addToQueue } = useOfflineQueue();

  const groupMembers = useMemo(() => {
    const details = group?.memberDetails || {};
    return Object.entries(details).map(([uid, info]) => ({ uid, ...info }));
  }, [group]);

  const members = useMemo(() => {
    const byUid = {};

    groupMembers.forEach((m) => {
      byUid[m.uid] = {
        uid: m.uid,
        name: m.name || 'Unknown',
        email: m.email || '',
        registered: m.registered !== false,
      };
    });

    if (expense?.paidBy && !byUid[expense.paidBy]) {
      byUid[expense.paidBy] = {
        uid: expense.paidBy,
        name: expense.paidByName || 'Former member',
        email: '',
        registered: false,
      };
    }

    (expense?.splitAmong || []).forEach((s) => {
      if (!byUid[s.userId]) {
        byUid[s.userId] = {
          uid: s.userId,
          name: group?.memberDetails?.[s.userId]?.name || 'Former member',
          email: '',
          registered: false,
        };
      }
    });

    return Object.values(byUid);
  }, [groupMembers, expense, group]);

  const [description, setDescription] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [paidBy, setPaidBy] = useState(user.uid);
  const [category, setCategory] = useState('other');
  const [splitMode, setSplitMode] = useState('equally'); // 'equally' | 'exact'
  const [selectedForSplit, setSelectedForSplit] = useState(members.map((m) => m.uid));
  const [exactAmounts, setExactAmounts] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editMode || !expense) return;

    setDescription(expense.description || '');
    setAmountStr(String(expense.amount || ''));
    setPaidBy(expense.paidBy || user.uid);
    setCategory(expense.category || 'other');

    const existingSplit = Array.isArray(expense.splitAmong) ? expense.splitAmong : [];
    const selectedIds = existingSplit.map((s) => s.userId);
    if (selectedIds.length > 0) {
      setSelectedForSplit(selectedIds);
    }

    const amountsMap = {};
    existingSplit.forEach((s) => {
      amountsMap[s.userId] = String(s.amount ?? '');
    });
    setExactAmounts(amountsMap);

    const total = Number(expense.amount || 0);
    const expectedEqual = selectedIds.length ? total / selectedIds.length : 0;
    const looksEqual = selectedIds.length > 0 && existingSplit.every((s) => Math.abs((Number(s.amount) || 0) - expectedEqual) < 0.01);
    setSplitMode(looksEqual ? 'equally' : 'exact');
  }, [editMode, expense, user.uid]);

  const toggleMember = (uid) => {
    setSelectedForSplit((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const totalExact = useMemo(() => {
    return Object.values(exactAmounts).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  }, [exactAmounts]);

  const handleSave = async () => {
    const desc = description.trim();
    const amount = parseFloat(amountStr);

    if (!desc) {
      Alert.alert('Missing description', 'Please describe this expense.');
      return;
    }
    if (!amountStr || isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid amount in INR.');
      return;
    }
    if (selectedForSplit.length === 0) {
      Alert.alert('No members', 'Select at least one member to split with.');
      return;
    }

    let splitAmong;
    if (splitMode === 'equally') {
      splitAmong = splitEqually(amount, selectedForSplit);
    } else {
      const diff = Math.abs(totalExact - amount);
      if (diff > 0.5) {
        Alert.alert('Amount mismatch', `Exact amounts total ${totalExact.toFixed(2)} but expense is INR ${amount.toFixed(2)}. Please adjust.`);
        return;
      }
      splitAmong = selectedForSplit.map((uid) => ({ userId: uid, amount: parseFloat(exactAmounts[uid] || 0) }));
    }

    const today = new Date();
    const dateStr = today.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const paidByName = group?.memberDetails?.[paidBy]?.name || members.find((m) => m.uid === paidBy)?.name || 'Someone';

    const expenseData = {
      groupId,
      description: desc,
      amount,
      paidBy,
      paidByName,
      category,
      splitAmong,
      dateStr,
      createdBy: user.uid,
    };

    setSaving(true);
    try {
      if (!isOnline && editMode) {
        Alert.alert('Offline', 'Editing an existing expense requires internet connection.');
        return;
      }

      if (!isOnline && !editMode) {
        await addToQueue(expenseData);
        Alert.alert(
          'Saved Offline',
          'This expense has been saved locally and will sync automatically when you are back online.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        return;
      }

      if (editMode && expense?.id) {
        await updateDoc(doc(db, 'groups', groupId, 'expenses', expense.id), {
          description: desc,
          amount,
          paidBy,
          paidByName,
          category,
          splitAmong,
          date: serverTimestamp(),
          dateStr,
          updatedBy: user.uid,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'groups', groupId, 'expenses'), {
          description: desc,
          amount,
          paidBy,
          paidByName,
          category,
          splitAmong,
          date: serverTimestamp(),
          dateStr,
          createdBy: user.uid,
        });
      }

      navigation.goBack();
    } catch (err) {
      try {
        if (editMode) throw err;
        await addToQueue(expenseData);
        Alert.alert(
          'Saved Offline',
          'Connection lost. Expense saved locally and will sync when reconnected.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } catch {
        Alert.alert('Error', editMode ? 'Could not update expense. You may not have permission.' : 'Could not save expense. Please try again.');
        console.error(err);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={16} color="#fff" />
          <Text style={styles.offlineText}>
            {editMode ? 'Offline - reconnect to update expense' : 'Offline - expense will sync when connected'}
          </Text>
        </View>
      )}
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Expense Details</Text>
          <Text style={styles.label}>Description *</Text>
          <TextInput style={styles.input} placeholder="e.g. Dinner at Dhaba" value={description} onChangeText={setDescription} maxLength={60} />

          <Text style={styles.label}>Amount (INR) *</Text>
          <View style={styles.amountRow}>
            <Text style={styles.rupeeSign}>INR</Text>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="0.00"
              value={amountStr}
              onChangeText={setAmountStr}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c.key}
                style={[styles.catChip, category === c.key && styles.catChipActive]}
                onPress={() => setCategory(c.key)}
              >
                <Ionicons name={c.icon} size={18} color={category === c.key ? '#fff' : COLORS.accent} />
                <Text style={[styles.catLabel, category === c.key && { color: '#fff' }]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Paid By</Text>
          {members.map((m) => (
            <TouchableOpacity key={m.uid} style={styles.radioRow} onPress={() => setPaidBy(m.uid)}>
              <View style={[styles.radio, paidBy === m.uid && styles.radioActive]}>
                {paidBy === m.uid && <View style={styles.radioDot} />}
              </View>
              <Text style={styles.radioLabel}>{m.name}{m.uid === user.uid ? ' (you)' : m.registered === false ? ' (former)' : ''}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.splitHeader}>
            <Text style={styles.sectionTitle}>Split Among</Text>
            <View style={styles.modeToggle}>
              <TouchableOpacity
                style={[styles.modeBtn, splitMode === 'equally' && styles.modeBtnActive]}
                onPress={() => setSplitMode('equally')}
              >
                <Text style={[styles.modeBtnText, splitMode === 'equally' && styles.modeBtnTextActive]}>Equally</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, splitMode === 'exact' && styles.modeBtnActive]}
                onPress={() => setSplitMode('exact')}
              >
                <Text style={[styles.modeBtnText, splitMode === 'exact' && styles.modeBtnTextActive]}>Exact INR</Text>
              </TouchableOpacity>
            </View>
          </View>

          {members.map((m) => {
            const selected = selectedForSplit.includes(m.uid);
            const equalShare = selected && parseFloat(amountStr) > 0
              ? (parseFloat(amountStr) / selectedForSplit.length).toFixed(2)
              : '0.00';
            return (
              <View key={m.uid} style={styles.splitRow}>
                <TouchableOpacity style={styles.checkRow} onPress={() => toggleMember(m.uid)}>
                  <View style={[styles.check, selected && styles.checkActive]}>
                    {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <Text style={[styles.radioLabel, !selected && { color: '#bbb' }]}>
                    {m.name}{m.uid === user.uid ? ' (you)' : m.registered === false ? ' (former)' : ''}
                  </Text>
                </TouchableOpacity>
                {selected && splitMode === 'equally' && (
                  <Text style={styles.shareAmt}>INR {equalShare}</Text>
                )}
                {selected && splitMode === 'exact' && (
                  <TextInput
                    style={styles.exactInput}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    value={exactAmounts[m.uid] || ''}
                    onChangeText={(v) => setExactAmounts((prev) => ({ ...prev, [m.uid]: v }))}
                  />
                )}
              </View>
            );
          })}
          {splitMode === 'exact' && (
            <Text style={[styles.totalHint, Math.abs(totalExact - parseFloat(amountStr || 0)) > 0.5 && { color: COLORS.danger }]}> 
              Total entered: INR {totalExact.toFixed(2)} / INR {parseFloat(amountStr || 0).toFixed(2)}
            </Text>
          )}
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{editMode ? 'Update Expense' : 'Add Expense'}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.bg },
  section: { backgroundColor: '#fff', margin: 14, marginBottom: 8, borderRadius: 14, padding: 16, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.primary, marginBottom: 12 },
  label: { fontSize: 13, color: '#555', marginBottom: 6, fontWeight: '600' },
  input: { borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, marginBottom: 12, color: '#333', backgroundColor: '#FAFAFA' },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rupeeSign: { fontSize: 18, color: COLORS.primary, fontWeight: '700', marginBottom: 12 },
  catRow: { paddingVertical: 4, gap: 8 },
  catChip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.accent, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  catChipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  catLabel: { fontSize: 13, color: COLORS.accent, fontWeight: '600' },
  radioRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#DDD', marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  radioActive: { borderColor: COLORS.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.accent },
  radioLabel: { fontSize: 14, color: '#333', fontWeight: '500' },
  splitHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modeToggle: { flexDirection: 'row', borderWidth: 1.5, borderColor: COLORS.accent, borderRadius: 8, overflow: 'hidden' },
  modeBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  modeBtnActive: { backgroundColor: COLORS.accent },
  modeBtnText: { fontSize: 13, color: COLORS.accent, fontWeight: '600' },
  modeBtnTextActive: { color: '#fff' },
  splitRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  checkRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#DDD', marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  checkActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  shareAmt: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  exactInput: { borderWidth: 1.5, borderColor: '#DDD', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, width: 90, textAlign: 'right', fontSize: 14, backgroundColor: '#FAFAFA' },
  totalHint: { marginTop: 10, fontSize: 13, color: '#888', textAlign: 'right' },
  saveBtn: { backgroundColor: COLORS.accent, margin: 14, borderRadius: 14, paddingVertical: 16, alignItems: 'center', elevation: 3 },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  offlineBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#E65100', paddingVertical: 8, paddingHorizontal: 16, gap: 8 },
  offlineText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});