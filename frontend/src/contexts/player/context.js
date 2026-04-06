import { createContext, useContext } from 'react';

export const PlayerContext = createContext();
export const PLAYER_SESSION_STORAGE_KEY = 'spotiflow.player.sessionId';

export function usePlayer() {
    return useContext(PlayerContext);
}
