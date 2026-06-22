import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import {
  addPlayer,
  createSession,
  getPlayersByRoom,
  getRecentHandsByRoom,
  getRoom,
  getSessionsByRoom,
} from '../../../lib/database';
import { colors } from '../../../lib/theme';
import type { HandWithDetails, Player, Room, SessionSummary } from '../../../types';

export default function RoomScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const router = useRouter();
  const id = Number(roomId);

  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [recentHands, setRecentHands] = useState<HandWithDetails[]>([]);
  const [newPlayerName, setNewPlayerName] = useState('');

  const load = useCallback(() => {
    getRoom(id).then(setRoom);
    getPlayersByRoom(id).then(setPlayers);
    getSessionsByRoom(id).then(setSessions);
    getRecentHandsByRoom(id, 5).then(setRecentHands);
  }, [id]);

  useFocusEffect(load);

  async function handleAddPlayer() {
    const name = newPlayerName.trim();
    if (!name) return;
    await addPlayer(id, name);
    setNewPlayerName('');
    load();
  }

  async function handleStartGame() {
    const sessionId = await createSession(id);
    router.push(`/room/${id}/session/${sessionId}`);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{room?.name}</Text>

      <View style={styles.actionRow}>
        <Pressable style={styles.primaryButton} onPress={handleStartGame}>
          <Text style={styles.primaryButtonText}>Yeni Oyun Başlat</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => router.push(`/room/${id}/stats`)}>
          <Text style={styles.secondaryButtonText}>İstatistikler</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Son Eller</Text>
      {recentHands.length === 0 ? (
        <Text style={styles.empty}>Henüz el kaydedilmedi</Text>
      ) : (
        recentHands.map((hand) => (
          <View key={hand.id} style={styles.handRow}>
            <Text style={styles.handTitle}>
              {hand.finisherName} bitirdi — {hand.winningTeam === 'team_a' ? 'A Takımı' : 'B Takımı'}
            </Text>
            <Text style={styles.subText}>
              A: {hand.teamAScore} · B: {hand.teamBScore} · {new Date(hand.createdAt).toLocaleString('tr-TR')}
            </Text>
          </View>
        ))
      )}

      <Text style={styles.sectionTitle}>Oyuncular</Text>
      <View style={styles.createRow}>
        <TextInput
          style={styles.input}
          placeholder="Oyuncu adı"
          value={newPlayerName}
          onChangeText={setNewPlayerName}
          onSubmitEditing={handleAddPlayer}
        />
        <Pressable style={styles.createButton} onPress={handleAddPlayer}>
          <Text style={styles.createButtonText}>Ekle</Text>
        </Pressable>
      </View>
      <View style={styles.playerWrap}>
        {players.map((p) => (
          <View key={p.id} style={styles.playerChip}>
            <Text>{p.name}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Oyunlar</Text>
      {sessions.length === 0 ? (
        <Text style={styles.empty}>Henüz oyun yok</Text>
      ) : (
        sessions.map((item) => (
          <Pressable
            key={item.id}
            style={styles.sessionRow}
            onPress={() => router.push(`/room/${id}/session/${item.id}`)}
          >
            <Text style={styles.sessionName}>{new Date(item.startedAt).toLocaleString('tr-TR')}</Text>
            <Text style={styles.subText}>{item.handCount} el</Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 16 },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  secondaryButton: {
    flex: 1,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  secondaryButtonText: { color: colors.accent, fontWeight: '700' },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: colors.subtext, marginTop: 20, marginBottom: 8 },
  handRow: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.pillBg,
    marginBottom: 8,
  },
  handTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  createRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  createButton: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  createButtonText: { color: '#fff', fontWeight: '600' },
  playerWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  playerChip: {
    backgroundColor: colors.pillBg,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  startSessionButton: {
    backgroundColor: colors.success,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  sessionRow: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: colors.pillBg,
    marginBottom: 8,
  },
  sessionName: { fontSize: 16, fontWeight: '600', color: colors.text },
  subText: { fontSize: 13, color: colors.subtext, marginTop: 4 },
  empty: { textAlign: 'center', color: colors.subtext, marginTop: 8 },
});
