import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, RefreshControl, Modal, ScrollView,
  TextInput, KeyboardAvoidingView, Platform, Image, Share,
} from 'react-native';
import {
  collection, query, orderBy, onSnapshot, doc,
  updateDoc, arrayUnion, arrayRemove, getDocs, where,
  deleteDoc, setDoc, serverTimestamp, deleteField, limit,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Notifications from 'expo-notifications';
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

const generateCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

export default function GroupDetailScreen({ route, navigation }) {
  const { groupId, groupName: routeGroupName } = route.params;
  const { user, isAdmin } = useAuth();
  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal state
  const [membersModalVisible, setMembersModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('members'); // 'members' | 'add' | 'invite'

  // Add-member state
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  // Invite state
  const [inviteCode, setInviteCode] = useState('');
  const [loadingInvite, setLoadingInvite] = useState(false);
  const [copyDone, setCopyDone] = useState(false);

  // Track initial load for new-expense notifications
  const isFirstExpenseLoad = useRef(true);
  const prevExpCount = useRef(0);

  const makeGuestId = () => `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // ── Group subscription ───────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'groups', groupId), (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() };
        setGroup(data);
        if (data.inviteCode) setInviteCode(data.inviteCode);
      }
    });
    return unsub;
  }, [groupId]);

  // ── Expenses subscription (with new-expense notification) ────
  useEffect(() => {
    const q = query(collection(db, 'groups', groupId, 'expenses'), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const latest = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      if (!isFirstExpenseLoad.current && latest.length > prevExpCount.current) {
        const newest = latest[0];
        Notifications.scheduleNotificationAsync({
          content: {
            title: `New expense in ${routeGroupName || 'group'}`,
            body: `${newest.paidByName} added "${newest.description}" — ${formatINR(newest.amount)}`,
          },
          trigger: null,
        }).catch(() => {});
      }
      prevExpCount.current = latest.length;
      isFirstExpenseLoad.current = false;

      setExpenses(latest);
      setLoading(false);
      setRefreshing(false);
    }, (err) => { console.error(err); setLoading(false); });
    return unsub;
  }, [groupId]);

  const totalSpent = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const isOwner = user.uid === group?.createdBy;
  const canManage = isOwner || isAdmin;

  // ── Invite helpers ────────────────────────────────────────────
  const ensureInviteCode = async () => {
    if (inviteCode) return inviteCode;
    setLoadingInvite(true);
    try {
      const code = generateCode();
      await Promise.all([
        updateDoc(doc(db, 'groups', groupId), { inviteCode: code }),
        setDoc(doc(db, 'invites', code), {
          groupId,
          groupName: group?.name || '',
          createdBy: user.uid,
          createdAt: serverTimestamp(),
        }),
      ]);
      setInviteCode(code);
      return code;
    } catch {
      Alert.alert('Error', 'Could not generate invite code. Please try again.');
      return null;
    } finally {
      setLoadingInvite(false);
    }
  };

  const handleOpenInviteTab = async () => {
    setActiveTab('invite');
    await ensureInviteCode();
  };

  const handleCopyCode = async () => {
    const code = await ensureInviteCode();
    if (!code) return;
    await Clipboard.setStringAsync(code);
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2000);
  };

  const handleShareCode = async () => {
    const code = await ensureInviteCode();
    if (!code) return;
    const msg = `Join my group "${group?.name}" on SplitKaro!\n\nInvite code: ${code}\n\nOpen SplitKaro → Groups → Join Group → enter the code above.`;
    try {
      await Share.share({ message: msg });
    } catch {}
  };

  // ── Member helpers ────────────────────────────────────────────
  const alreadyMember = (uid) => group?.members?.includes(uid);
  const emailAlreadyMember = (email) => {
    if (!email || !group?.memberDetails) return false;
    return Object.values(group.memberDetails).some(
      (m) => m.email?.toLowerCase() === email.toLowerCase()
    );
  };

  const searchUsers = async (text) => {
    setSearchInput(text);
    const trimmed = text.trim();
    const searchLower = trimmed.toLowerCase();
    if (trimmed.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const [emailExactSnap, usersSnap] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('email', '==', searchLower))),
        getDocs(query(collection(db, 'users'), limit(200))),
      ]);
      const byUid = {};
      [...emailExactSnap.docs, ...usersSnap.docs].forEach((d) => {
        const data = d.data();
        const name = (data.name || '').toLowerCase();
        const email = (data.email || '').toLowerCase();
        const matches = name.includes(searchLower) || email.includes(searchLower);
        if (matches && !byUid[data.uid]) byUid[data.uid] = data;
      });
      setSearchResults(
        Object.values(byUid).filter((u) => u.uid !== user.uid && !alreadyMember(u.uid))
      );
    } catch { /* silent */ } finally {
      setSearching(false);
    }
  };

  const pickSearchResult = async (found) => {
    setSearchInput('');
    setSearchResults([]);
    await addMemberToGroup(found.uid, found.name, found.email, true);
  };

  const addGuestToGroup = async () => {
    const trimName = guestName.trim();
    const trimEmail = guestEmail.trim().toLowerCase();
    if (!trimName) { Alert.alert('Missing name', 'Enter a name for the guest member.'); return; }
    if (trimEmail && emailAlreadyMember(trimEmail)) {
      Alert.alert('Already in group', 'This email is already in the group.');
      return;
    }
    const guestId = makeGuestId();
    await addMemberToGroup(guestId, trimName, trimEmail, false);
    setGuestName('');
    setGuestEmail('');
  };

  const addMemberToGroup = async (uid, name, email, registered) => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'groups', groupId), {
        members: arrayUnion(uid),
        [`memberDetails.${uid}`]: { name, email: email || '', registered },
      });
    } catch {
      Alert.alert('Error', 'Could not add member. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const removeMember = (uid) => {
    if (!canManage) return;
    if (uid === group?.createdBy) {
      Alert.alert('Cannot remove', 'The group creator cannot be removed.');
      return;
    }
    const name = group?.memberDetails?.[uid]?.name || 'this member';
    Alert.alert(
      'Remove Member',
      `Remove ${name} from this group? Their past expenses remain unchanged.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'groups', groupId), {
                members: arrayRemove(uid),
                [`memberDetails.${uid}`]: deleteField(),
              });
            } catch { Alert.alert('Error', 'Could not remove member.'); }
          },
        },
      ]
    );
  };

  const deleteGroup = () => {
    Alert.alert(
      'Delete Group',
      `Permanently delete "${group?.name}"? All expenses will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setMembersModalVisible(false);
              const [expSnap, settSnap] = await Promise.all([
                getDocs(collection(db, 'groups', groupId, 'expenses')),
                getDocs(collection(db, 'groups', groupId, 'settlements')),
              ]);
              const cleanupResults = await Promise.allSettled([
                ...expSnap.docs.map((d) => deleteDoc(d.ref)),
                ...settSnap.docs.map((d) => deleteDoc(d.ref)),
              ]);
              const failedCleanup = cleanupResults.filter((r) => r.status === 'rejected').length;
              if (failedCleanup > 0) {
                console.warn(`Cleanup skipped for ${failedCleanup} child document(s). Proceeding with group delete.`);
              }
              await deleteDoc(doc(db, 'groups', groupId));
              navigation.goBack();
            } catch (err) {
              const reason = err?.code ? ` (${err.code})` : '';
              Alert.alert('Error', `Could not delete the group${reason}.`);
            }
          },
        },
      ]
    );
  };

  // ── Expense card ─────────────────────────────────────────────
  const renderExpense = ({ item }) => {
    const paidByMe = item.paidBy === user.uid;
    const myShare = item.splitAmong?.find((s) => s.userId === user.uid)?.amount || 0;
    const paidByName = group?.memberDetails?.[item.paidBy]?.name || 'Someone';
    const catInfo = CATEGORIES[item.category] || CATEGORIES.other;
    let netLabel = '';
    let netColor = '#666';
    if (paidByMe) {
      const owedToMe = (item.amount || 0) - myShare;
      if (owedToMe > 0.01) { netLabel = `you get back ${formatINR(owedToMe)}`; netColor = COLORS.owed; }
      else { netLabel = 'you paid, not owed back'; }
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

  const qrUrl = inviteCode
    ? `https://api.qrserver.com/v1/create-qr-code/?data=SPLITKARO-${inviteCode}&size=180x180&margin=10`
    : null;

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
          <TouchableOpacity
            style={styles.bannerBtn}
            onPress={() => { setActiveTab('members'); setMembersModalVisible(true); }}
          >
            <Ionicons name="people-outline" size={18} color="#fff" />
            <Text style={styles.bannerBtnText}>Members</Text>
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

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddExpense', { groupId, group })}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Members / Invite Modal */}
      <Modal
        visible={membersModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setMembersModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {activeTab === 'invite' ? 'Invite Members' : activeTab === 'add' ? 'Add Members' : 'Members'}
              </Text>
              <TouchableOpacity onPress={() => setMembersModalVisible(false)}>
                <Ionicons name="close" size={24} color="#555" />
              </TouchableOpacity>
            </View>

            {/* Tab bar */}
            <View style={styles.tabBar}>
              {[['members','people-outline','Members'],['add','person-add-outline','Add'],['invite','qr-code-outline','Invite']].map(([tab, icon, label]) => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
                  onPress={() => tab === 'invite' ? handleOpenInviteTab() : setActiveTab(tab)}
                >
                  <Ionicons name={icon} size={16} color={activeTab === tab ? COLORS.primary : '#999'} />
                  <Text style={[styles.tabBtnText, activeTab === tab && styles.tabBtnTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>

              {/* Members tab */}
              {activeTab === 'members' && (
                <>
                  {group?.members?.map((uid) => {
                    const detail = group.memberDetails?.[uid] || {};
                    const isCreator = uid === group.createdBy;
                    const isMe = uid === user.uid;
                    return (
                      <View key={uid} style={styles.memberRow}>
                        <View style={styles.memberAvatar}>
                          <Text style={styles.mavText}>{(detail.name || '?').charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.memberName}>
                            {detail.name || uid}{isMe ? ' (you)' : ''}
                            {detail.registered === false ? ' · guest' : ''}
                          </Text>
                          {!!detail.email && <Text style={styles.memberEmail}>{detail.email}</Text>}
                        </View>
                        {isCreator && (
                          <Ionicons name="star" size={14} color={COLORS.accent} style={{ marginRight: 8 }} />
                        )}
                        {canManage && !isCreator && !isMe && (
                          <TouchableOpacity
                            onPress={() => removeMember(uid)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="person-remove-outline" size={20} color={COLORS.owe} />
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}

                  {canManage && (
                    <TouchableOpacity style={styles.deleteBtn} onPress={deleteGroup}>
                      <Ionicons name="trash-outline" size={18} color="#fff" />
                      <Text style={styles.deleteBtnText}>Delete Group</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

              {/* Add tab */}
              {activeTab === 'add' && (
                <>
                  <Text style={styles.modalSection}>Search Registered User</Text>
                  <View style={styles.searchInputWrap}>
                    <Ionicons name="search" size={18} color="#aaa" style={{ marginLeft: 10 }} />
                    <TextInput
                      style={styles.searchInputField}
                      placeholder="Search by name or email..."
                      value={searchInput}
                      onChangeText={searchUsers}
                      autoCapitalize="none"
                      returnKeyType="search"
                    />
                    {searching && <ActivityIndicator size="small" color={COLORS.accent} style={{ marginRight: 10 }} />}
                  </View>
                  {searchResults.length > 0 && (
                    <View style={styles.searchDropdown}>
                      {searchResults.map((u) => (
                        <TouchableOpacity
                          key={u.uid}
                          style={styles.searchResultRow}
                          onPress={() => pickSearchResult(u)}
                          disabled={saving}
                        >
                          <View style={styles.resultAvatar}>
                            <Text style={styles.mavText}>{u.name.charAt(0).toUpperCase()}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.memberName}>{u.name}</Text>
                            <Text style={styles.memberEmail}>{u.email}</Text>
                          </View>
                          <Ionicons name="person-add-outline" size={20} color={COLORS.accent} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  {searchInput.trim().length >= 2 && searchResults.length === 0 && !searching && (
                    <Text style={styles.noResults}>No users found. Add as guest below.</Text>
                  )}

                  <Text style={styles.modalSection}>Add Guest Member</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Guest name *"
                    value={guestName}
                    onChangeText={setGuestName}
                    autoCapitalize="words"
                    maxLength={40}
                  />
                  <View style={styles.searchRow}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="guest@example.com (optional)"
                      value={guestEmail}
                      onChangeText={setGuestEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                    <TouchableOpacity style={styles.searchBtn} onPress={addGuestToGroup} disabled={saving}>
                      {saving
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Ionicons name="person-add" size={20} color="#fff" />}
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* Invite tab */}
              {activeTab === 'invite' && (
                <View style={styles.inviteContainer}>
                  <Text style={styles.inviteHint}>
                    Share this code or QR with friends.{'\n'}They join via Groups → Join Group.
                  </Text>

                  {loadingInvite ? (
                    <ActivityIndicator size="large" color={COLORS.accent} style={{ marginTop: 30 }} />
                  ) : inviteCode ? (
                    <>
                      <View style={styles.qrBox}>
                        <Image source={{ uri: qrUrl }} style={styles.qrImage} resizeMode="contain" />
                      </View>

                      <View style={styles.codeBox}>
                        <Text style={styles.codeLabel}>INVITE CODE</Text>
                        <Text style={styles.codeText}>{inviteCode}</Text>
                      </View>

                      <TouchableOpacity style={styles.inviteActionBtn} onPress={handleCopyCode}>
                        <Ionicons name={copyDone ? 'checkmark' : 'copy-outline'} size={18} color="#fff" />
                        <Text style={styles.inviteActionBtnText}>{copyDone ? 'Copied!' : 'Copy Code'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.inviteActionBtn, { backgroundColor: '#2196F3', marginTop: 8 }]} onPress={handleShareCode}>
                        <Ionicons name="share-social-outline" size={18} color="#fff" />
                        <Text style={styles.inviteActionBtnText}>Share Invite</Text>
                      </TouchableOpacity>
                    </>
                  ) : null}
                </View>
              )}

            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingBottom: 8, maxHeight: '92%' },
  modalHandle: { width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.primary },
  tabBar: { flexDirection: 'row', borderRadius: 10, backgroundColor: '#F5F5F5', padding: 3, marginBottom: 12 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 8, gap: 4 },
  tabBtnActive: { backgroundColor: '#fff', elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4 },
  tabBtnText: { fontSize: 13, color: '#999', fontWeight: '600' },
  tabBtnTextActive: { color: COLORS.primary },
  modalSection: { fontSize: 13, fontWeight: '700', color: COLORS.primary, marginTop: 12, marginBottom: 8 },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  memberAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  mavText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  memberName: { fontSize: 14, fontWeight: '600', color: '#333' },
  memberEmail: { fontSize: 12, color: '#999' },
  searchInputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 10, backgroundColor: '#FAFAFA', marginBottom: 4 },
  searchInputField: { flex: 1, paddingHorizontal: 10, paddingVertical: 11, fontSize: 15, color: '#333' },
  searchDropdown: { borderWidth: 1.5, borderColor: '#E8F5E9', borderRadius: 10, backgroundColor: '#fff', marginBottom: 8, overflow: 'hidden' },
  searchResultRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  resultAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  noResults: { fontSize: 12, color: '#999', marginBottom: 8, marginTop: 2, fontStyle: 'italic' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  searchBtn: { backgroundColor: COLORS.accent, padding: 12, borderRadius: 10 },
  input: { borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, marginBottom: 8, color: '#333', backgroundColor: '#FAFAFA' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#C62828', borderRadius: 10, paddingVertical: 14, marginTop: 20, marginBottom: 8, gap: 8 },
  deleteBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  inviteContainer: { alignItems: 'center', paddingVertical: 12 },
  inviteHint: { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  qrBox: { backgroundColor: '#fff', borderRadius: 16, padding: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, marginBottom: 16 },
  qrImage: { width: 180, height: 180 },
  codeBox: { backgroundColor: '#F5F5F5', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14, marginBottom: 20, alignItems: 'center' },
  codeLabel: { fontSize: 11, fontWeight: '700', color: '#aaa', letterSpacing: 1.5, marginBottom: 4 },
  codeText: { fontSize: 28, fontWeight: '900', color: COLORS.primary, letterSpacing: 6 },
  inviteActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.accent, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24, gap: 8, width: '80%' },
  inviteActionBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
