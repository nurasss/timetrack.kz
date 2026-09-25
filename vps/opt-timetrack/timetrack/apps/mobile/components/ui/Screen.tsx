import React, { ReactNode } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { colours } from '../../../../packages/shared/theme';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  style?: any;
}

/**
 * Wrapper component providing safe area handling and optional scrolling.
 * Screens in the app should be wrapped with this to ensure proper
 * spacing from system UI elements and a consistent background colour.
 */
export function Screen({ children, scroll = false, style }: ScreenProps) {
  const Container = scroll ? ScrollView : View;
  return (
    <SafeAreaView style={[styles.container, style]}>
      <Container style={{ flex: 1 }}>{children}</Container>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colours.background,
  },
});