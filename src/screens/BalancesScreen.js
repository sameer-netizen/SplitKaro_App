import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { collection, query, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../firebase';
import { useAuth } from '../context/AuthContext';
import { calculateNetBalances, calculateMinTransactions, calculateDirectTransactions, formatINR } from '../utils/calculations';

const COLORS = { primary: '#1B5E20', accent: '#4CAF50', bg: '#F5F5F5', owe: '#C62828', owed: '#1B5E20' };

export default function BalancesScreen({ route, navigation }) {
  const { groupId } = route.params || {};
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [smartEnabled, setSmartEnabled] = useState(true);
  const [savingToggle, setSavingToggle] = useState(false);

  useEffect(() => {
    const unsubGroup = onSnapshot(doc(db, 'groups', groupId), (snap) => {
      if (!snap.exists()) return;
      const data = { id: snap.id, ...snap.data() };
      setGroup(data);
      setSmartEnabled(data.smartSettlementEnabled !== false);
    });
    return () => unsubGroup();
  }, [groupId]);

  useEffect(() => {
    const qExp = query(collection(db, 'groups', groupId, 'expenses'));
    const unsubExp = onSnapshot(qExp, (snap) => {
      setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const qSet = query(collection(db, 'groups', groupId, 'settlements'));
    const unsubSet = onSnapshot(qSet, (snap) => {
      setSettlements(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => { unsubExp(); unsubSet(); };
  }, [groupId]);

  const { netBalances, transactions, memberNames } = useMemo(() => {
    if (!group) return { netBalances: {}, transactions: [], memberNames: {} };
    const members = group.members || [];
    const mNames = {};
    members.forEach((uid) => {
      mNames[uid] = group.memberDetails?.[uid]?.name || 'Unknown';
    });
    const net = calculateNetBalances(expenses, settlements, members);
    const txns = smartEnabled
      ? calculateMinTransactions(net)
      : calculateDirectTransactions(expenses, settlements);
    return { netBalances: net, transactions: txns, memberNames: mNames };
  }, [group, expenses, settlements, smartEnabled]);

  const onToggleSmartSettlement = async (value) => {
    if (!group) return;
    setSmartEnabled(value);
    setSavingToggle(true);
    try {
      await updateDoc(doc(db, 'groups', groupId), { smartSettlementEnabled: value });
    } catch {
      // Revert only if save fails.
      setSmartEnabled((prev) => !prev);
    } finally {
      setSavingToggle(false);
    }
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

  const myBalance = netBalances[user?.uid] || 0;

  return (
    <View style={styles.container}>
      {/* My Balance Banner */}
      <View style={[styles.banner, { backgroundColor: myBalance >= 0 ? COLORS.owed : COLORS.owe }]}>
        <View>
          <Text style={styles.bannerSub}>Overall, you are</Text>
          {myBalance > 0.01 ? (
            <Text style={styles.bannerBig}>owed {formatINR(myBalance)}</Text>
          ) : myBalance < -0.01 ? (
            <Text style={styles.bannerBig}>in debt {formatINR(-myBalance)}</Text>
          ) : (
            <Text style={styles.bannerBig}>all settled up 🎉</Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.historyBtn}
          onPress={() => navigation.navigate('TransactionHistory', { groupId })}
        >
          <Ionicons name="time-outline" size={16} color="rgba(255,255,255,0.9)" />
          <Text style={styles.historyBtnText}>History</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(_, i) => String(i)}
        ListHeaderComponent={
          <>
            {/* Per-person balances */}
            <Text style={styles.sectionTitle}>Individual Balances</Text>
            {Object.entries(netBalances).map(([uid, bal]) => {
              const rounded = Math.round(bal * 100) / 100;
              const name = memberNames[uid] || uid;
              const isMe = uid === user?.uid;
              return (
                <View key={uid} style={styles.balanceRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{(name || '?').charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.balanceName}>{name}{isMe ? ' (you)' : ''}</Text>
                  <Text style={[styles.balanceAmt, { color: rounded >= 0 ? COLORS.owed : COLORS.owe }]}>
                    {rounded > 0.01 ? `+${formatINR(rounded)}` : rounded < -0.01 ? `-${formatINR(-rounded)}` : 'Settled'}
                  </Text>
                </View>
              );
            })}

            {transactions.length > 0 && (
              <>
                <View style={styles.infoBox}>
                  <Ionicons name="information-circle-outline" size={16} color="#666" />
                  <Text style={styles.infoText}>Only pending payments shown. Settled payments appear in history.</Text>
                </View>

                <View style={styles.smartHeader}>
                  <View style={styles.smartRow}>
                    <Text style={[styles.sectionTitle, { marginTop: 16, marginBottom: 0 }]}>Smart Settlement</Text>
                    <View style={styles.toggleWrap}>
                      <Text style={styles.toggleLabel}>{smartEnabled ? 'ON' : 'OFF'}</Text>
                      <Switch
                        value={smartEnabled}
                        onValueChange={onToggleSmartSettlement}
                        trackColor={{ false: '#BDBDBD', true: COLORS.accent + '88' }}
                        thumbColor={smartEnabled ? COLORS.accent : '#f4f3f4'}
                        disabled={savingToggle}
                      />
                    </View>
                  </View>
                  <Text style={styles.smartSub}>
                    {smartEnabled
                      ? `${transactions.length} transaction${transactions.length !== 1 ? 's' : ''} to settle all debts`
                      : `${transactions.length} direct due${transactions.length !== 1 ? 's' : ''} (without minimization)`}
                  </Text>
                </View>
              </>
            )}
          </>
        }
        renderItem={({ item }) => {
          const fromName = memberNames[item.from] || item.from;
          const toName = memberNames[item.to] || item.to;
          const involvesMe = item.from === user?.uid || item.to === user?.uid;
          return (
            <View style={[styles.txnCard, involvesMe && styles.txnCardHighlight]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.txnText}>
                  <Text style={styles.txnName}>{item.from === user?.uid ? 'You' : fromName}</Text>
                  {' → '}
                  <Text style={styles.txnName}>{item.to === user?.uid ? 'You' : toName}</Text>
                </Text>
                <Text style={styles.txnAmt}>{formatINR(item.amount)}</Text>
              </View>
              {item.from === user?.uid && (
                <TouchableOpacity
                  style={styles.settleBtn}
                  onPress={() => navigation.navigate('SettleUp', { groupId, transaction: item, memberNames })}
                >
                  <Text style={styles.settleBtnText}>Settle Up</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ListEmptyComponent={transactions.length === 0 && (
          <View style={styles.allGood}>
            <Ionicons name="checkmark-circle-outline" size={60} color={COLORS.accent} />
            <Text style={styles.allGoodText}>All settled up!</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  banner: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bannerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },
  bannerBig: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 4 },
  historyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  historyBtnText: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '600' },
  infoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5E9', borderRadius: 12, padding: 12, marginVertical: 12, gap: 8 },
  infoText: { flex: 1, fontSize: 12, color: '#2E7D32', fontWeight: '500' },
  smartHeader: { marginTop: 16, marginBottom: 4 },
  smartRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleLabel: { fontSize: 11, color: '#888', fontWeight: '700' },
  smartSub: { fontSize: 12, color: '#aaa', marginBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.accent + '33', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: COLORS.primary, fontWeight: '700', fontSize: 16 },
  balanceName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#333' },
  balanceAmt: { fontSize: 15, fontWeight: '700' },
  txnCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4 },
  txnCardHighlight: { borderWidth: 1.5, borderColor: COLORS.accent + '66' },
  txnText: { fontSize: 14, color: '#555', marginBottom: 4 },
  txnName: { fontWeight: '700', color: '#222' },
  txnAmt: { fontSize: 18, fontWeight: '800', color: COLORS.owe },
  settleBtn: { backgroundColor: COLORS.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  settleBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  allGood: { alignItems: 'center', marginTop: 40 },
  allGoodText: { fontSize: 20, fontWeight: '700', color: COLORS.accent, marginTop: 12 },
});
