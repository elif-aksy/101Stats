import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { createRoom, getRooms } from '../lib/database';
import type { Room } from '../types';

export default function RoomListScreen() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [newRoomName, setNewRoomName] = useState('');

  const loadRooms = useCallback(() => {
    getRooms().then(setRooms);
  }, []);

  useFocusEffect(loadRooms);

  async function handleCreateRoom() {
    const name = newRoomName.trim();
    if (!name) return;
    await createRoom(name);
    setNewRoomName('');
    loadRooms();
  }

  return (
    <View style={styles.container}>
      <View style={styles.createRow}>
        <TextInput
          style={styles.input}
          placeholder="Oda adı"
          value={newRoomName}
          onChangeText={setNewRoomName}
          onSubmitEditing={handleCreateRoom}
        />
        <Pressable style={styles.createButton} onPress={handleCreateRoom}>
          <Text style={styles.createButtonText}>Ekle</Text>
        </Pressable>
      </View>
      <FlatList
        data={rooms}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            style={styles.roomRow}
            onPress={() => router.push(`/room/${item.id}`)}
          >
            <Text style={styles.roomName}>{item.name}</Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Henüz oda yok</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  createRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  createButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  createButtonText: { color: '#fff', fontWeight: '600' },
  list: { gap: 8 },
  roomRow: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  roomName: { fontSize: 16, fontWeight: '600' },
  empty: { textAlign: 'center', color: '#888', marginTop: 32 },
});
