# STEP 1: Architecture Refactoring

## Folder Structure

```
src/
├── core/                          # NEW: Core architecture components
│   ├── CallOrchestrator.ts       # Central call coordinator
│   ├── SessionManager.ts         # Call session management
│   └── MediaRouter.ts            # Media stream routing
│
├── services/                      # Existing services (to be refactored)
│   ├── telnyx.refactored.ts      # NEW: Refactored Telnyx (pure telephony)
│   ├── telnyx.ts                 # OLD: To be replaced
│   ├── conversationLoop.ts       # To be refactored (AI logic only)
│   ├── deepgram.ts               # To be abstracted in STEP 2
│   ├── conversationEngine.ts     # AI logic (stays)
│   └── ...
│
├── routes/                        # API routes
├── webhooks/                      # Webhook handlers
└── index.ts                       # Main entry point (to be updated)
```

## Key Changes

### 1. CallOrchestrator (NEW)
**Purpose:** Central coordinator for all call operations
**Responsibilities:**
- Initialize call sessions
- Handle inbound/outbound calls
- Coordinate between Telnyx, SessionManager, and MediaRouter
- Emit lifecycle events

**Key Methods:**
- `initializeCall(config)` - Create new call session
- `handleInboundCall(callControlId, from, to)` - Process incoming calls
- `handleOutboundCall(to, from, agentId)` - Make outbound calls
- `startMediaStreaming(callId)` - Begin audio streaming
- `startConversation(callId)` - Initiate AI conversation
- `endCall(callId, reason)` - Terminate call

### 2. SessionManager (NEW)
**Purpose:** Manage call session state
**Responsibilities:**
- Store session data (in-memory for now, Redis in STEP 3)
- CRUD operations on sessions
- Query active/ended sessions

**Key Methods:**
- `createSession(session)` - Create new session
- `getSession(callId)` - Get session by ID
- `getSessionByControlId(callControlId)` - Get by Telnyx ID
- `updateSession(callId, updates)` - Update session
- `getActiveSessions()` - Get all active calls

### 3. MediaRouter (NEW)
**Purpose:** Route media streams between Telnyx and AI services
**Responsibilities:**
- Register media routes
- Attach WebSocket streams
- Forward audio data
- Handle stream lifecycle

**Key Methods:**
- `registerRoute(callId, callControlId)` - Create media route
- `attachTelnyxStream(callId, stream)` - Connect Telnyx WS
- `attachASRStream(callId, stream)` - Connect ASR WS
- `sendToTelnyx(callId, audioData)` - Send TTS audio
- `unregisterRoute(callId)` - Cleanup route

### 4. TelnyxService (REFACTORED)
**Purpose:** Pure telephony operations (NO AI logic)
**Changes:**
- Removed AI/conversation logic
- Simplified to call control only
- Emits events instead of handling them
- Added transfer, hold, recording methods

**Key Methods:**
- `answerCall(callControlId)`
- `makeCall(to, from, clientState)`
- `hangupCall(callControlId)`
- `speak(callControlId, text, options)`
- `transferCall(callControlId, to)`
- `startRecording(callControlId)`
- `startMediaStream(callControlId)`

## Separation of Concerns

### Before (Monolithic)
```
index.ts
  ├── TelnyxService (telephony + AI logic mixed)
  ├── ConversationLoop (tightly coupled)
  └── Direct WebSocket handling
```

### After (Layered)
```
index.ts
  └── CallOrchestrator
        ├── TelnyxService (telephony only)
        ├── SessionManager (state management)
        ├── MediaRouter (stream routing)
        └── ConversationLoop (AI logic only)
```

## Event Flow

### Inbound Call
```
1. Telnyx Webhook → TelnyxService.handleWebhook()
2. TelnyxService emits 'call.initiated'
3. CallOrchestrator.handleInboundCall()
4. SessionManager.createSession()
5. TelnyxService.answerCall()
6. TelnyxService emits 'call.answered'
7. CallOrchestrator.startMediaStreaming()
8. MediaRouter.registerRoute()
9. CallOrchestrator.startConversation()
10. ConversationLoop starts (AI logic)
```

### Outbound Call
```
1. API Request → CallOrchestrator.handleOutboundCall()
2. TelnyxService.makeCall()
3. SessionManager.createSession()
4. Telnyx dials number
5. Call answered → same flow as inbound from step 6
```

## Next Steps

### Remaining Work for STEP 1:
1. ✅ Create CallOrchestrator
2. ✅ Create SessionManager
3. ✅ Create MediaRouter
4. ✅ Refactor TelnyxService
5. ⏳ Update index.ts to use CallOrchestrator
6. ⏳ Refactor ConversationLoop to work with new architecture
7. ⏳ Update webhook handlers
8. ⏳ Test end-to-end call flow

### STEP 2 Preview (Provider Abstractions):
- ASRProvider interface
- LLMProvider interface
- StorageProvider interface
- Implement adapters for Deepgram, Gemini, Supabase

### STEP 3 Preview (Redis Integration):
- Replace SessionManager in-memory storage with Redis
- Add campaign queue management
- Add retry logic with Redis
- Add transcript buffering

## Status

**STEP 1 Progress:** 50% Complete
- ✅ Core components created
- ✅ Architecture defined
- ⏳ Integration pending
- ⏳ Testing pending

**Ready for:** Integration and testing
