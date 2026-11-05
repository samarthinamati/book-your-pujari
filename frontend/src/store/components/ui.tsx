import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../theme';

export function QtyStepper({ value, onChange, max, testID }: { value: number; onChange: (n: number) => void; max: number; testID: string }) {
  return (
    <View style={s.stepper}>
      <Pressable testID={`${testID}-decrease`} onPress={() => onChange(value - 1)} style={s.stepBtn}>
        <Ionicons name="remove" size={16} color={C.ink} />
      </Pressable>
      <Text testID={`${testID}-value`} style={s.stepVal}>{value}</Text>
      <Pressable testID={`${testID}-increase`} disabled={value >= max} onPress={() => onChange(value + 1)} style={[s.stepBtn, value >= max && { opacity: 0.4 }]}>
        <Ionicons name="add" size={16} color={C.ink} />
      </Pressable>
    </View>
  );
}

export function Btn({ label, onPress, variant = 'primary', disabled, loading, testID, icon }: {
  label: string; onPress: () => void; variant?: 'primary' | 'saffron' | 'outline'; disabled?: boolean; loading?: boolean; testID: string; icon?: any;
}) {
  const bg = variant === 'primary' ? C.primary : variant === 'saffron' ? C.saffron : C.white;
  const fg = variant === 'outline' ? C.primaryDark : C.white;
  return (
    <Pressable
      testID={testID}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [s.btn, { backgroundColor: bg }, variant === 'outline' && s.btnOutline, (disabled || loading) && { opacity: 0.55 }, pressed && { transform: [{ scale: 0.98 }] }]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {icon && <Ionicons name={icon} size={18} color={fg} />}
          <Text style={[s.btnText, { color: fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label: string; testID: string; error?: boolean }) {
  const { label, error, style, ...rest } = props;
  return (
    <View style={{ gap: 6, flex: 1, minWidth: 200 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput placeholderTextColor="#9CA3AF" {...rest} style={[s.input, error && { borderColor: C.danger }, style]} />
    </View>
  );
}

export function Notice({ text, tone = 'info', testID }: { text: string; tone?: 'info' | 'error' | 'success' | 'demo'; testID?: string }) {
  const map = {
    info: [C.primaryLight, C.primaryDark],
    error: [C.dangerBg, C.danger],
    success: [C.successBg, C.success],
    demo: [C.demoBg, C.demo],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View testID={testID} style={[s.notice, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 14, lineHeight: 20, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}

export function Row({ label, value, bold, testID, tag }: { label: string; value: string; bold?: boolean; testID?: string; tag?: string }) {
  return (
    <View style={s.row}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
        <Text style={[s.rowLabel, bold && s.rowBold]}>{label}</Text>
        {!!tag && <Text style={s.tag}>{tag}</Text>}
      </View>
      <Text testID={testID} style={[s.rowValue, bold && s.rowBold]}>{value}</Text>
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function StatusChip({ status, label, testID }: { status?: string; label: string; testID?: string }) {
  const done = status === 'Delivered';
  const bad = status === 'Cancelled';
  return (
    <Text testID={testID} style={[s.chip, done && { backgroundColor: C.successBg, color: C.success }, bad && { backgroundColor: C.dangerBg, color: C.danger }]}>
      {label}
    </Text>
  );
}

const s = StyleSheet.create({
  chip: { fontSize: 12, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, overflow: 'hidden', backgroundColor: C.primaryLight, color: C.primaryDark },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.line, borderRadius: 12, backgroundColor: C.white, alignSelf: 'flex-start' },
  stepBtn: { paddingHorizontal: 12, paddingVertical: 9 },
  stepVal: { minWidth: 30, textAlign: 'center', fontWeight: '700', fontSize: 15, color: C.ink },
  btn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, flexGrow: 1 },
  btnOutline: { borderWidth: 1.5, borderColor: C.primary },
  btnText: { fontSize: 15, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '600', color: C.muted },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.ink, backgroundColor: C.white },
  notice: { borderRadius: 12, padding: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, gap: 10 },
  rowLabel: { fontSize: 14, color: C.muted },
  rowValue: { fontSize: 14, color: C.ink, fontWeight: '600' },
  rowBold: { fontSize: 17, color: C.ink, fontWeight: '800' },
  tag: { fontSize: 10, fontWeight: '800', color: C.demo, backgroundColor: C.demoBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  card: { backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 16, gap: 10 },
});
