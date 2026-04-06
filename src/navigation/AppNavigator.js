import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View, TouchableOpacity } from 'react-native';

import { useAuth } from '../context/AuthContext';

// Auth screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';

// Main screens
import GroupsScreen from '../screens/GroupsScreen';
import CreateGroupScreen from '../screens/CreateGroupScreen';
import GroupDetailScreen from '../screens/GroupDetailScreen';
import AddExpenseScreen from '../screens/AddExpenseScreen';
import BalancesScreen from '../screens/BalancesScreen';
import SettleUpScreen from '../screens/SettleUpScreen';
import ProfileScreen from '../screens/ProfileScreen';
import JoinGroupScreen from '../screens/JoinGroupScreen';
import TransactionHistoryScreen from '../screens/TransactionHistoryScreen';

const AuthStack = createNativeStackNavigator();
const MainStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const COLORS = { primary: '#1B5E20', accent: '#4CAF50' };

function GroupsStack() {
  return (
    <MainStack.Navigator screenOptions={{ headerStyle: { backgroundColor: COLORS.primary }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: 'bold' } }}>
      <MainStack.Screen
        name="GroupsList"
        component={GroupsScreen}
        options={({ navigation }) => ({
          title: 'My Groups',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate('JoinGroup')}
              style={{ marginRight: 4 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="link-outline" size={24} color="#fff" />
            </TouchableOpacity>
          ),
        })}
      />
      <MainStack.Screen name="CreateGroup" component={CreateGroupScreen} options={{ title: 'New Group' }} />
      <MainStack.Screen name="JoinGroup" component={JoinGroupScreen} options={{ title: 'Join Group' }} />
      <MainStack.Screen name="GroupDetail" component={GroupDetailScreen} options={({ route }) => ({ title: route.params?.groupName || 'Group' })} />
      <MainStack.Screen name="AddExpense" component={AddExpenseScreen} options={{ title: 'Add Expense' }} />
      <MainStack.Screen name="Balances" component={BalancesScreen} options={{ title: 'Balances' }} />
      <MainStack.Screen name="SettleUp" component={SettleUpScreen} options={{ title: 'Settle Up' }} />
      <MainStack.Screen name="TransactionHistory" component={TransactionHistoryScreen} options={{ title: 'Transaction History' }} />
    </MainStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: '#999',
        tabBarStyle: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee' },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = { Groups: focused ? 'people' : 'people-outline', Profile: focused ? 'person' : 'person-outline' };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Groups" component={GroupsStack} options={{ title: 'Groups' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile', headerShown: true, headerStyle: { backgroundColor: COLORS.primary }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: 'bold' } }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  if (!user) {
    return (
      <AuthStack.Navigator screenOptions={{ headerStyle: { backgroundColor: COLORS.primary }, headerTintColor: '#fff' }}>
        <AuthStack.Screen name="Login" component={LoginScreen} options={{ title: 'SplitKaro', headerTitleStyle: { fontWeight: 'bold', fontSize: 22 } }} />
        <AuthStack.Screen name="Register" component={RegisterScreen} options={{ title: 'Create Account' }} />
      </AuthStack.Navigator>
    );
  }

  return <MainTabs />;
}
