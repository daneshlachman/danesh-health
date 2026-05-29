import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { colors } from './src/utils/colors';
import DashboardScreen from './src/screens/DashboardScreen';
import NutritionScreen from './src/screens/NutritionScreen';
import WorkoutsScreen from './src/screens/WorkoutsScreen';
import ChatScreen from './src/screens/ChatScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <NavigationContainer>
        <Tab.Navigator screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.brand[500],
          tabBarInactiveTintColor: colors.gray[400],
          tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.gray[200] },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        }}>
          <Tab.Screen name="Dashboard" component={DashboardScreen}
            options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>📊</Text> }} />
          <Tab.Screen name="Nutrition" component={NutritionScreen}
            options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>🥗</Text> }} />
          <Tab.Screen name="Workouts" component={WorkoutsScreen}
            options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>🏋️</Text> }} />
          <Tab.Screen name="Chat" component={ChatScreen}
            options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>💬</Text> }} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
