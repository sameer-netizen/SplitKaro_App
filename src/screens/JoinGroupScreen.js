import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../firebase';
import { useAuth } from '../context/AuthContext';

const COLORS = { primary: '#1B5E20', accent: '#4CAF50', bg: '#F5F5F5' };

export default function JoinGroupScreen({ navigation }) {
  const { user, userProfile } = useAuth();
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);

  const handleJoin = async () => {
    const trimCode = code.trim().toUpperCase();
    if (trimCode.length < 4) {
      Alert.alert('Invalid code', 'Enter a valid invite code (at least 4 characters).');
      return;
    }
    setJoining(true);
    try {
      const inviteSnap = await getDoc(doc(db, 'invites', trimCode));
      if (!inviteSnap.exists()) {
        Alert.alert('Not found', 'This invite code is invalid or has expired.');
        return;
      }
      const { groupId } = inviteSnap.data();

      const groupSnap = await getDoc(doc(db, 'groups', groupId));
      if (!groupSnap.exists()) {
        Alert.alert('Error', 'This group no longer exists.');
        return;
      }
      const groupData = groupSnap.data();

      if (groupData.members?.includes(user.uid)) {
        Alert.alert('Already a member', "You're already in this group.", [
          { text: 'Open Group', onPress: () => navigation.replace('GroupDetail', { groupId, groupName: groupData.name }) },
        ]);
        return;
      }

      const name = userProfile?.name || user.displayName || user.email;
      await updateDoc(doc(db, 'groups', groupId), {
        members: arrayUnion(user.uid),
        [`memberDetails.${user.uid}`]: { name, email: user.email, registered: true },
      });

      Alert.alert('Joined! 🎉', `Welcome to "${groupData.name}"!`, [
        { text: 'Open Group', onPress: () => navigation.replace('GroupDetail', { groupId, groupName: groupData.name }) },
      ]);
    } catch (err) {
      Alert.alert('Error', 'Could not join group. Please try again.');
      console.error(err);
    } finally {
      setJoining(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <View style={styles.card}>
          <Ionicons name="link-outline" size={52} color={COLORS.accent} style={{ marginBottom: 16 }} />
          <Text style={styles.title}>Join a Group</Text>
          <Text style={styles.sub}>
            Enter the invite code shared by your group admin to join instantly.
          </Text>
          <TextInput
            style={styles.codeInput}
            placeholder="ABC123"
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
            returnKeyType="go"
            onSubmitEditing={handleJoin}
          />
          <TouchableOpacity style={styles.btn} onPress={handleJoin} disabled={joining}>
            {joining ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="enter-outline" size={20} color="#fff" />
                <Text style={styles.btnText}>Join Group</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 28, alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.primary, marginBottom: 8 },
  sub: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  codeInput: {
    borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 14,
    fontSize: 24, fontWeight: '800', color: COLORS.primary,
    textAlign: 'center', letterSpacing: 6,
    width: '100%', backgroundColor: '#FAFAFA', marginBottom: 20,
  },
  btn: {
    backgroundColor: COLORS.accent, borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 24,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    width: '100%', justifyContent: 'center',
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
