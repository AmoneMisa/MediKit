import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { KitsStackParamList } from '../types';
import { Spacing, Typography, Radius, Shadow } from '../theme';
import type { ColorPalette } from '../theme';
import { useColors } from '../context/ThemeContext';
import { findMedicineByBarcode } from '../assets/data/medicinesDb';
import { fetchByBarcode, barcodeCountry } from '../utils/medicineApi';

let Camera: any;
let useCameraPermission: any;
let useCameraDevice: any;
let useCodeScanner: any;

try {
  const vc = require('react-native-vision-camera');
  Camera            = vc.Camera;
  useCameraPermission = vc.useCameraPermission;
  useCameraDevice     = vc.useCameraDevice;
  useCodeScanner      = vc.useCodeScanner;
} catch {}

type Nav = NativeStackNavigationProp<KitsStackParamList, 'ScanMedicine'>;

const FRAME  = 240;
const CORNER = 24;
const CW     = 4;

function makeStyles(C: ColorPalette) {
  return StyleSheet.create({
    root:   { flex: 1, backgroundColor: '#000' },
    center: { flex: 1, backgroundColor: C.bgPage, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
    errorText: { fontSize: Typography.size.lg, color: C.textPrimary, marginBottom: Spacing.lg, textAlign: 'center' },
    permText:  { fontSize: Typography.size.lg, color: C.textPrimary, marginBottom: Spacing.lg, textAlign: 'center', fontWeight: Typography.weight.bold },
    btn: {
      backgroundColor: C.blue, borderRadius: Radius.xl,
      paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, ...Shadow.card,
    },
    btnText: { fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: C.white },

    overlay:    { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
    frameOuter: { width: FRAME, height: FRAME },
    frameClear: { position: 'absolute', top: 0, left: 0, width: FRAME, height: FRAME, backgroundColor: 'transparent' },
    corner:     { position: 'absolute', width: CORNER, height: CORNER, borderColor: '#fff' },
    cornerTL:   { top: 0, left: 0,     borderTopWidth: CW, borderLeftWidth: CW },
    cornerTR:   { top: 0, right: 0,    borderTopWidth: CW, borderRightWidth: CW },
    cornerBL:   { bottom: 0, left: 0,  borderBottomWidth: CW, borderLeftWidth: CW },
    cornerBR:   { bottom: 0, right: 0, borderBottomWidth: CW, borderRightWidth: CW },

    loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.7)' },
    loadingCard: {
      backgroundColor: C.bgCard, borderRadius: Radius.xl,
      padding: Spacing.xl, alignItems: 'center', gap: Spacing.md, ...Shadow.card,
    },
    loadingText:    { fontSize: Typography.size.lg, fontWeight: Typography.weight.bold, color: C.textPrimary },
    loadingCode:    { fontSize: Typography.size.body, color: C.textTertiary },
    loadingCountry: { fontSize: Typography.size.body, color: C.blue, fontWeight: Typography.weight.semibold },
    loadingHint:    { fontSize: Typography.size.xs, color: C.textTertiary },

    bottom:        { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingBottom: 40 },
    hint:          { color: '#fff', fontSize: Typography.size.base, textAlign: 'center', marginBottom: Spacing.xl, paddingHorizontal: Spacing.xl, fontWeight: Typography.weight.semibold },
    cancelBtn:     { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radius.xl, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)' },
    cancelBtnText: { color: '#fff', fontSize: Typography.size.base, fontWeight: Typography.weight.bold },
  });
}

export function ScanMedicineScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<any>();
  const kitId: string | undefined = route.params?.kitId;
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);

  if (!Camera) {
    return (
      <SafeAreaView style={s.center}>
        <Text style={s.errorText}>Камера недоступна</Text>
        <TouchableOpacity style={s.btn} onPress={() => navigation.goBack()}>
          <Text style={s.btnText}>Назад</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return <ScannerView navigation={navigation} kitId={kitId} />;
}

function ScannerView({ navigation, kitId }: { navigation: Nav; kitId?: string }) {
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);

  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const [scanned,      setScanned]      = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [lastBarcode,  setLastBarcode]  = useState('');
  const [country,      setCountry]      = useState('');

  const handleBarcode = useCallback(async (code: string) => {
    if (scanned) return;
    setScanned(true);
    setLastBarcode(code);
    setCountry(barcodeCountry(code));

    const local = findMedicineByBarcode(code);
    if (local) {
      navigation.replace('ManualEntry', { kitId, prefill: local });
      return;
    }

    setLoading(true);
    const api = await fetchByBarcode(code);
    setLoading(false);
    navigation.replace('ManualEntry', { kitId, prefill: api ?? { barcode: code } });
  }, [scanned, kitId, navigation]);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'ean-13', 'ean-8', 'code-128', 'code-39', 'data-matrix', 'upc-a', 'upc-e'],
    onCodeScanned: (codes: any[]) => {
      const value = codes[0]?.value;
      if (value) handleBarcode(value);
    },
  });

  if (!hasPermission) {
    return (
      <SafeAreaView style={s.center}>
        <Text style={s.permText}>Для сканирования нужен доступ к камере</Text>
        <TouchableOpacity style={s.btn} onPress={requestPermission}>
          <Text style={s.btnText}>Разрешить доступ</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!device) {
    return (
      <SafeAreaView style={s.center}>
        <Text style={s.errorText}>Камера недоступна</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={s.root}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={!scanned}
        codeScanner={codeScanner}
      />

      {/* Scan frame overlay */}
      <View style={s.overlay} pointerEvents="none">
        <View style={s.frameOuter}>
          <View style={s.frameClear} />
          {(['TL', 'TR', 'BL', 'BR'] as const).map(pos => (
            <View key={pos} style={[s.corner, s[`corner${pos}` as keyof ReturnType<typeof makeStyles>] as any]} />
          ))}
        </View>
      </View>

      {/* Loading overlay */}
      {loading && (
        <View style={s.loadingOverlay}>
          <View style={s.loadingCard}>
            <ActivityIndicator size="large" color={C.blue} />
            <Text style={s.loadingText}>Ищу в базах данных…</Text>
            <Text style={s.loadingCode}>{lastBarcode}</Text>
            {country ? <Text style={s.loadingCountry}>🌍 Производитель: {country}</Text> : null}
            <Text style={s.loadingHint}>Проверяем 7 источников</Text>
          </View>
        </View>
      )}

      {/* Bottom controls */}
      {!loading && (
        <View style={s.bottom}>
          <Text style={s.hint}>
            {scanned ? 'Обрабатываю…' : 'Наведите на штрих-код или QR-код упаковки'}
          </Text>
          {!scanned && (
            <TouchableOpacity style={s.cancelBtn} onPress={() => navigation.goBack()}>
              <Text style={s.cancelBtnText}>Отмена</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}
