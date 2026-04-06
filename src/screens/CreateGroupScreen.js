import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
  ActivityIndicator,
} from 'react-native';
import { collection, addDoc, query, getDocs, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../firebase';
import { useAuth } from '../context/AuthContext';

const COLORS = { primary: '#1B5E20', accent: '#4CAF50', bg: '#F5F5F5', danger: '#C62828' };

export default function CreateGroupScreen({ navigation }) {
  const { user, userProfile } = useAuth();
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [members, setMembers] = useState([]);   // { uid, name, email, registered }
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);

  const makeGuestId = () => `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const emailAlreadyAdded = (email) => {
    if (!email) return false;
    return members.some((member) => member.email?.toLowerCase() === email.toLowerCase());
  };

  const normalize = (v) => (v || '').trim().toLowerCase();

  const searchUsers = async (text) => {
    setSearchInput(text);
    const searchLower = normalize(text);
    if (searchLower.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const usersSnap = await getDocs(query(collection(db, 'users')));
      const matches = usersSnap.docs
        .map((d) => {
          const data = d.data();
          return {
            uid: data.uid || d.id,
            name: (data.name || '').trim(),
            email: normalize(data.email),
          };
        })
        .filter((u) => {
          if (!u.uid || !u.name) return false;
          const nameLower = normalize(u.name);
          return nameLower.includes(searchLower) || u.email.includes(searchLower);
        })
        .filter((u) => u.uid !== user.uid && !members.some((m) => m.uid === u.uid));

      const byUid = {};
      matches.forEach((u) => {
        if (!byUid[u.uid]) byUid[u.uid] = u;
      });

      setSearchResults(Object.values(byUid));
    } catch {
      // silent fail
    } finally {
      setSearching(false);
    }
  };

  const pickSearchResult = (found) => {
    const safeName = (found.name || 'User').trim();
    setSearchInput('');
    setSearchResults([]);
    setMembers((prev) => [
      ...prev,
      {
        uid: found.uid,
        name: safeName,
        email: normalize(found.email),
        registered: true,
      },
    ]);
  };

  const addGuestMember = () => {
    const trimName = guestName.trim();
    const trimEmail = normalize(guestEmail);

    if (!trimName) {
      Alert.alert('Missing name', 'Enter a name for the guest member.');
      return;
    }
    if (trimEmail === normalize(user.email)) {
      Alert.alert('Invalid email', 'Your own email is already included in the group.');
      return;
    }
    if (emailAlreadyAdded(trimEmail)) {
      Alert.alert('Already added', 'This email is already in the member list.');
      return;
    }

    setMembers((prev) => [
      ...prev,
      {
        uid: makeGuestId(),
        name: trimName,
        email: trimEmail,
        registered: false,
      },
    ]);

    setGuestName('');
    setGuestEmail('');
  };

  const removeMember = (uid) => setMembers((prev) => prev.filter((m) => m.uid !== uid));

  const createGroup = async () => {
    const trimName = groupName.trim();
    if (!trimName) {
      Alert.alert('Missing name', 'Please enter a group name.');
      return;
    }

    setCreating(true);
    try {
      // Always include ourselves
      const allMembers = [
        { uid: user.uid, name: userProfile?.name || user.displayName || 'Me', email: user.email, registered: true },
        ...members,
      ];
      const memberIds = allMembers.map((m) => m.uid);
      const memberDetails = {};
      allMembers.forEach((m) => {
        memberDetails[m.uid] = {
          name: m.name,
          email: m.email || '',
          registered: m.registered !== false,
        };
      });

      const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();

      const groupRef = await addDoc(collection(db, 'groups'), {
        name: trimName,
        description: description.trim(),
        members: memberIds,
        memberDetails,
        smartSettlementEnabled: true,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        inviteCode,
      });

      // Create invite lookup entry
      await setDoc(doc(db, 'invites', inviteCode), {
        groupId: groupRef.id,
        groupName: trimName,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });

      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', 'Could not create group. Please try again.');
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

        {/* Group Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Group Details</Text>
          <Text style={styles.label}>Group Name *</Text>
          <TextInput style={styles.input} placeholder="e.g. Goa Trip, Flat Mates" value={groupName} onChangeText={setGroupName} maxLength={40} />
          <Text style={styles.label}>Description (optional)</Text>
          <TextInput style={styles.input} placeholder="What's this group for?" value={description} onChangeText={setDescription} maxLength={100} />
        </View>

        {/* Add Members */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add Members</Text>
          <Text style={styles.hint}>Search registered users by name or email, or add guest members directly without requiring them to register.</Text>

          <Text style={styles.subTitle}>Add Registered User</Text>
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
                >
                  <View style={styles.memberAvatar}>
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

          <Text style={styles.subTitle}>Add Guest Member</Text>
          <TextInput
            style={styles.input}
            placeholder="Guest name"
            value={guestName}
            onChangeText={setGuestName}
            autoCapitalize="words"
            maxLength={40}
          />
          <View style={styles.searchRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="guest@example.com (optional)"
              value={guestEmail}
              onChangeText={setGuestEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TouchableOpacity style={styles.searchBtn} onPress={addGuestMember}>
              <Ionicons name="person-add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Creator (self) */}
          <View style={styles.memberRow}>
            <View style={styles.memberAvatar}>
              <Text style={styles.mavText}>{(userProfile?.name || 'Y').charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>{userProfile?.name || 'You'} (you)</Text>
              <Text style={styles.memberEmail}>{user?.email}</Text>
            </View>
            <Ionicons name="checkmark-circle" size={22} color={COLORS.accent} />
          </View>

          {members.map((m) => (
            <View key={m.uid} style={styles.memberRow}>
              <View style={styles.memberAvatar}>
                <Text style={styles.mavText}>{m.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>{m.name}{m.registered === false ? ' (guest)' : ''}</Text>
                <Text style={styles.memberEmail}>{m.email || 'No email added'}</Text>
              </View>
              <TouchableOpacity onPress={() => removeMember(m.uid)}>
                <Ionicons name="close-circle" size={22} color={COLORS.danger} />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Create Button */}
        <TouchableOpacity style={styles.btn} onPress={createGroup} disabled={creating}>
          {creating
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Create Group</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.bg },
  section: { backgroundColor: '#fff', margin: 16, marginBottom: 8, borderRadius: 14, padding: 16, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.primary, marginBottom: 12 },
  label: { fontSize: 13, color: '#555', marginBottom: 6, fontWeight: '600' },
  input: { borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, marginBottom: 12, color: '#333', backgroundColor: '#FAFAFA' },
  hint: { fontSize: 13, color: '#888', marginBottom: 12, lineHeight: 18 },
  subTitle: { fontSize: 13, color: COLORS.primary, marginBottom: 8, fontWeight: '700' },
  searchInputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 10, backgroundColor: '#FAFAFA', marginBottom: 4 },
  searchInputField: { flex: 1, paddingHorizontal: 10, paddingVertical: 11, fontSize: 15, color: '#333' },
  searchDropdown: { borderWidth: 1.5, borderColor: '#E8F5E9', borderRadius: 10, backgroundColor: '#fff', marginBottom: 8, overflow: 'hidden' },
  searchResultRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  noResults: { fontSize: 12, color: '#999', marginBottom: 8, marginTop: 2, fontStyle: 'italic' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  searchBtn: { backgroundColor: COLORS.accent, padding: 12, borderRadius: 10 },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  memberAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  mavText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  memberName: { fontSize: 14, fontWeight: '600', color: '#333' },
  memberEmail: { fontSize: 12, color: '#999' },
  btn: { backgroundColor: COLORS.accent, margin: 16, borderRadius: 14, paddingVertical: 16, alignItems: 'center', elevation: 3 },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
