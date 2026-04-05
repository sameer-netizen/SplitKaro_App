import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { collection, query, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../firebase';
import { useAuth } from '../context/AuthContext';
import { formatINR } from '../utils/calculations';

const COLORS = { primary: '#1B5E20', accent: '#4CAF50', bg: '#F5F5F5', owe: '#C62828', owed: '#1B5E20' };

const CATEGORIES = {
  food: { label: 'Food', icon: 'fast-food-outline' },
  transport: { label: 'Transport', icon: 'car-outline' },
  accommodation: { label: 'Stay', icon: 'bed-outline' },
  entertainment: { label: 'Fun', icon: 'film-outline' },
  shopping: { label: 'Shopping', icon: 'cart-outline' },
  utilities: { label: 'Bills', icon: 'receipt-outline' },
  other: { label: 'Other', icon: 'ellipsis-horizontal-outline' },
};

export default function GroupDetailScreen({ route, navigation }) {
  const { groupId } = route.params;
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch group details
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'groups', groupId), (snap) => {
      if (snap.exists()) setGroup({ id: snap.id, ...snap.data() });
    });
    return unsub;
  }, [groupId]);

  // Fetch expenses
  useEffect(() => {
    const q = query(collection(db, 'groups', groupId, 'expenses'), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
      setRefreshing(false);
    }, (err) => { console.error(err); setLoading(false); });
    return unsub;
  }, [groupId]);

  const totalSpent = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  const renderExpense = ({ item }) => {
    const paidByMe = item.paidBy === user.uid;
    const myShare = item.splitAmong?.find((s) => s.userId === user.uid)?.amount || 0;
    const paidByName = group?.memberDetails?.[item.paidBy]?.name || 'Someone';
    const catInfo = CATEGORIES[item.category] || CATEGORIES.other;

    // Net effect on me: if I paid, I'm owed (total - myShare); if others paid, I owe myShare
    let netLabel = '';
    let netColor = '#666';
    if (paidByMe) {
      const owedToMe = (item.amount || 0) - myShare;
      if (owedToMe > 0.01) { netLabel = `you get back ${formatINR(owedToMe)}`; netColor = COLORS.owed; }
      else { netLabel = 'you were not owed'; }
    } else {
      if (myShare > 0.01) { netLabel = `you owe ${formatINR(myShare)}`; netColor = COLORS.owe; }
      else { netLabel = 'not involved'; }
    }

    return (
      <View style={styles.expenseCard}>
        <View style={[styles.catIcon, { backgroundColor: COLORS.accent + '22' }]}>
          <Ionicons name={catInfo.icon} size={22} color={COLORS.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.expDesc} numberOfLines={1}>{item.description}</Text>
          <Text style={styles.expMeta}>{paidByMe ? 'You' : paidByName} paid • {item.dateStr || ''}</Text>
          <Text style={[styles.netLabel, { color: netColor }]}>{netLabel}</Text>
        </View>
        <Text style={styles.expAmount}>{formatINR(item.amount)}</Text>
      </View>
    );
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.accent} /></View>;
  }

  return (
    <View style={styles.container}>
      {/* Summary Banner */}
      <View style={styles.banner}>
        <View>
          <Text style={styles.bannerLabel}>Total Spent</Text>
          <Text style={styles.bannerAmount}>{formatINR(totalSpent)}</Text>
        </View>
        <View style={styles.bannerActions}>
          <TouchableOpacity
            style={styles.bannerBtn}
            onPress={() => navigation.navigate('Balances', { groupId, groupName: group?.name })}
          >
            <Ionicons name="scale-outline" size={18} color="#fff" />
            <Text style={styles.bannerBtnText}>Balances</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id}
        renderItem={renderExpense}
        contentContainerStyle={expenses.length === 0 ? { flex: 1 } : { padding: 14, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(true)} tintColor={COLORS.accent} />}
        ListEmptyComponent={
          <View style={styles.emptyInner}>
            <Ionicons name="receipt-outline" size={72} color="#ccc" />
            <Text style={styles.emptyTitle}>No expenses yet</Text>
            <Text style={styles.emptySub}>Tap + to add the first expense</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddExpense', { groupId, group })}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  banner: { backgroundColor: COLORS.primary, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bannerLabel: { color: '#A5D6A7', fontSize: 12, fontWeight: '600' },
  bannerAmount: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 2 },
  bannerActions: { flexDirection: 'row', gap: 10 },
  bannerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, gap: 6 },
  bannerBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  expenseCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 },
  catIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  expDesc: { fontSize: 15, fontWeight: '600', color: '#222' },
  expMeta: { fontSize: 12, color: '#999', marginTop: 2 },
  netLabel: { fontSize: 12, fontWeight: '600', marginTop: 3 },
  expAmount: { fontSize: 16, fontWeight: '700', color: '#333' },
  emptyInner: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#555', marginTop: 16 },
  emptySub: { fontSize: 14, color: '#999', marginTop: 8 },
  fab: { position: 'absolute', right: 20, bottom: 28, width: 58, height: 58, borderRadius: 29, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
});
