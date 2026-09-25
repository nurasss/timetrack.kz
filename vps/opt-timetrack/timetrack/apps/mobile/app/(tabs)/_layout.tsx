import { Tabs } from 'expo-router';
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { colours } from '../../../../packages/shared/theme';

const labels: Record<string, string> = {
  home: 'Главная',
  history: 'История',
  requests: 'Заявки',
  calendar: 'Календарь',
  profile: 'Профиль'
};

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colours.primary,
        tabBarInactiveTintColor: colours.textSecondary,
        tabBarLabel: labels[route.name] ?? route.name,
        tabBarStyle: {
          backgroundColor: colours.card,
          borderTopColor: colours.border,
          height: 72,
          paddingTop: 8,
          paddingBottom: 10
        },
        tabBarIcon: ({ color, size }) => {
          const iconName = route.name === 'home' ? 'home' : route.name === 'history' ? 'time' : route.name === 'requests' ? 'document-text' : route.name === 'calendar' ? 'calendar' : 'person';
          return <Ionicons name={iconName as any} size={size} color={color} />;
        }
      })}
    />
  );
}
