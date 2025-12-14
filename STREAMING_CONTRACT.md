# Streaming Ownership Contract

## 📋 **Overview**

This document defines the ownership and behavior of media streaming in the Callify platform.

---

## 🎯 **Ownership: CallOrchestrator**

The `CallOrchestrator` is the **sole owner** of streaming lifecycle decisions.

### Responsibilities:
- ✅ Decide when to start streaming
- ✅ Decide when to stop streaming
- ✅ Handle streaming failures
- ✅ Manage streaming state transitions

---

## 🔄 **Streaming Lifecycle**

### 1. When Streaming Starts

**Trigger:** Call is answered

**Flow:**
```
1. Webhook: call.answered
2. CallOrchestrator.handleCallAnswered()
3. Update session state: INIT → ANSWERED
4. CallOrchestrator.startStreaming()
5. Telnyx starts media stream
6. Update session state: ANSWERED → AI_ACTIVE
7. Emit: streaming:started
```

**Conditions:**
- ✅ Call must be in `ANSWERED` state
- ✅ Session must exist
- ✅ Stream URL must be valid

**Code:**
```typescript
await this.telnyxService.startStreaming(callControlId, streamUrl);
await this.sessionManager.updateState(callControlId, CallSessionState.AI_ACTIVE);
```

---

### 2. When Streaming Stops

**Triggers:**
- Call hangup
- Human escalation
- ASR failure (after max retries)
- Manual stop

**Flow:**
```
1. Trigger event (hangup/escalation/failure)
2. CallOrchestrator.stopStreaming()
3. Telnyx stops media stream
4. Update session state accordingly
5. Emit: streaming:stopped
```

**Code:**
```typescript
await this.telnyxService.stopStreaming(callControlId);
this.emit('streaming:stopped', { call_control_id: callControlId });
```

---

### 3. Behavior on Hangup

**Scenario:** User or system hangs up the call

**Flow:**
```
1. Webhook: call.hangup
2. CallOrchestrator.handleCallHangup()
3. Check session state
4. IF state === AI_ACTIVE:
   - Stop streaming
5. End session (state → ENDED)
6. Emit: call:ended
```

**Guarantees:**
- ✅ Streaming is always stopped before session ends
- ✅ No orphaned streams
- ✅ Clean resource cleanup

**Code:**
```typescript
if (session.state === CallSessionState.AI_ACTIVE) {
    await this.stopStreaming(callControlId);
}
await this.sessionManager.endSession(callControlId);
```

---

### 4. Behavior on ASR Failure

**Scenario:** ASR confidence too low or ASR service fails

**Flow:**
```
1. ASR failure detected
2. CallOrchestrator.handleASRFailure()
3. Increment confidence_failures counter
4. IF confidence_failures < 3:
   - Increment retry_count
   - Emit: asr:retry
   - Continue streaming
5. ELSE:
   - Escalate to human
   - Stop streaming
   - Update state: AI_ACTIVE → HUMAN_ESCALATED
```

**Retry Logic:**
```typescript
if (session.confidence_failures >= 3) {
    await this.escalateToHuman(callControlId);
} else {
    await this.sessionManager.incrementRetry(callControlId);
    this.emit('asr:retry', { session });
}
```

**Guarantees:**
- ✅ Max 3 confidence failures before escalation
- ✅ Streaming continues during retries
- ✅ Streaming stops on escalation

---

## 📊 **State Transitions**

### Valid Transitions

```
INIT → ANSWERED → AI_ACTIVE → ENDED
       ↓           ↓
       ENDED       HUMAN_ESCALATED → ENDED
```

### Streaming Active States

Streaming is **ACTIVE** when:
- ✅ State === `AI_ACTIVE`

Streaming is **INACTIVE** when:
- ❌ State === `INIT`
- ❌ State === `ANSWERED` (not started yet)
- ❌ State === `HUMAN_ESCALATED`
- ❌ State === `ENDED`

---

## 🔐 **Invariants**

### Must Always Be True:

1. **Single Stream Per Call**
   - Only one active stream per call_control_id
   - No duplicate streams

2. **State Consistency**
   - If streaming is active, state MUST be `AI_ACTIVE`
   - If state is `AI_ACTIVE`, streaming MUST be active

3. **Clean Shutdown**
   - Streaming MUST stop before session ends
   - No orphaned streams

4. **Failure Handling**
   - ASR failures MUST increment counter
   - Max failures MUST trigger escalation

---

## 🚨 **Error Handling**

### Streaming Start Failure

```typescript
try {
    await this.telnyxService.startStreaming(callControlId, streamUrl);
} catch (error) {
    console.error('Streaming start failed:', error);
    this.emit('streaming:error', { call_control_id: callControlId, error });
    // Fallback: Hangup call
    await this.telnyxService.hangupCall(callControlId);
}
```

### Streaming Stop Failure

```typescript
try {
    await this.telnyxService.stopStreaming(callControlId);
} catch (error) {
    console.error('Streaming stop failed:', error);
    // Continue with session cleanup anyway
}
```

---

## 📝 **Events Emitted**

### Streaming Events

```typescript
// Streaming started successfully
this.emit('streaming:started', { session, streamUrl });

// Streaming stopped
this.emit('streaming:stopped', { call_control_id });

// Streaming error
this.emit('streaming:error', { call_control_id, error });
```

### ASR Events

```typescript
// ASR retry
this.emit('asr:retry', { session });

// ASR failure (max retries)
this.emit('asr:failure', { session });
```

---

## 🎯 **Future Extensions**

### Phase 2: AI Integration

When AI is integrated:
- CallOrchestrator will route streaming to AI pipeline
- AI pipeline will handle ASR → NLU → LLM
- CallOrchestrator maintains ownership of start/stop

### Phase 3: Advanced Features

- Dynamic stream URL routing
- Multi-stream support (recording + AI)
- Stream quality monitoring
- Automatic failover

---

## ✅ **Compliance Checklist**

Before deploying:

- [ ] All streaming starts go through CallOrchestrator
- [ ] All streaming stops go through CallOrchestrator
- [ ] Hangup always stops streaming
- [ ] ASR failures increment counter
- [ ] Max failures trigger escalation
- [ ] No orphaned streams
- [ ] State transitions are valid
- [ ] Events are emitted correctly

---

**Owner:** CallOrchestrator
**Version:** 1.0
**Last Updated:** December 14, 2024
