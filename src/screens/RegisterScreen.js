import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

const COLORS = { primary: '#1B5E20', accent: '#4CAF50', bg: '#F1F8E9' };

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    const trimName = name.trim();
    const trimEmail = email.trim().toLowerCase();

    if (!trimName || !trimEmail || !password || !confirm) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Password mismatch', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await register(trimName, trimEmail, password);
    } catch (err) {
      const msg = err.code === 'auth/email-already-in-use'
        ? 'An account with this email already exists.'
        : err.code === 'auth/invalid-email'
        ? 'Invalid email address.'
        : 'Registration failed. Please try again.';
      Alert.alert('Registration Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.sub}>Join SplitKaro and start splitting bills</Text>

          {[
            { label: 'Full Name', value: name, setter: setName, placeholder: 'Ravi Sharma', autoCapitalize: 'words', keyboardType: 'default', secure: false },
            { label: 'Email', value: email, setter: setEmail, placeholder: 'ravi@example.com', autoCapitalize: 'none', keyboardType: 'email-address', secure: false },
            { label: 'Password', value: password, setter: setPassword, placeholder: 'At least 6 characters', autoCapitalize: 'none', keyboardType: 'default', secure: true },
            { label: 'Confirm Password', value: confirm, setter: setConfirm, placeholder: 'Re-enter password', autoCapitalize: 'none', keyboardType: 'default', secure: true },
          ].map(({ label, value, setter, placeholder, autoCapitalize, keyboardType, secure }) => (
            <View key={label}>
              <Text style={styles.label}>{label}</Text>
              <TextInput
                style={styles.input}
                placeholder={placeholder}
                value={value}
                onChangeText={setter}
                autoCapitalize={autoCapitalize}
                keyboardType={keyboardType}
                secureTextEntry={secure}
              />
            </View>
          ))}

          <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create Account</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.linkText}>Already have an account? <Text style={styles.linkBold}>Sign In</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.primary },
  container: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 24, elevation: 6, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.primary, marginBottom: 4 },
  sub: { fontSize: 14, color: '#888', marginBottom: 24 },
  label: { fontSize: 13, color: '#555', marginBottom: 6, fontWeight: '600' },
  input: { borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 16, color: '#333', backgroundColor: '#FAFAFA' },
  btn: { backgroundColor: COLORS.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  linkBtn: { marginTop: 20, alignItems: 'center' },
  linkText: { color: '#777', fontSize: 14 },
  linkBold: { color: COLORS.primary, fontWeight: '700' },
});
