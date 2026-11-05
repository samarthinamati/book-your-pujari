import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StoreHeader } from './StoreHeader';
import { C, MAX_W } from '../theme';

export function Page({ children, title, showBack, testID, footer }: { children: React.ReactNode; title?: string; showBack?: boolean; testID: string; footer?: React.ReactNode }) {
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StoreHeader title={title} showBack={showBack} />
      <ScrollView testID={testID} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.inner}>{children}</View>
      </ScrollView>
      {footer}
    </SafeAreaView>
  );
}

export function Loading({ text }: { text: string }) {
  return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={C.primary} />
      <Text style={{ color: C.muted, marginTop: 10 }}>{text}</Text>
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={s.section}>{children}</Text>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 48 },
  inner: { width: '100%', maxWidth: MAX_W, alignSelf: 'center', gap: 16 },
  center: { paddingVertical: 80, alignItems: 'center' },
  section: { fontSize: 18, fontWeight: '800', color: C.ink },
});
