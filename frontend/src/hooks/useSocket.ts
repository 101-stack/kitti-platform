'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { useAuthStore, useRoomStore, useGameStore } from '@/store/gameStore';
import type { Socket } from 'socket.io-client';
import type {
  Room, GameResult, DealCardsPayload, GameStartedPayload,
  PlayerSubmittedPayload, PlayerJoinedPayload
} from '@/types/game';

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const { token, user } = useAuthStore();
  const { room, setRoom, updateRoom } = useRoomStore();
  const {
    setGameId, setGameState, setMyCards, setSubmitDeadline,
    setGameResult, setHasSubmitted, resetGame
  } = useGameStore();
  const [roomMessages, setRoomMessages] = useState<any[]>([]);
  const [lobbyMessages, setLobbyMessages] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    if (!token) {
      disconnectSocket();
      socketRef.current = null;
      return;
    }

    const socket = getSocket(token);
    socketRef.current = socket;

    // ── Room Events ───────────────────────────────────────────────────────────

    socket.on('room_updated', (roomState: Room) => {
      setRoom(roomState);
    });

    socket.on('player_joined', ({ username, roomState }: PlayerJoinedPayload) => {
      setRoom(roomState);
      toast.success(`${username} joined the room!`);
    });

    socket.on('player_left', ({ username, roomState }: { username: string; roomState: Room }) => {
      setRoom(roomState);
      toast(`${username} left the room`, { icon: '👋' });
    });

    socket.on('player_disconnect', ({ username }: { username: string }) => {
      toast(`${username} disconnected`, { icon: '⚡' });
    });

    // ── Game Events ───────────────────────────────────────────────────────────

    socket.on('game_started', (payload: GameStartedPayload) => {
      setGameId(payload.gameId);
      setSubmitDeadline(payload.submitDeadline);
      const currentRoom = useRoomStore.getState().room;
      if (currentRoom) {
        setRoom({
          ...currentRoom,
          status: 'playing',
          currentGameId: payload.gameId,
        });
      }
      toast.success('Game started! Dealing cards...', { duration: 3000 });
    });

    socket.on('deal_cards', (payload: DealCardsPayload) => {
      setMyCards(payload.cards);
      setSubmitDeadline(payload.submitDeadline);
      toast.success('Cards dealt! Arrange your sets.', { duration: 4000 });
    });

    socket.on('player_submitted', (payload: PlayerSubmittedPayload) => {
      if (payload.userId !== user?.id) {
        toast(`${payload.username} submitted their sets`, { icon: '✅' });
      }
    });

    socket.on('players_timed_out', ({ timedOut }: { timedOut: { userId: string; username: string }[] }) => {
      timedOut.forEach((p) => {
        toast.error(`${p.username} timed out and was removed`);
      });
    });

    socket.on('game_result', (result: GameResult) => {
      setGameResult(result);
      setHasSubmitted(false);
      router.push(`/game/${result.gameId}/result`);
    });

    socket.on('game_cancelled', ({ reason }: { reason: string }) => {
      toast.error(`Game cancelled: ${reason}`);
      resetGame();
      router.push('/lobby');
    });

    socket.on('new_room_message', (payload) => {
      setRoomMessages(prev => [...prev.slice(-49), payload]);
    });

    socket.on('new_lobby_message', (payload) => {
      setLobbyMessages(prev => [...prev.slice(-49), payload]);
    });

    // ── Connection Events ─────────────────────────────────────────────────────

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
    });

    socket.on('disconnect', (reason: string) => {
      console.log('Socket disconnected:', reason);
      if (reason === 'io server disconnect') {
        toast.error('Disconnected from server. Reconnecting...');
      }
    });

    socket.on('error', (err: { message: string }) => {
      toast.error(err.message || 'A connection error occurred');
    });

    return () => {
      socket.off('room_updated');
      socket.off('player_joined');
      socket.off('player_left');
      socket.off('player_disconnect');
      socket.off('game_started');
      socket.off('deal_cards');
      socket.off('player_submitted');
      socket.off('players_timed_out');
      socket.off('game_result');
      socket.off('game_cancelled');
      socket.off('error');
      disconnectSocket();
      socketRef.current = null;
    };
  }, [token, user]);

  // ── Emit Helpers ──────────────────────────────────────────────────────────

  const createRoom = useCallback((options: {
    maxPlayers?: number;
    enable235Rule?: boolean;
    entryFee?: number;
  }) => {
    return new Promise<{ roomId: string; roomState: Room }>((resolve, reject) => {
      socketRef.current?.emit('create_room', options, (res: any) => {
        if (res?.success) resolve(res);
        else reject(new Error(res?.error || 'Failed to create room'));
      });
    });
  }, []);

  const joinRoom = useCallback((roomId: string) => {
    return new Promise<{ roomState: Room }>((resolve, reject) => {
      socketRef.current?.emit('join_room', { roomId }, (res: any) => {
        if (res?.success) resolve(res);
        else reject(new Error(res?.error || 'Failed to join room'));
      });
    });
  }, []);

  const leaveRoom = useCallback((roomId: string) => {
    return new Promise<void>((resolve, reject) => {
      socketRef.current?.emit('leave_room', { roomId }, (res: any) => {
        if (res?.success) resolve();
        else reject(new Error(res?.error || 'Failed to leave room'));
      });
    });
  }, []);

  const startGame = useCallback((roomId: string) => {
    return new Promise<{ gameId: string }>((resolve, reject) => {
      socketRef.current?.emit('start_game', { roomId }, (res: any) => {
        if (res?.success) resolve(res);
        else reject(new Error(res?.error || 'Failed to start game'));
      });
    });
  }, []);

  const submitSets = useCallback((gameId: string, sets: any[][]) => {
    return new Promise<void>((resolve, reject) => {
      socketRef.current?.emit('submit_sets', { gameId, sets }, (res: any) => {
        if (res?.success) resolve();
        else reject(new Error(res?.error || 'Failed to submit sets'));
      });
    });
  }, []);

  const setPlayerReady = useCallback((roomId: string) => {
    socketRef.current?.emit('player_ready', { roomId }, () => {});
  }, []);

  const sendRoomMessage = useCallback((roomId: string, message: string) => {
    socketRef.current?.emit('send_room_message', { roomId, message });
  }, []);

  const sendLobbyMessage = useCallback((message: string) => {
    socketRef.current?.emit('send_lobby_message', { message });
  }, []);

  return {
    socket: socketRef.current,
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    submitSets,
    setPlayerReady,
    sendRoomMessage,
    sendLobbyMessage,
    roomMessages,
    lobbyMessages
  };
};
