import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Alert,
} from 'react-native';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../firebase';
import { useAuth } from '../context/AuthContext';
import { formatINR } from '../utils/calculations';

const COLORS = { primary: '#1B5E20', accent: '#4CAF50', bg: '#F5F5F5', owe: '#C62828' };

export default function TransactionHistoryScreen({ route }) {
  const { groupId } = route.params || {};
  const { user } = useAuth();
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unsettlingId, setUnsettlingId] = useState(null);

  useEffect(() => {
    if (!groupId) {
      setLoading(false);
      setSettlements([]);
      return () => {};
    }

    const q = query(
      collection(db, 'groups', groupId, 'settlements'),
      orderBy('date', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setSettlements(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => { console.error(err); setLoading(false); });
    return unsub;
  }, [groupId]);

  const handleUnsettle = (item) => {
    Alert.alert(
      'Unsettle Payment?',
      `Are you sure you want to revert ${formatINR(item.amount)} paid to ${item.paidToName || 'recipient'}?`,
      [
        { text: 'Cancel', onPress: () => {}, style: 'cancel' },
        {
          text: 'Unsettle',
          onPress: async () => {
            setUnsettlingId(item.id);
            try {
              await deleteDoc(doc(db, 'groups', groupId, 'settlements', item.id));
              Alert.alert('Unsettled! ✅', 'Payment has been reverted.');
            } catch (err) {
              if (err?.code === 'permission-denied') {
                Alert.alert('Not allowed', 'You can unsettle only payments you recorded/sent, or ask the group owner/admin.');
              } else {
                Alert.alert('Error', 'Could not unsettle payment. Please try again.');
              }
              console.error(err);
            } finally {
              setUnsettlingId(null);
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.accent} /></View>;
  }

  if (!groupId) {
    return (
      <View style={styles.center}>
        <Text style={{ color: '#666' }}>Group not found.</Text>
      </View>
    );
  }

  const renderItem = ({ item }) => {
    const myUid = user?.uid || '';
    const myEmail = (user?.email || '').toLowerCase();
    const paidByValue = String(item.paidBy || '');
    const paidByEmailLike = paidByValue.toLowerCase();
    const isSender = paidByValue === myUid || (!!myEmail && paidByEmailLike === myEmail) || item.recordedBy === myUid;
    const involveMe = isSender || item.paidTo === myUid;
    const fromLabel = isSender ? 'You' : (item.paidByName || item.paidBy);
    const toLabel = item.paidTo === user?.uid ? 'you' : (item.paidToName || item.paidTo);
    return (
      <View style={[styles.card, involveMe && styles.cardHighlight]}>
        <View style={styles.iconWrap}>
          <Ionicons name="swap-horizontal" size={22} color={COLORS.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.txnText}>
            <Text style={styles.bold}>{fromLabel}</Text>
            {' paid '}
            <Text style={styles.bold}>{toLabel}</Text>
          </Text>
          <Text style={styles.meta}>{item.dateStr || ''}</Text>
          {item.isPartial && (
            <Text style={styles.partialBadge}>Partial payment</Text>
          )}
        </View>
        <View style={styles.cardEnd}>
          <Text style={[styles.amount, involveMe && { color: COLORS.primary }]}>
            {formatINR(item.amount)}
          </Text>
          {isSender && (
            <TouchableOpacity
              style={styles.unsettle}
              onPress={() => handleUnsettle(item)}
              disabled={unsettlingId === item.id}
            >
              {unsettlingId === item.id ? (
                <ActivityIndicator size="small" color={COLORS.owe} />
              ) : (
                <Ionicons name="close-circle-outline" size={18} color={COLORS.owe} />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const total = settlements.reduce((s, t) => s + (t.amount || 0), 0);

  return (
    <View style={styles.container}>
      {settlements.length > 0 && (
        <View style={styles.summaryBar}>
          <Text style={styles.summaryLabel}>Total settled</Text>
          <Text style={styles.summaryAmount}>{formatINR(total)}</Text>
        </View>
      )}
      <FlatList
        data={settlements}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={
          settlements.length === 0 ? { flex: 1 } : { padding: 14, paddingBottom: 40 }
        }
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <View style={styles.emptyInner}>
            <Ionicons name="receipt-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>No settlements yet</Text>
            <Text style={styles.emptySub}>Settled payments will appear here.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  summaryBar: { backgroundColor: COLORS.primary, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { color: '#A5D6A7', fontSize: 13, fontWeight: '600' },
  summaryAmount: { color: '#fff', fontSize: 22, fontWeight: '800' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4 },
  cardHighlight: { borderWidth: 1.5, borderColor: COLORS.accent + '66' },
  cardEnd: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.accent + '22', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  txnText: { fontSize: 14, color: '#444', marginBottom: 3 },
  bold: { fontWeight: '700', color: '#222' },
  meta: { fontSize: 12, color: '#999' },
  partialBadge: { fontSize: 11, color: COLORS.owe, fontStyle: 'italic', marginTop: 2 },
  amount: { fontSize: 16, fontWeight: '700', color: '#555' },
  unsettle: { padding: 6, justifyContent: 'center', alignItems: 'center' },
  emptyInner: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#555', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#999', marginTop: 6 },
});
