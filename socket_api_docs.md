# Internet Bachelor: Detailed Socket API Documentation

This guide provides a comprehensive step-by-step breakdown of every socket event, input/output data structure, and the complete game workflow.

---

## 1. Authentication & Connection
The socket server requires a valid JWT token for authentication.

*   **Endpoint**: `ws://your-server-url`
*   **Connection Data**: The token must be provided in the `auth` object or `query` parameters.
    *   **Option 1 (Preferred)**: `socket = io(url, { auth: { token: 'YOUR_JWT_TOKEN' } });`
    *   **Option 2**: `socket = io(url, { query: { token: 'YOUR_JWT_TOKEN' } });`

---

## 2. Global Event Wrapper (Client -> Server)

Most game actions are wrapped in a single `GAME_EVENT` to maintain a unified structure.

**Input Structure:**
```json
{
  "gameId": "uuid-string",
  "type": "ACTION_TYPE",
  "payload": { ... }
}
```

**Standard ACK Response:**
Every emit returns an acknowledgment (ACK) to confirm the action was processed.
```json
{
  "success": true,
  "data": { ... }, // Optional returned data
  "message": "Optional status message"
}
```

---

## 3. Step-by-Step Event Reference

### Phase 1: Lobby & Setup

#### [EMIT] `CREATE_GAME` (Host Only)
*   **Input**: `{ gameType: "INTERNET_BACHELOR" }`
*   **Output (ACK)**: `{ success: true, data: { gameId: "uuid" } }`

#### [EMIT] `JOIN_GAME` (Player Only)
*   **Input**: `{ gameId: "uuid" }`
*   **Output (ACK)**: Returns the full `session` object.
*   **Broadcast**: Everyone in the room receives `NETWORK_STATUS` and `PLAYERS_UPDATE`.

#### [EMIT] `PLAYER_READY` (via `GAME_EVENT`)
*   **Input**: `type: "PLAYER_READY", payload: {}`
*   **Broadcast**: `PLAYERS_UPDATE` sent to all.

#### [EMIT] `EXIT_GAME` (via `GAME_EVENT`)
*   **Purpose**: Any user can formally leave the game session.
*   **Input**: `type: "EXIT_GAME", payload: {}`
*   **Behavior**: Removes user from player list. If Host leaves, the game ends.
*   **Broadcasts**: `NETWORK_STATUS` and `PLAYERS_UPDATE`.

---

### Phase 2: Gameplay Loop

#### [EMIT] `START_GAME` (via `GAME_EVENT`) (Host Only)
*   **Prerequisite**: All players must be ready.
*   **Input**: `type: "START_GAME", payload: {}`
*   **Broadcast**: `ROUND_STARTED` sent to all with round details.

#### [EMIT] `TYPING` (via `GAME_EVENT`)
*   **Input**: `type: "TYPING", payload: { isTyping: true/false }`
*   **Broadcast**: `USER_TYPING` sent to all.

#### [EMIT] `SEND_QUESTION` (via `GAME_EVENT`) (Host Only)
*   **Input**: `type: "SEND_QUESTION", payload: { question: "What is your favorite color?" }`
*   **Broadcast**: `NEW_QUESTION` sent to all players.

#### [EMIT] `SUBMIT_DATA` (via `GAME_EVENT`) (Player Only)
*   **Input**: `type: "SUBMIT_DATA", payload: { data: { answer: "Blue" } }`
*   **Broadcast**: `ANSWER_SUBMITTED` sent **ONLY to the Host**.

---

### Phase 3: Elimination & Progression

#### [EMIT] `ELIMINATE` (via `GAME_EVENT`) (Host Only)
*   **Input**: `type: "ELIMINATE", payload: { playerIds: ["id1"], points: 50 }`
*   **Broadcast**: `PLAYERS_UPDATE` sent to all.
*   **Special Broadcast**: If the round target is met, Host receives `CAN_NEXT`.

#### [EMIT] `NEXT_ROUND` (via `GAME_EVENT`) (Host Only)
*   **Input**: `type: "NEXT_ROUND", payload: {}`
*   **Broadcast**: `ROUND_STARTED` for the next round.

---

## 4. Listener Reference (Server -> Client)

Clients should listen for the `GAME_EVENT` channel to receive updates.

| Event Type (`type`) | Payload Description | Who Listens |
| :--- | :--- | :--- |
| `NETWORK_STATUS` | `{ userId, isConnected, isHost, message }` | Everyone |
| `PLAYERS_UPDATE` | `Array<Player>` (Full list of all players) | Everyone |
| `USER_TYPING` | `{ userId, isTyping }` | Everyone |
| `NEW_QUESTION` | `{ question: string }` | Players |
| `ROUND_STARTED` | `{ type: "QUESTION/IMAGE/VIDEO", nextAtCount: number }` | Everyone |
| `CAN_NEXT` | `{ nextRoundIndex: number }` | **Host Only** |
| `GAME_ENDED` | `{ winner: Player }` | Everyone |

---

## 5. Full Workflow Walkthrough

### 1. The Setup
1.  **Host** calls `CREATE_GAME`. Receives `gameId`.
2.  **Players** call `JOIN_GAME` with the `gameId`.
3.  **Players** click ready, sending `PLAYER_READY`.
4.  **Host** sees all players are ready via `PLAYERS_UPDATE`.

### 2. The Round Begins
1.  **Host** calls `START_GAME`.
2.  **Everyone** receives `ROUND_STARTED`.
3.  **Host** types a question and calls `SEND_QUESTION`.
4.  **Players** receive `NEW_QUESTION` and see the text.

### 3. Submissions
1.  **Players** type their answers.
2.  **Host** sees `USER_TYPING` indicators.
3.  **Players** call `SUBMIT_DATA`.
4.  **Host** receives answers directly (others don't see them).

### 4. Elimination
1.  **Host** reviews answers and calls `ELIMINATE` on a player.
2.  **Everyone** sees the player's status change in `PLAYERS_UPDATE`.
3.  **Host** receives `CAN_NEXT` when enough players are eliminated.
4.  **Host** calls `NEXT_ROUND` to move to the next stage.

### 5. Conclusion
1.  Steps repeat until only one player remains.
2.  **Everyone** receives `GAME_ENDED` with the winner's details and final points.

---

## 6. Data Models

### Player Object
```typescript
{
  id: string;
  socketId: string;
  name?: string;
  avatar?: string;
  isReady: boolean;
  isEliminated: boolean;
  isConnected: boolean;
  points: number;
}
```

### Session Object (Returned on Join/Reconnect)
```typescript
{
  id: string;
  gameType: string;
  hostId: string;
  players: Player[];
  status: "LOBBY" | "IN_PROGRESS" | "ENDED";
  currentRoundIndex: number;
  roundState: {
    currentQuestion?: string;
    submissions: any[];
    startTime: number;
}
```

---

## 7. ZegoCloud 1-on-1 Calling Flow

To support a "1-on-1 Date" round where the host talks to players individually, we provide a socket signaling layer. The actual video stream is handled by ZegoCloud. 

**Common Room ID Pattern**: `${gameId}_${hostId}_${userId}`

### 1. Host Calls Player
*   **Host Emits**: `type: "CALL_PLAYER", payload: { userId: "<PLAYER_ID>" }`
*   **Server Action**: Sends `INCOMING_CALL` event **ONLY** to the target player.
*   **Target Player Listens For**: `INCOMING_CALL` (payload: `{ hostId: "<HOST_ID>" }`) -> Shows "Host is calling..." UI.

### 2. Player Answers Call
*   **Player Emits**: `type: "ACCEPT_CALL", payload: {}`
*   **Player Local Action**: 
    1. Request ZegoCloud token from backend.
    2. Join ZegoCloud room using ID: `${gameId}_${hostId}_${userId}`.
*   **Server Action**: Sends `CALL_ACCEPTED` event **ONLY** to the Host.
*   **Host Listens For**: `CALL_ACCEPTED` (payload: `{ userId: "<PLAYER_ID>" }`).
*   **Host Local Action**:
    1. Request ZegoCloud token from backend.
    2. Join ZegoCloud room using ID: `${gameId}_${hostId}_${userId}`.

### 3. Player Declines Call
*   **Player Emits**: `type: "REJECT_CALL", payload: {}`
*   **Server Action**: Sends `CALL_REJECTED` event **ONLY** to the Host.
*   **Host Listens For**: `CALL_REJECTED` (payload: `{ userId: "<PLAYER_ID>" }`) -> Show "Call Declined" UI.

### 4. Host Ends Call
*   **Host Emits**: `type: "END_CALL", payload: { userId: "<PLAYER_ID>" }`
*   **Host Local Action**: Leave the ZegoCloud room.
*   **Server Action**: Sends `CALL_ENDED` event **ONLY** to the target player.
*   **Target Player Listens For**: `CALL_ENDED` (payload: `{ hostId: "<HOST_ID>" }`) -> Leave the ZegoCloud room locally.

