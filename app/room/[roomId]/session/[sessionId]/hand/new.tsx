import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { getSessionPlayers, recordHand } from '../../../../../../lib/database';
import { colors } from '../../../../../../lib/theme';
import type { FinishType, OpenType, PenaltyType, SessionPlayerWithName, Team } from '../../../../../../types';

const FINISH_OPTIONS: { value: FinishType; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'okey_vurma', label: 'Okey Vurma' },
  { value: 'cift_bitme', label: 'Çiften Bitme' },
];

const PENALTY_OPTIONS: { value: PenaltyType; label: string }[] = [
  { value: 'islek_tas', label: 'İşlek Taş Atma' },
  { value: 'yanlis_acma', label: 'Yanlış El Açma' },
  { value: 'okey_kaptirma', label: 'Okeyini Kaptırma' },
  { value: 'tas_alma', label: 'Yandakinin Taşını Alıp Açması' },
];

const TILE_VALUES = Array.from({ length: 13 }, (_, i) => i + 1);

interface PlayerEntry {
  openType: OpenType;
  highOpen: boolean;
  pairCountHigh: boolean;
  remainingTiles: string;
}

interface PenaltyEntry {
  key: string;
  playerId: number;
  penaltyType: PenaltyType;
  tileValue: number | null;
  takenOpenType: 'seri' | 'cift' | null;
}

const EMPTY_ENTRY: PlayerEntry = { openType: 'none', highOpen: false, pairCountHigh: false, remainingTiles: '' };

function penaltyAmountPreview(p: PenaltyEntry): number {
  if (p.penaltyType === 'tas_alma') {
    return (p.tileValue ?? 0) * (p.takenOpenType === 'cift' ? 20 : 10);
  }
  return 101;
}

export default function NewHandScreen() {
  const { roomId, sessionId } = useLocalSearchParams<{ roomId: string; sessionId: string }>();
  const router = useRouter();
  const sId = Number(sessionId);

  const [sessionPlayers, setSessionPlayers] = useState<SessionPlayerWithName[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [completed, setCompleted] = useState<boolean | null>(null);
  const [finishType, setFinishType] = useState<FinishType | null>(null);
  const [winningTeam, setWinningTeam] = useState<Team | null>(null);
  const [finisherId, setFinisherId] = useState<number | null>(null);
  const [entries, setEntries] = useState<Record<number, PlayerEntry>>({});
  const [penalties, setPenalties] = useState<PenaltyEntry[]>([]);
  const [draftPlayerId, setDraftPlayerId] = useState<number | null>(null);
  const [draftType, setDraftType] = useState<PenaltyType | null>(null);
  const [draftTileValue, setDraftTileValue] = useState<number | null>(null);
  const [draftTakenOpenType, setDraftTakenOpenType] = useState<'seri' | 'cift' | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSessionPlayers(sId).then((sp) => {
      setSessionPlayers(sp);
      const initial: Record<number, PlayerEntry> = {};
      for (const p of sp) initial[p.playerId] = { ...EMPTY_ENTRY };
      setEntries(initial);
    });
  }, [sId]);

  const teamAPlayers = sessionPlayers.filter((sp) => sp.team === 'team_a');
  const teamBPlayers = sessionPlayers.filter((sp) => sp.team === 'team_b');
  const winningTeamPlayers = winningTeam === 'team_a' ? teamAPlayers : winningTeam === 'team_b' ? teamBPlayers : [];

  const remainingTargets = (
    completed === false ? sessionPlayers : sessionPlayers.filter((sp) => sp.playerId !== finisherId)
  ).filter((sp) => entries[sp.playerId]?.openType !== 'none');

  const steps = useMemo(() => {
    if (completed === false) return ['completed', 'opens', 'penalties', 'remaining'] as const;
    if (completed === true) {
      return remainingTargets.length === 0
        ? (['completed', 'finish', 'winner', 'finisher', 'opens', 'penalties'] as const)
        : (['completed', 'finish', 'winner', 'finisher', 'opens', 'penalties', 'remaining'] as const);
    }
    return ['completed'] as const;
  }, [completed, remainingTargets.length]);

  const step = steps[Math.min(stepIndex, steps.length - 1)];

  function updateEntry(playerId: number, patch: Partial<PlayerEntry>) {
    setEntries((prev) => ({ ...prev, [playerId]: { ...prev[playerId], ...patch } }));
  }

  function canGoNext(): boolean {
    switch (step) {
      case 'completed':
        return completed !== null;
      case 'finish':
        return finishType !== null;
      case 'winner':
        return winningTeam !== null;
      case 'finisher':
        return finisherId !== null;
      case 'opens':
        return true;
      case 'remaining':
        return remainingTargets.every((sp) => entries[sp.playerId]?.remainingTiles.trim() !== '');
      default:
        return true;
    }
  }

  function goNext() {
    if (!canGoNext()) return;
    if (stepIndex < steps.length - 1) setStepIndex(stepIndex + 1);
  }

  function canAddPenalty(): boolean {
    if (draftPlayerId === null || draftType === null) return false;
    if (draftType === 'tas_alma') return draftTileValue !== null && draftTakenOpenType !== null;
    return true;
  }

  function addPenalty() {
    if (!canAddPenalty() || draftPlayerId === null || draftType === null) return;
    setPenalties((prev) => [
      ...prev,
      {
        key: `${Date.now()}-${Math.random()}`,
        playerId: draftPlayerId,
        penaltyType: draftType,
        tileValue: draftType === 'tas_alma' ? draftTileValue : null,
        takenOpenType: draftType === 'tas_alma' ? draftTakenOpenType : null,
      },
    ]);
    setDraftPlayerId(null);
    setDraftType(null);
    setDraftTileValue(null);
    setDraftTakenOpenType(null);
  }

  function removePenalty(key: string) {
    setPenalties((prev) => prev.filter((p) => p.key !== key));
  }

  function goBack() {
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
    else router.back();
  }

  async function handleSave() {
    if (completed === null) return;
    if (completed && (!winningTeam || !finisherId || !finishType)) return;
    setSaving(true);
    try {
      await recordHand({
        sessionId: sId,
        finishType: completed ? finishType! : 'unfinished',
        winningTeam: completed ? winningTeam! : 'team_a',
        finisherPlayerId: completed ? finisherId! : sessionPlayers[0]?.playerId ?? 0,
        players: sessionPlayers.map((sp) => {
          const entry = entries[sp.playerId] ?? EMPTY_ENTRY;
          return {
            playerId: sp.playerId,
            team: sp.team,
            openType: entry.openType,
            highOpen: entry.highOpen,
            pairCountHigh: entry.pairCountHigh,
            remainingTiles: Number(entry.remainingTiles) || 0,
          };
        }),
        penalties: penalties.map((p) => ({
          playerId: p.playerId,
          team: sessionPlayers.find((sp) => sp.playerId === p.playerId)!.team,
          penaltyType: p.penaltyType,
          tileValue: p.tileValue ?? undefined,
          takenOpenType: p.takenOpenType ?? undefined,
        })),
      });
      router.back();
    } finally {
      setSaving(false);
    }
  }

  const isLastStep = stepIndex === steps.length - 1;

  return (
    <View style={styles.container}>
      <View style={styles.progressRow}>
        {steps.map((s, i) => (
          <View key={s} style={[styles.progressDot, i <= stepIndex && styles.progressDotActive]} />
        ))}
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {step === 'completed' && (
          <View>
            <Text style={styles.stepTitle}>El bitti mi?</Text>
            <View style={styles.pillWrap}>
              <Pill label="Bitti" selected={completed === true} onPress={() => setCompleted(true)} large />
              <Pill
                label="Bitmedi (taş kalmadı)"
                selected={completed === false}
                onPress={() => setCompleted(false)}
                large
              />
            </View>
          </View>
        )}

        {step === 'finish' && (
          <View>
            <Text style={styles.stepTitle}>Bitiş türü</Text>
            <View style={styles.pillWrap}>
              {FINISH_OPTIONS.map((opt) => (
                <Pill
                  key={opt.value}
                  label={opt.label}
                  selected={finishType === opt.value}
                  onPress={() => setFinishType(opt.value)}
                  large
                />
              ))}
            </View>
          </View>
        )}

        {step === 'winner' && (
          <View>
            <Text style={styles.stepTitle}>Kazanan takım</Text>
            <View style={styles.pillWrap}>
              <Pill
                label={teamAPlayers.map((p) => p.playerName).join(' & ')}
                selected={winningTeam === 'team_a'}
                onPress={() => setWinningTeam('team_a')}
                large
              />
              <Pill
                label={teamBPlayers.map((p) => p.playerName).join(' & ')}
                selected={winningTeam === 'team_b'}
                onPress={() => setWinningTeam('team_b')}
                large
              />
            </View>
          </View>
        )}

        {step === 'finisher' && (
          <View>
            <Text style={styles.stepTitle}>Bitiren oyuncu</Text>
            <View style={styles.pillWrap}>
              {winningTeamPlayers.map((sp) => (
                <Pill
                  key={sp.playerId}
                  label={sp.playerName}
                  selected={finisherId === sp.playerId}
                  onPress={() => setFinisherId(sp.playerId)}
                  large
                />
              ))}
            </View>
          </View>
        )}

        {step === 'opens' && (
          <View style={{ gap: 20 }}>
            <Text style={styles.stepTitle}>Açma durumları</Text>
            {sessionPlayers.map((sp) => {
              const entry = entries[sp.playerId] ?? EMPTY_ENTRY;
              return (
                <View key={sp.playerId}>
                  <Text style={styles.sectionLabel}>{sp.playerName}</Text>
                  <View style={styles.pillWrap}>
                    <Pill
                      label="Açmadı"
                      selected={entry.openType === 'none'}
                      onPress={() => updateEntry(sp.playerId, { openType: 'none', highOpen: false, pairCountHigh: false })}
                    />
                    <Pill
                      label="Seri açtı"
                      selected={entry.openType === 'seri'}
                      onPress={() => updateEntry(sp.playerId, { openType: 'seri', pairCountHigh: false })}
                    />
                    <Pill
                      label="Çift açtı"
                      selected={entry.openType === 'cift'}
                      onPress={() => updateEntry(sp.playerId, { openType: 'cift', highOpen: false })}
                    />
                  </View>
                  {entry.openType === 'seri' && (
                    <View style={[styles.pillWrap, { marginTop: 8 }]}>
                      <Pill
                        label="150+ açtı"
                        selected={entry.highOpen}
                        onPress={() => updateEntry(sp.playerId, { highOpen: !entry.highOpen })}
                      />
                    </View>
                  )}
                  {entry.openType === 'cift' && (
                    <View style={[styles.pillWrap, { marginTop: 8 }]}>
                      <Pill
                        label="7+ çift açtı"
                        selected={entry.pairCountHigh}
                        onPress={() => updateEntry(sp.playerId, { pairCountHigh: !entry.pairCountHigh })}
                      />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {step === 'penalties' && (
          <View style={{ gap: 16 }}>
            <Text style={styles.stepTitle}>Cezalar (varsa)</Text>

            {penalties.map((p) => (
              <View key={p.key} style={styles.penaltyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.penaltyText}>
                    {sessionPlayers.find((sp) => sp.playerId === p.playerId)?.playerName} —{' '}
                    {PENALTY_OPTIONS.find((opt) => opt.value === p.penaltyType)?.label}
                    {p.penaltyType === 'tas_alma' ? ` (${p.tileValue}, ${p.takenOpenType === 'cift' ? 'çift' : 'seri'})` : ''}
                  </Text>
                  <Text style={styles.penaltyAmount}>+{penaltyAmountPreview(p)}</Text>
                </View>
                <Pressable onPress={() => removePenalty(p.key)}>
                  <Text style={styles.removeText}>Sil</Text>
                </Pressable>
              </View>
            ))}

            <View style={{ gap: 12 }}>
              <Text style={styles.sectionLabel}>Oyuncu</Text>
              <View style={styles.pillWrap}>
                {sessionPlayers.map((sp) => (
                  <Pill
                    key={sp.playerId}
                    label={sp.playerName}
                    selected={draftPlayerId === sp.playerId}
                    onPress={() => setDraftPlayerId(sp.playerId)}
                  />
                ))}
              </View>

              <Text style={styles.sectionLabel}>Ceza türü</Text>
              <View style={styles.pillWrap}>
                {PENALTY_OPTIONS.map((opt) => (
                  <Pill
                    key={opt.value}
                    label={opt.label}
                    selected={draftType === opt.value}
                    onPress={() => setDraftType(opt.value)}
                  />
                ))}
              </View>

              {draftType === 'tas_alma' && (
                <>
                  <Text style={styles.sectionLabel}>Atılan taş değeri</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.pillWrap}>
                      {TILE_VALUES.map((v) => (
                        <Pill
                          key={v}
                          label={String(v)}
                          selected={draftTileValue === v}
                          onPress={() => setDraftTileValue(v)}
                        />
                      ))}
                    </View>
                  </ScrollView>

                  <Text style={styles.sectionLabel}>Taşı alan nasıl açtı?</Text>
                  <View style={styles.pillWrap}>
                    <Pill
                      label="Seri"
                      selected={draftTakenOpenType === 'seri'}
                      onPress={() => setDraftTakenOpenType('seri')}
                    />
                    <Pill
                      label="Çift"
                      selected={draftTakenOpenType === 'cift'}
                      onPress={() => setDraftTakenOpenType('cift')}
                    />
                  </View>
                </>
              )}

              <Pressable
                style={[styles.secondaryButton, !canAddPenalty() && styles.disabled]}
                onPress={addPenalty}
                disabled={!canAddPenalty()}
              >
                <Text style={styles.secondaryButtonText}>Ceza Ekle</Text>
              </Pressable>
            </View>
          </View>
        )}

        {step === 'remaining' && (
          <View style={{ gap: 16 }}>
            <Text style={styles.stepTitle}>
              {completed === false ? 'Herkesin elinde kalan taş toplamı' : 'Açan oyuncuların elinde kalan taş toplamı'}
            </Text>
            {remainingTargets.map((sp) => {
              const entry = entries[sp.playerId] ?? EMPTY_ENTRY;
              return (
                <View key={sp.playerId}>
                  <Text style={styles.sectionLabel}>{sp.playerName}</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="0"
                    value={entry.remainingTiles}
                    onChangeText={(text) => updateEntry(sp.playerId, { remainingTiles: text })}
                  />
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.secondaryButton} onPress={goBack}>
          <Text style={styles.secondaryButtonText}>Geri</Text>
        </Pressable>
        {isLastStep ? (
          <Pressable style={[styles.primaryButton, saving && styles.disabled]} onPress={handleSave} disabled={saving}>
            <Text style={styles.primaryButtonText}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Text>
          </Pressable>
        ) : (
          <Pressable style={[styles.primaryButton, !canGoNext() && styles.disabled]} onPress={goNext} disabled={!canGoNext()}>
            <Text style={styles.primaryButtonText}>İleri</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function Pill({
  label,
  selected,
  onPress,
  large,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  large?: boolean;
}) {
  return (
    <Pressable style={[styles.pill, large && styles.pillLarge, selected && styles.pillSelected]} onPress={onPress}>
      <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  progressRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  progressDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  progressDotActive: { backgroundColor: colors.accent },
  body: { flex: 1 },
  bodyContent: { paddingBottom: 24 },
  stepTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 16 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: colors.subtext, marginBottom: 8 },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.pillBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillLarge: { paddingVertical: 12, paddingHorizontal: 18 },
  pillSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  pillText: { color: colors.text, fontWeight: '500' },
  pillTextSelected: { color: '#fff' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  footer: { flexDirection: 'row', gap: 12, paddingTop: 12 },
  secondaryButton: {
    flex: 1,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: { color: colors.text, fontWeight: '600' },
  penaltyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.pillBg,
  },
  penaltyText: { fontSize: 13, fontWeight: '600', color: colors.text },
  penaltyAmount: { fontSize: 12, color: colors.danger, marginTop: 2 },
  removeText: { color: colors.danger, fontWeight: '600', marginLeft: 12 },
  primaryButton: {
    flex: 2,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.accent,
  },
  disabled: { opacity: 0.4 },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
});
