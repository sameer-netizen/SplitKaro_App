import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

const COLORS = { primary: '#1B5E20', accent: '#4CAF50', bg: '#F5F5F5', danger: '#C62828' };
const APP_SHARE_URL = 'https://splitkaro.expo.app';

export default function ProfileScreen() {
  const { user, userProfile, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleShareApp = async () => {
    const message = `Track shared expenses with me on SplitKaro!\n\nOpen or install here: ${APP_SHARE_URL}`;
    try {
      await Share.share({
        title: 'SplitKaro',
        message,
        url: APP_SHARE_URL,
      });
    } catch {
      Alert.alert('Error', 'Could not open share options. Please try again.');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            try {
              await logout();
            } catch (err) {
              Alert.alert('Error', 'Could not sign out. Please try again.');
              setLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  const displayName = userProfile?.name || user?.displayName || 'User';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Profile header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      {/* Info card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account Details</Text>

        <View style={styles.infoRow}>
          <Ionicons name="person-outline" size={20} color={COLORS.accent} style={styles.infoIcon} />
          <View>
            <Text style={styles.infoLabel}>Name</Text>
            <Text style={styles.infoValue}>{displayName}</Text>
          </View>
        </View>

        <View style={styles.separator} />

        <View style={styles.infoRow}>
          <Ionicons name="mail-outline" size={20} color={COLORS.accent} style={styles.infoIcon} />
          <View>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user?.email}</Text>
          </View>
        </View>
      </View>

      {/* App info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>About SplitKaro</Text>
        <View style={styles.infoRow}>
          <Ionicons name="information-circle-outline" size={20} color={COLORS.accent} style={styles.infoIcon} />
          <View>
            <Text style={styles.infoLabel}>Version</Text>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>
        </View>
        <View style={styles.separator} />
        <View style={styles.infoRow}>
          <Ionicons name="logo-react" size={20} color={COLORS.accent} style={styles.infoIcon} />
          <View>
            <Text style={styles.infoLabel}>Built with</Text>
            <Text style={styles.infoValue}>React Native + Firebase</Text>
          </View>
        </View>
        <View style={styles.separator} />
        <View style={styles.infoRow}>
          <Ionicons name="cash-outline" size={20} color={COLORS.accent} style={styles.infoIcon} />
          <View>
            <Text style={styles.infoLabel}>Currency</Text>
            <Text style={styles.infoValue}>Indian Rupee (₹)</Text>
          </View>
        </View>

        <View style={styles.separator} />

        <TouchableOpacity style={styles.shareBtn} onPress={handleShareApp}>
          <Ionicons name="share-social-outline" size={18} color="#fff" />
          <Text style={styles.shareText}>Share SplitKaro App</Text>
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} disabled={loggingOut}>
        {loggingOut
          ? <ActivityIndicator color="#fff" />
          : (
            <>
              <Ionicons name="log-out-outline" size={20} color="#fff" />
              <Text style={styles.logoutText}>Sign Out</Text>
            </>
          )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { backgroundColor: COLORS.primary, paddingVertical: 36, alignItems: 'center' },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)' },
  avatarText: { color: '#fff', fontSize: 36, fontWeight: '800' },
  name: { color: '#fff', fontSize: 22, fontWeight: '700' },
  email: { color: '#A5D6A7', fontSize: 13, marginTop: 4 },
  card: { backgroundColor: '#fff', margin: 16, marginBottom: 8, borderRadius: 14, padding: 16, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  infoIcon: { marginRight: 14 },
  infoLabel: { fontSize: 11, color: '#aaa', fontWeight: '600', textTransform: 'uppercase' },
  infoValue: { fontSize: 15, color: '#333', fontWeight: '500', marginTop: 1 },
  separator: { height: 1, backgroundColor: '#F5F5F5', marginVertical: 8 },
  shareBtn: { marginTop: 4, backgroundColor: COLORS.accent, borderRadius: 10, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  shareText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  logoutBtn: { backgroundColor: COLORS.danger, margin: 16, borderRadius: 14, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, elevation: 3 },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
