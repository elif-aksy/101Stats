import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';

import { getPairStats, getPlayerStats } from '../../../lib/database';
import { colors } from '../../../lib/theme';
import type { PairStat, PlayerStat } from '../../../types';

type Mode = 'individual' | 'pairs';

export default function StatsScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const id = Number(roomId);

  const [mode, setMode] = useState<Mode>('individual');
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);
  const [pairStats, setPairStats] = useState<PairStat[]>([]);

  const load = useCallback(() => {
    getPlayerStats(id).then(setPlayerStats);
    getPairStats(id).then(setPairStats);
  }, [id]);

  useFocusEffect(load);

  return (
    <View style={styles.container}>
      <View style={styles.toggleRow}>
        <Pressable
          style={[styles.toggleButton, mode === 'individual' && styles.toggleButtonActive]}
          onPress={() => setMode('individual')}
        >
          <Text style={[styles.toggleText, mode === 'individual' && styles.toggleTextActive]}>
            Bireysel
          </Text>
        </Pressable>
        <Pressable
          style={[styles.toggleButton, mode === 'pairs' && styles.toggleButtonActive]}
          onPress={() => setMode('pairs')}
        >
          <Text style={[styles.toggleText, mode === 'pairs' && styles.toggleTextActive]}>Eşli</Text>
        </Pressable>
      </View>

      {mode === 'individual' ? (
        <FlatList
          data={playerStats}
          keyExtractor={(item) => String(item.playerId)}
          renderItem={({ item, index }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.rank}>#{index + 1}</Text>
                <Text style={styles.cardTitle}>{item.playerName}</Text>
              </View>
              <View style={styles.statRow}>
                <Stat label="Toplam Puan" value={String(item.totalScore)} />
                <Stat label="Ort. Puan" value={item.avgScore.toFixed(1)} />
                <Stat label="Galibiyet" value={`${Math.round(item.winRate * 100)}%`} />
                <Stat label="El" value={String(item.handsPlayed)} />
              </View>
              <View style={[styles.statRow, { marginTop: 8 }]}>
                <Stat label="Kafa" value={String(item.kafaCount)} />
                <Stat label="150+ Açma" value={String(item.highOpenCount)} />
                <Stat label="7+ Çift" value={String(item.pairHighCount)} />
                <Stat label="Son Elde Kalan" value={String(item.lastRemainingTiles)} />
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Henüz istatistik yok</Text>}
        />
      ) : (
        <FlatList
          data={pairStats}
          keyExtractor={(item) => `${item.playerAId}-${item.playerBId}`}
          renderItem={({ item, index }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.rank}>#{index + 1}</Text>
                <Text style={styles.cardTitle}>
                  {item.playerAName} & {item.playerBName}
                </Text>
              </View>
              <View style={styles.statRow}>
                <Stat label="Toplam Puan" value={String(item.totalScore)} />
                <Stat label="Ort. Puan" value={item.avgScore.toFixed(1)} />
                <Stat label="Galibiyet" value={`${Math.round(item.winRate * 100)}%`} />
                <Stat label="Birlikte Oynanan" value={String(item.gamesPlayed)} />
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Henüz istatistik yok</Text>}
        />
      )}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.pillBg,
    borderRadius: 24,
    padding: 4,
    marginBottom: 16,
  },
  toggleButton: { flex: 1, borderRadius: 20, paddingVertical: 10, alignItems: 'center' },
  toggleButtonActive: { backgroundColor: colors.accent },
  toggleText: { color: colors.subtext, fontWeight: '600' },
  toggleTextActive: { color: '#fff' },
  card: {
    backgroundColor: colors.pillBg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  rank: { fontSize: 13, fontWeight: '700', color: colors.accent },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  statRow: { flexDirection: 'row', gap: 20 },
  stat: { alignItems: 'flex-start' },
  statValue: { fontSize: 16, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 12, color: colors.subtext, marginTop: 2 },
  empty: { textAlign: 'center', color: colors.subtext, marginTop: 32 },
});
