import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
} from 'react-native';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../firebase';
import { useAuth } from '../context/AuthContext';
import { formatINR } from '../utils/calculations';

const COLORS = { primary: '#1B5E20', accent: '#4CAF50', bg: '#F5F5F5', owe: '#C62828' };

export default function TransactionHistoryScreen({ route }) {
  const { groupId } = route.params;
  const { user } = useAuth();
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.accent} /></View>;
  }

  const renderItem = ({ item }) => {
    const involveMe = item.paidBy === user.uid || item.paidTo === user.uid;
    const fromLabel = item.paidBy === user.uid ? 'You' : (item.paidByName || item.paidBy);
    const toLabel = item.paidTo === user.uid ? 'you' : (item.paidToName || item.paidTo);
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
        <Text style={[styles.amount, involveMe && { color: COLORS.primary }]}>
          {formatINR(item.amount)}
        </Text>
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
  iconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.accent + '22', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  txnText: { fontSize: 14, color: '#444', marginBottom: 3 },
  bold: { fontWeight: '700', color: '#222' },
  meta: { fontSize: 12, color: '#999' },
  partialBadge: { fontSize: 11, color: COLORS.owe, fontStyle: 'italic', marginTop: 2 },
  amount: { fontSize: 16, fontWeight: '700', color: '#555' },
  emptyInner: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#555', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#999', marginTop: 6 },
});
