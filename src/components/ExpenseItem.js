import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatINR } from '../utils/calculations';

const CATEGORIES = {
  food: { icon: 'fast-food-outline', color: '#FF9800' },
  transport: { icon: 'car-outline', color: '#2196F3' },
  accommodation: { icon: 'bed-outline', color: '#9C27B0' },
  entertainment: { icon: 'film-outline', color: '#E91E63' },
  shopping: { icon: 'cart-outline', color: '#00BCD4' },
  utilities: { icon: 'receipt-outline', color: '#607D8B' },
  other: { icon: 'ellipsis-horizontal-outline', color: '#9E9E9E' },
};

const COLORS = { owe: '#C62828', owed: '#1B5E20' };

export default function ExpenseItem({ expense, currentUserId, memberDetails }) {
  const { description, amount, paidBy, category, splitAmong, dateStr } = expense;
  const catInfo = CATEGORIES[category] || CATEGORIES.other;
  const paidByName = memberDetails?.[paidBy]?.name || 'Someone';
  const paidByMe = paidBy === currentUserId;
  const myShare = splitAmong?.find((s) => s.userId === currentUserId)?.amount || 0;

  let netText = '';
  let netColor = '#888';
  if (paidByMe) {
    const owedBack = amount - myShare;
    if (owedBack > 0.01) { netText = `you get back ${formatINR(owedBack)}`; netColor = COLORS.owed; }
    else { netText = 'paid for yourself'; }
  } else {
    if (myShare > 0.01) { netText = `you owe ${formatINR(myShare)}`; netColor = COLORS.owe; }
    else { netText = 'not involved'; }
  }

  return (
    <View style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: catInfo.color + '22' }]}>
        <Ionicons name={catInfo.icon} size={22} color={catInfo.color} />
      </View>
      <View style={styles.info}>
        <Text style={styles.desc} numberOfLines={1}>{description}</Text>
        <Text style={styles.meta}>{paidByMe ? 'You' : paidByName} paid • {dateStr || ''}</Text>
        <Text style={[styles.netText, { color: netColor }]}>{netText}</Text>
      </View>
      <Text style={styles.amount}>{formatINR(amount)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 },
  iconWrap: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  info: { flex: 1 },
  desc: { fontSize: 15, fontWeight: '600', color: '#222' },
  meta: { fontSize: 12, color: '#999', marginTop: 2 },
  netText: { fontSize: 12, fontWeight: '600', marginTop: 3 },
  amount: { fontSize: 15, fontWeight: '700', color: '#333' },
});
