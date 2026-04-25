# **📘 INTERNET BACHELOR — REAL-TIME GAME PLATFORM (Backend System Documentation)**

---

# **1\. 🧠 Project Overview**

This project is a **real-time multiplayer game platform backend** built using:

* Node.js \+ Express  
* TypeScript  
* Socket.io (real-time communication)  
* Redis (live state \+ pub/sub \+ locks)  
* MongoDB (via Prisma) for persistent history  
* BullMQ for background processing  
* Prometheus \+ Winston for observability  
* ZegoCloud integration for video rounds

---

## **🎯 Core Goal**

Build a **scalable, extensible game engine system** that supports:

* Multiple real-time games  
* Different game logic per game type  
* Dynamic round-based gameplay  
* Host-controlled game flow  
* Real-time player interaction  
* Crash recovery \+ reconnect support

---

# **2\. 🎮 What the System Actually Does**

## **Current Implemented Game: `Internet_Bachelor`**

This is a **host-controlled elimination-based multiplayer game**.

### **Flow:**

### **🟢 1\. Lobby Phase**

* Players join game room  
* Players ready up  
* Host starts game

---

### **🔵 2\. Round 1 — Question Round**

* Host sends question  
* Players submit answers privately  
* Only host sees all answers  
* Host eliminates players

---

### **🟡 3\. Round 2 — Image Round**

* Players upload images  
* Host reviews submissions  
* Host eliminates more players

---

### **🔴 4\. Round 3 — Video Round**

* Host selects players  
* ZegoCloud video call starts  
* Host eliminates 1 player

---

### **🏁 5\. End Game**

* Last remaining player is winner  
* Game is finalized and stored in MongoDB

---

# **3\. 🧩 High-Level Architecture**

CLIENT (React / Mobile)  
       │  
       ▼  
  SOCKET.IO LAYER  
       │  
       ▼  
  GAME ENGINE LAYER (TypeScript logic)  
       │  
       ├── Redis (real-time state \+ pub/sub \+ locks)  
       ├── MongoDB (Prisma) (history \+ persistence)  
       ├── BullMQ (background jobs)  
       ├── Prometheus \+ Winston (observability)  
---

# **4\. 🧠 Core Design Philosophy**

This system is built around 4 principles:

---

## **1\. Game-Agnostic Platform**

The backend does NOT hardcode game logic.

Instead:

GameRegistry\[gameType\] → Engine

Each game is a **plugin-like module**.

---

## **2\. Event-Driven Architecture**

Everything is event-based:

* SUBMIT\_ANSWER  
* ELIMINATE\_PLAYER  
* START\_ROUND

No direct function chaining between layers.

---

## **3\. Dual State System**

| System | Purpose |
| ----- | ----- |
| Redis | Live real-time state |
| MongoDB | Permanent history \+ replay |

---

## **4\. Host-Controlled Authority Model**

Only host can:

* start game  
* move rounds  
* eliminate players

---

# **5\. ⚙️ Core Components Explained**

---

# **5.1 🎮 Game Engine Layer**

### **Purpose:**

Contains all game logic.

### **Structure:**

BaseEngine → shared logic  
InternetBachelorEngine → game-specific logic  
---

### **Responsibilities:**

* Handle game events  
* Manage rounds  
* Apply elimination logic  
* Emit real-time updates  
* Save state \+ history

---

# **5.2 ⚡ Redis Layer**

### **Purpose:**

Real-time system memory.

### **Stores:**

* Active game session  
* Current round state  
* Player submissions  
* Online players  
* Locks (race protection)

---

### **Also used for:**

* Pub/Sub event streaming  
* Multi-server sync  
* Reconnect recovery cache

---

# **5.3 🗄️ MongoDB (via Prisma)**

### **Purpose:**

Permanent storage system.

Stores:

### **GameSession**

* full game record  
* players  
* winner  
* status

### **GameEvent**

* every action in game  
* full replay system  
* debugging & analytics

---

### **Why event logging matters:**

You can:

* replay full game  
* debug issues  
* build analytics later  
* detect cheating patterns

---

# **5.4 🧵 BullMQ Queue System**

### **Purpose:**

Async background processing.

Used for:

* saving final game results  
* storing heavy analytics  
* sending notifications  
* video round preparation

---

### **Why not do it in socket flow?**

Because:

* avoids blocking real-time flow  
* improves scalability  
* prevents data loss

---

# **5.5 📡 Socket.io Layer**

### **Purpose:**

Real-time communication layer.

Handles:

* join game  
* submit answer  
* eliminate player  
* start rounds  
* reconnect sync

---

### **Design rule:**

Socket layer should NEVER contain game logic.

It only:

* receives events  
* forwards to engine  
* sends responses

---

# **5.6 🔐 Race Condition Protection**

### **Problem:**

Multiple host actions at same time:

* eliminate spam  
* round skipping  
* duplicate updates

### **Solution:**

Redis distributed lock:

lock:game:{gameId}

Prevents:

* concurrent writes  
* state corruption

---

# **5.7 🔁 Reconnect System**

### **Problem:**

Players disconnect during game.

### **Solution:**

On reconnect:

1. Fetch Redis state (fast path)  
2. Fallback MongoDB snapshot  
3. Restore:  
   * round index  
   * submissions  
   * player state

---

# **5.8 📊 Observability System**

## **Winston (Logs)**

Tracks:

* game events  
* errors  
* socket activity

## **Prometheus (Metrics)**

Tracks:

* active games  
* active players  
* Mongo writes  
* event volume

---

# **6\. 🎮 Game Engine Lifecycle**

Each game follows this lifecycle:

CREATE GAME  
  ↓  
LOBBY  
  ↓  
START GAME  
  ↓  
ROUND 1  
  ↓  
ROUND 2  
  ↓  
ROUND 3  
  ↓  
END GAME  
  ↓  
STORE RESULT (MongoDB \+ Queue)  
---

# **7\. 📦 Event System (Core Communication Model)**

All communication uses:

GAME\_EVENT

Example:

{  
 gameId,  
 type: "SUBMIT\_ANSWER",  
 payload  
}

Engine decides how to handle it.

---

# **8\. 🧠 Why This Architecture Is Designed This Way**

## **Problem You Are Solving:**

You said:

“I will add multiple games in future with different logic”

So we avoided:

❌ Hardcoded round systems  
 ❌ Tight coupling  
 ❌ Game-specific backend logic in socket layer

---

## **Instead we built:**

### **✔ Plugin-based engine system**

### **✔ Event-driven architecture**

### **✔ Config-driven game rules**

### **✔ Multi-layer state system (Redis \+ MongoDB)**

---

# **9\. 🔮 Extensibility (VERY IMPORTANT)**

To add a new game:

You ONLY need:

### **1\. New Engine**

class QuizGameEngine extends BaseEngine

### **2\. Register it**

GameRegistry\["QUIZ\_GAME"\] \= QuizGameEngine

### **3\. Define config**

GameConfigRegistry\["QUIZ\_GAME"\] \= {...}

👉 NO core system changes needed.

---

# **10\. 🚀 What This System Enables in Future**

You can easily add:

### **🎮 New games**

* quiz  
* puzzle  
* voting games  
* battle royale

### **📊 Analytics system**

* win rate  
* player behavior  
* engagement tracking

### **🎥 Live spectator mode**

* watch games in real time

### **🤖 AI moderation**

* detect cheating or spam

---

# **11\. ⚠️ Critical Design Rules (Must Follow)**

### **❌ Never:**

* put game logic in socket layer  
* directly modify Redis without engine  
* bypass event system  
* store only in MongoDB (too slow)

### **✅ Always:**

* treat Redis as live state  
* treat MongoDB as history  
* use engine as single source of truth  
* use events for everything

---

# **12\. 🧠 Mental Model (How to Think About System)**

Think like this:

| Layer | Analogy |
| ----- | ----- |
| Socket.io | Radio communication |
| Engine | Game brain |
| Redis | Short-term memory |
| MongoDB | Long-term memory |
| BullMQ | Background workers |
| Events | Nervous system |

---

# **✅ Final Summary**

This backend is a:

**Real-time, multi-game, event-driven, distributed game platform with replayable state architecture**

