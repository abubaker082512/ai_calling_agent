# Telnyx Integration - API & Event Contract Specification

## 📋 **Overview**

This document defines the complete API contract and event handling specification for Telnyx Programmable Voice integration with Callify AI Call Center Platform.

---

## 🏗️ **High-Level Architecture**

### **Actors**

1. **Telnyx Voice API** - Telephony provider
2. **AI Call Orchestrator** - Backend (our system)
3. **ASR Engine** - Streaming speech recognition (Deepgram)
4. **NLU / Dialogue Manager** - Intent classification (Gemini AI)
5. **LLM + Knowledge Base** - Response generation
6. **Agent Console** - Web interface for human agents

### **Call Flow**

```
Inbound Call:
Telnyx → Webhook (call.initiated) → Answer Call → Start Streaming → ASR → NLU → LLM → TTS Response

Outbound Call:
Campaign Manager → Create Call → Telnyx Dials → Call Answered → Start Streaming → AI Conversation
```

---

## 🔌 **Telnyx API Endpoints**

### **1. Create Outbound Call**

**Endpoint:** `POST https://api.telnyx.com/v2/calls`

**Headers:**
```http
Authorization: Bearer TELNYX_API_KEY
Content-Type: application/json
```

**Request Body:**
```json
{
  "to": "+14155550123",
  "from": "+14155559876",
  "connection_id": "123456789",
  "webhook_url": "https://api.callify.com/telnyx/events",
  "webhook_event_url": "https://api.callify.com/telnyx/events",
  "webhook_event_failover_url": "https://api-backup.callify.com/telnyx/events"
}
```

**Response:**
```json
{
  "data": {
    "call_control_id": "v2:abc123def456",
    "call_leg_id": "leg_abc123",
    "call_session_id": "session_xyz789",
    "is_alive": true
  }
}
```

---

### **2. Answer Inbound Call**

**Endpoint:** `POST https://api.telnyx.com/v2/calls/{call_control_id}/actions/answer`

**Request Body:**
```json
{
  "client_state": "aGF2ZSBhIG5pY2UgZGF5ID1d",
  "command_id": "command_uuid"
}
```

**Response:**
```json
{
  "data": {
    "result": "ok"
  }
}
```

---

### **3. Start Audio Streaming (Real-Time ASR)**

**Endpoint:** `POST https://api.telnyx.com/v2/calls/{call_control_id}/actions/streaming_start`

**Request Body:**
```json
{
  "stream_url": "wss://asr.callify.com/stream",
  "stream_track": "inbound_track",
  "enable_dialogflow": false
}
```

**Response:**
```json
{
  "data": {
    "result": "ok"
  }
}
```

---

### **4. Text-to-Speech (AI Response)**

**Endpoint:** `POST https://api.telnyx.com/v2/calls/{call_control_id}/actions/speak`

**Request Body:**
```json
{
  "payload": "Hello, how can I help you today?",
  "voice": "female",
  "language": "en-US",
  "payload_type": "text"
}
```

**Response:**
```json
{
  "data": {
    "result": "ok"
  }
}
```

---

### **5. Start Call Recording**

**Endpoint:** `POST https://api.telnyx.com/v2/calls/{call_control_id}/actions/record_start`

**Request Body:**
```json
{
  "format": "mp3",
  "channels": "dual",
  "play_beep": true
}
```

---

### **6. Transfer Call (Human Escalation)**

**Endpoint:** `POST https://api.telnyx.com/v2/calls/{call_control_id}/actions/transfer`

**Request Body:**
```json
{
  "to": "+14155550999",
  "from": "+14155559876",
  "timeout_secs": 30
}
```

---

### **7. Hangup Call**

**Endpoint:** `POST https://api.telnyx.com/v2/calls/{call_control_id}/actions/hangup`

**Request Body:**
```json
{
  "client_state": "aGF2ZSBhIG5pY2UgZGF5ID1d",
  "command_id": "command_uuid"
}
```

---

## 📨 **Telnyx Webhook Events (Inbound)**

Your backend must handle these webhook events at: `https://api.callify.com/telnyx/events`

### **Event 1: Call Initiated**

```json
{
  "data": {
    "event_type": "call.initiated",
    "id": "event_uuid",
    "occurred_at": "2024-12-14T08:00:00.000Z",
    "payload": {
      "call_control_id": "v2:abc123def456",
      "call_leg_id": "leg_abc123",
      "call_session_id": "session_xyz789",
      "client_state": "aGF2ZSBhIG5pY2UgZGF5ID1d",
      "connection_id": "123456789",
      "direction": "incoming",
      "from": "+14155550123",
      "to": "+14155559876",
      "state": "parked"
    },
    "record_type": "event"
  },
  "meta": {
    "attempt": 1,
    "delivered_to": "https://api.callify.com/telnyx/events"
  }
}
```

**Action:** Answer the call and start streaming

---

### **Event 2: Call Answered**

```json
{
  "data": {
    "event_type": "call.answered",
    "payload": {
      "call_control_id": "v2:abc123def456",
      "state": "answered"
    }
  }
}
```

**Action:** Begin AI conversation flow

---

### **Event 3: Call Hangup**

```json
{
  "data": {
    "event_type": "call.hangup",
    "payload": {
      "call_control_id": "v2:abc123def456",
      "call_leg_id": "leg_abc123",
      "call_session_id": "session_xyz789",
      "hangup_cause": "normal_clearing",
      "hangup_source": "caller",
      "sip_hangup_cause": "200"
    }
  }
}
```

**Action:** Trigger post-call processing (summarization, CRM update)

---

### **Event 4: Speaking Started**

```json
{
  "data": {
    "event_type": "call.speak.started",
    "payload": {
      "call_control_id": "v2:abc123def456"
    }
  }
}
```

---

### **Event 5: Speaking Ended**

```json
{
  "data": {
    "event_type": "call.speak.ended",
    "payload": {
      "call_control_id": "v2:abc123def456"
    }
  }
}
```

**Action:** Resume listening for user input

---

### **Event 6: Recording Saved**

```json
{
  "data": {
    "event_type": "call.recording.saved",
    "payload": {
      "call_control_id": "v2:abc123def456",
      "recording_urls": {
        "mp3": "https://storage.telnyx.com/recordings/abc123.mp3"
      },
      "public_recording_urls": {
        "mp3": "https://public.telnyx.com/recordings/abc123.mp3"
      }
    }
  }
}
```

**Action:** Download and store recording

---

## 🔄 **Internal AI Event Contract**

Standardized event schema for internal communication between components.

### **User Utterance Event**

```json
{
  "event_id": "uuid",
  "session_id": "session_xyz789",
  "call_id": "v2:abc123def456",
  "event_type": "USER_UTTERANCE",
  "timestamp": "2024-12-14T08:00:00.000Z",
  "data": {
    "transcript": "I want to check my order status",
    "confidence": 0.91,
    "language": "en-US",
    "sentiment": "neutral",
    "emotion": "calm",
    "is_final": true
  }
}
```

---

### **AI Response Event**

```json
{
  "event_id": "uuid",
  "session_id": "session_xyz789",
  "call_id": "v2:abc123def456",
  "event_type": "AI_RESPONSE",
  "timestamp": "2024-12-14T08:00:01.000Z",
  "data": {
    "text": "Sure, can you share your order number?",
    "intent": "order_status_inquiry",
    "confidence": 0.95,
    "tts": true,
    "voice": "female",
    "escalate": false,
    "next_action": "collect_order_number"
  }
}
```

---

### **Intent Detected Event**

```json
{
  "event_id": "uuid",
  "session_id": "session_xyz789",
  "event_type": "INTENT_DETECTED",
  "data": {
    "intent": "order_status_inquiry",
    "confidence": 0.95,
    "entities": [
      {
        "type": "order_number",
        "value": "ORD-12345",
        "confidence": 0.88
      }
    ],
    "context": {
      "previous_intent": "greeting",
      "turn_count": 3
    }
  }
}
```

---

### **Escalation Event**

```json
{
  "event_id": "uuid",
  "session_id": "session_xyz789",
  "event_type": "ESCALATION_REQUIRED",
  "data": {
    "reason": "low_confidence",
    "confidence": 0.45,
    "failed_attempts": 2,
    "sentiment": "frustrated",
    "priority": "high"
  }
}
```

---

## 🛡️ **Failure & Fallback Rules**

### **Rule 1: Low ASR Confidence**
```
IF confidence < 0.6 THEN
  - Repeat prompt: "I didn't catch that. Could you please repeat?"
  - Increment retry_count
```

### **Rule 2: Multiple Failures**
```
IF retry_count >= 2 THEN
  - Escalate to human agent
  - Transfer call
  - Log escalation reason
```

### **Rule 3: LLM Timeout**
```
IF llm_response_time > 3000ms THEN
  - Use scripted fallback response
  - Log timeout event
  - Continue conversation
```

### **Rule 4: Sentiment-Based Escalation**
```
IF sentiment == "angry" OR sentiment == "frustrated" THEN
  - Offer human escalation
  - "Would you like to speak with a representative?"
```

### **Rule 5: Silence Detection**
```
IF silence_duration > 5000ms THEN
  - Prompt: "Are you still there?"
  - IF silence_duration > 10000ms THEN hangup
```

---

## 🔐 **Security & Validation**

### **Webhook Signature Verification**

```javascript
const crypto = require('crypto');

function verifyTelnyxSignature(payload, signature, timestamp, secret) {
  const signedPayload = `${timestamp}|${payload}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

### **Request Headers to Validate**

```
X-Telnyx-Signature-Sha256: <signature>
X-Telnyx-Timestamp: <timestamp>
```

---

## 📊 **Error Handling**

### **HTTP Status Codes**

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Continue |
| 401 | Unauthorized | Check API key |
| 404 | Not Found | Verify call_control_id |
| 422 | Invalid Request | Check request body |
| 500 | Server Error | Retry with backoff |

### **Retry Strategy**

```javascript
const retryConfig = {
  maxRetries: 3,
  backoff: 'exponential',
  initialDelay: 1000,
  maxDelay: 10000
};
```

---

## 🧪 **Testing**

### **Sample Test Call Flow**

```bash
# 1. Create test call
curl -X POST https://api.telnyx.com/v2/calls \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+14155550123",
    "from": "+14155559876",
    "connection_id": "123456789",
    "webhook_url": "https://webhook.site/your-test-url"
  }'

# 2. Answer call
curl -X POST https://api.telnyx.com/v2/calls/{call_control_id}/actions/answer

# 3. Speak
curl -X POST https://api.telnyx.com/v2/calls/{call_control_id}/actions/speak \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "payload": "This is a test message",
    "voice": "female"
  }'

# 4. Hangup
curl -X POST https://api.telnyx.com/v2/calls/{call_control_id}/actions/hangup
```

---

## 📚 **References**

- [Telnyx Call Control API](https://developers.telnyx.com/docs/api/v2/call-control)
- [Telnyx Webhooks](https://developers.telnyx.com/docs/v2/development/webhooks)
- [Telnyx TTS](https://developers.telnyx.com/docs/voice/programmable-voice/tts)
- [Telnyx Streaming](https://developers.telnyx.com/docs/v2/call-control/streaming)

---

**Status:** ✅ Implementation-ready specification
**Last Updated:** December 14, 2024
**Version:** 1.0
