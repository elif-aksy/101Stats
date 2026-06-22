import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { getHandPenalties, getHandPlayers, getHandsBySession, getSessionPlayers } from '../../../../../../lib/database';
import { colors } from '../../../../../../lib/theme';
import type { HandPenalty, HandPlayer, HandWithDetails, SessionPlayerWithName } from '../../../../../../types';

const FINISH_LABELS: Record<string, string> = {
  normal: 'Normal',
  okey_vurma: 'Okey Vurma',
  cift_bitme: 'Çiften Bitme',
  unfinished: 'Bitmedi',
};

const OPEN_LABELS: Record<string, string> = {
  none: 'Açmadı',
  seri: 'Seri açtı',
  cift: 'Çift açtı',
};

const PENALTY_LABELS: Record<string, string> = {
  islek_tas: 'İşlek Taş Atma',
  yanlis_acma: 'Yanlış El Açma',
  okey_kaptirma: 'Okeyini Kaptırma',
  tas_alma: 'Taşını Alıp Açtılar',
};

export default function HandDetailScreen() {
  const { sessionId, handId } = useLocalSearchParams<{ sessionId: string; handId: string }>();
  const sId = Number(sessionId);
  const hId = Number(handId);

  const [hand, setHand] = useState<HandWithDetails | null>(null);
  const [sessionPlayers, setSessionPlayers] = useState<SessionPlayerWithName[]>([]);
  const [handPlayers, setHandPlayers] = useState<HandPlayer[]>([]);
  const [penalties, setPenalties] = useState<HandPenalty[]>([]);

  useEffect(() => {
    getHandsBySession(sId).then((hands) => setHand(hands.find((h) => h.id === hId) ?? null));
    getSessionPlayers(sId).then(setSessionPlayers);
    getHandPlayers(hId).then(setHandPlayers);
    getHandPenalties(hId).then(setPenalties);
  }, [sId, hId]);

  if (!hand) return null;

  const teamAName = sessionPlayers.filter((sp) => sp.team === 'team_a').map((sp) => sp.playerName).join(' & ');
  const teamBName = sessionPlayers.filter((sp) => sp.team === 'team_b').map((sp) => sp.playerName).join(' & ');

  function nameOf(playerId: number): string {
    return sessionPlayers.find((sp) => sp.playerId === playerId)?.playerName ?? '';
  }

  function teamOf(playerId: number): 'team_a' | 'team_b' | undefined {
    return sessionPlayers.find((sp) => sp.playerId === playerId)?.team;
  }

  const teamAPlayers = handPlayers.filter((hp) => teamOf(hp.playerId) === 'team_a');
  const teamBPlayers = handPlayers.filter((hp) => teamOf(hp.playerId) === 'team_b');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>El {hand.handNumber}</Text>
      <Text style={styles.subText}>
        {FINISH_LABELS[hand.finishType]}
        {hand.finishType !== 'unfinished' ? ` · Bitiren: ${hand.finisherName}` : ''}
      </Text>

      <View style={styles.scoreBoard}>
        <View style={styles.scoreCol}>
          <Text style={styles.scoreTeamName}>{teamAName}</Text>
          <Text style={styles.scoreValue}>{hand.teamAScore}</Text>
        </View>
        <Text style={styles.scoreDivider}>—</Text>
        <View style={styles.scoreCol}>
          <Text style={styles.scoreTeamName}>{teamBName}</Text>
          <Text style={styles.scoreValue}>{hand.teamBScore}</Text>
        </View>
      </View>

      <TeamSection title={teamAName} players={teamAPlayers} nameOf={nameOf} />
      <TeamSection title={teamBName} players={teamBPlayers} nameOf={nameOf} />

      {penalties.length > 0 && (
        <View style={{ marginTop: 20 }}>
          <Text style={styles.sectionLabel}>Cezalar</Text>
          {penalties.map((p) => (
            <View key={p.id} style={styles.playerRow}>
              <Text style={styles.playerName}>{nameOf(p.playerId)}</Text>
              <Text style={styles.playerDetail}>
                {PENALTY_LABELS[p.penaltyType]}
                {p.penaltyType === 'tas_alma' ? ` (${p.tileValue}, ${p.takenOpenType === 'cift' ? 'çift' : 'seri'})` : ''}
              </Text>
              <Text style={styles.playerScore}>+{p.amount}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function TeamSection({
  title,
  players,
  nameOf,
}: {
  title: string;
  players: HandPlayer[];
  nameOf: (playerId: number) => string;
}) {
  return (
    <View style={{ marginTop: 20 }}>
      <Text style={styles.sectionLabel}>{title}</Text>
      {players.map((hp) => (
        <View key={hp.id} style={styles.playerRow}>
          <Text style={styles.playerName}>{nameOf(hp.playerId)}</Text>
          <Text style={styles.playerDetail}>{OPEN_LABELS[hp.openType]}</Text>
          {hp.openType === 'seri' && hp.highOpen && <Text style={styles.playerDetail}>150+ açtı</Text>}
          {hp.openType === 'cift' && hp.pairCountHigh && <Text style={styles.playerDetail}>7+ çift açtı</Text>}
          {hp.openType === 'none' ? (
            <Text style={styles.playerDetail}>Otomatik ceza: 202</Text>
          ) : (
            <Text style={styles.playerDetail}>Elinde kalan: {hp.remainingTiles}</Text>
          )}
          <Text style={styles.playerScore}>Bireysel puan: {hp.individualScore}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  content: { paddingBottom: 32 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  subText: { fontSize: 13, color: colors.subtext, marginTop: 4 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: colors.subtext, marginBottom: 8 },
  scoreBoard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.pillBg,
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 16,
  },
  scoreCol: { alignItems: 'center', flex: 1 },
  scoreTeamName: { fontSize: 13, color: colors.subtext, marginBottom: 4 },
  scoreValue: { fontSize: 28, fontWeight: '800', color: colors.accent },
  scoreDivider: { fontSize: 18, color: colors.subtext },
  playerRow: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.pillBg,
    marginBottom: 8,
  },
  playerName: { fontSize: 14, fontWeight: '700', color: colors.text },
  playerDetail: { fontSize: 12, color: colors.subtext, marginTop: 2 },
  playerScore: { fontSize: 12, fontWeight: '700', color: colors.accent, marginTop: 4 },
});
