import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import {
  endSession,
  getHandsBySession,
  getPlayersByRoom,
  getSessionPlayers,
  setSessionPlayers,
} from '../../../../../lib/database';
import { colors } from '../../../../../lib/theme';
import type { HandWithDetails, Player, SessionPlayerWithName } from '../../../../../types';

const FINISH_LABELS: Record<string, string> = {
  normal: 'Normal',
  okey_vurma: 'Okey Vurma',
  cift_bitme: 'Çiften Bitme',
  unfinished: 'Bitmedi',
};

export default function GameScreen() {
  const { roomId, sessionId } = useLocalSearchParams<{ roomId: string; sessionId: string }>();
  const router = useRouter();
  const rId = Number(roomId);
  const sId = Number(sessionId);

  const [players, setPlayers] = useState<Player[]>([]);
  const [sessionPlayers, setSessionPlayersState] = useState<SessionPlayerWithName[]>([]);
  const [hands, setHands] = useState<HandWithDetails[]>([]);
  const [teamA, setTeamA] = useState<number[]>([]);
  const [teamB, setTeamB] = useState<number[]>([]);
  const [savingTeams, setSavingTeams] = useState(false);

  const load = useCallback(() => {
    getPlayersByRoom(rId).then(setPlayers);
    getSessionPlayers(sId).then(setSessionPlayersState);
    getHandsBySession(sId).then(setHands);
  }, [rId, sId]);

  useFocusEffect(load);

  const teamsSet = sessionPlayers.length === 4;

  function toggleTeamMember(team: 'team_a' | 'team_b', playerId: number) {
    const [current, other, setCurrent] = team === 'team_a' ? [teamA, teamB, setTeamA] : [teamB, teamA, setTeamB];
    if (other.includes(playerId)) return;
    if (current.includes(playerId)) {
      setCurrent(current.filter((pid) => pid !== playerId));
    } else if (current.length < 2) {
      setCurrent([...current, playerId]);
    }
  }

  async function handleSaveTeams() {
    if (teamA.length !== 2 || teamB.length !== 2) return;
    setSavingTeams(true);
    try {
      await setSessionPlayers(sId, teamA, teamB);
      load();
    } finally {
      setSavingTeams(false);
    }
  }

  async function handleEndGame() {
    await endSession(sId);
    router.back();
  }

  const teamAName = sessionPlayers.filter((sp) => sp.team === 'team_a').map((sp) => sp.playerName).join(' & ');
  const teamBName = sessionPlayers.filter((sp) => sp.team === 'team_b').map((sp) => sp.playerName).join(' & ');

  const totalA = hands.reduce((sum, h) => sum + h.teamAScore, 0);
  const totalB = hands.reduce((sum, h) => sum + h.teamBScore, 0);

  if (!teamsSet) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Takımları Seç</Text>
        <View style={{ gap: 20 }}>
          <View>
            <Text style={styles.sectionLabel}>Takım A</Text>
            <View style={styles.pillWrap}>
              {players.map((p) => (
                <Pill
                  key={p.id}
                  label={p.name}
                  selected={teamA.includes(p.id)}
                  disabled={teamB.includes(p.id)}
                  onPress={() => toggleTeamMember('team_a', p.id)}
                />
              ))}
            </View>
          </View>
          <View>
            <Text style={styles.sectionLabel}>Takım B</Text>
            <View style={styles.pillWrap}>
              {players.map((p) => (
                <Pill
                  key={p.id}
                  label={p.name}
                  selected={teamB.includes(p.id)}
                  disabled={teamA.includes(p.id)}
                  onPress={() => toggleTeamMember('team_b', p.id)}
                />
              ))}
            </View>
          </View>
        </View>
        <Pressable
          style={[styles.primaryButton, (teamA.length !== 2 || teamB.length !== 2) && styles.disabled]}
          onPress={handleSaveTeams}
          disabled={teamA.length !== 2 || teamB.length !== 2 || savingTeams}
        >
          <Text style={styles.primaryButtonText}>{savingTeams ? 'Kaydediliyor...' : 'Takımları Kaydet'}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.scoreBoard}>
        <View style={styles.scoreCol}>
          <Text style={styles.scoreTeamName}>{teamAName}</Text>
          <Text style={styles.scoreValue}>{totalA}</Text>
        </View>
        <Text style={styles.scoreDivider}>—</Text>
        <View style={styles.scoreCol}>
          <Text style={styles.scoreTeamName}>{teamBName}</Text>
          <Text style={styles.scoreValue}>{totalB}</Text>
        </View>
      </View>

      <Pressable
        style={styles.primaryButton}
        onPress={() => router.push(`/room/${rId}/session/${sId}/hand/new`)}
      >
        <Text style={styles.primaryButtonText}>Yeni El</Text>
      </Pressable>

      <Text style={styles.sectionLabel}>Eller</Text>
      {hands.length === 0 ? (
        <Text style={styles.empty}>Henüz el kaydedilmedi</Text>
      ) : (
        [...hands].reverse().map((hand) => (
          <Pressable
            key={hand.id}
            style={styles.handRow}
            onPress={() => router.push(`/room/${rId}/session/${sId}/hand/${hand.id}`)}
          >
            <Text style={styles.handTitle}>
              El {hand.handNumber} —{' '}
              {hand.finishType === 'unfinished'
                ? 'Bitmedi'
                : `${hand.winningTeam === 'team_a' ? teamAName : teamBName} kazandı`}
            </Text>
            <Text style={styles.subText}>
              {FINISH_LABELS[hand.finishType]}
              {hand.finishType !== 'unfinished' ? ` · Bitiren: ${hand.finisherName}` : ''}
            </Text>
            <Text style={styles.subText}>
              {teamAName}: {hand.teamAScore} · {teamBName}: {hand.teamBScore}
            </Text>
          </Pressable>
        ))
      )}

      <Pressable style={styles.endButton} onPress={handleEndGame}>
        <Text style={styles.endButtonText}>Oyunu Bitir</Text>
      </Pressable>
    </ScrollView>
  );
}

function Pill({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.pill, selected && styles.pillSelected, disabled && styles.pillDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  content: { paddingBottom: 32 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 16 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: colors.subtext, marginTop: 16, marginBottom: 8 },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.pillBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  pillDisabled: { opacity: 0.35 },
  pillText: { color: colors.text, fontWeight: '500' },
  pillTextSelected: { color: '#fff' },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.4 },
  scoreBoard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.pillBg,
    borderRadius: 12,
    paddingVertical: 16,
  },
  scoreCol: { alignItems: 'center', flex: 1 },
  scoreTeamName: { fontSize: 13, color: colors.subtext, marginBottom: 4 },
  scoreValue: { fontSize: 28, fontWeight: '800', color: colors.accent },
  scoreDivider: { fontSize: 18, color: colors.subtext },
  handRow: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.pillBg,
    marginBottom: 8,
  },
  handTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  subText: { fontSize: 12, color: colors.subtext, marginTop: 2 },
  empty: { textAlign: 'center', color: colors.subtext, marginTop: 8 },
  endButton: {
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.danger,
    marginTop: 20,
  },
  endButtonText: { color: colors.danger, fontWeight: '700' },
});
