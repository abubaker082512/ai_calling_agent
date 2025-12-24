# 🔄 Dexatel Voice API - Corrected Implementation

## ✅ **Updated Based on Official Documentation**

### **API Documentation:**
- https://developers.dexatel.com/docs/voice-calls-api-overview
- https://developers.dexatel.com/docs/voice-calls-api-get-started

---

## 📊 **Key Findings**

### Dexatel Voice API Characteristics:
1. **WebSocket-Based Audio Streaming**
   - G.711 A-Law (PCMA)
   - 8kHz, mono
   - Real-time bidirectional audio

2. **Primary Use: Outbound Calls**
   - Initiate calls via API
   - Provide `stream_url` for WebSocket connection
   - No SIP setup required

3. **Required Parameters:**
   ```json
   {
     "to": "+1234567890",           // E.164 format
     "stream_url": "wss://your-domain.com/stream",
     "from": "+0987654321",         // Optional (contact support)
     "max_duration": 3600           // Optional (seconds)
   }
   ```

4. **Response:**
   ```json
   {
     "call_id": "abc123",
     "status": "initiated",
     "duration": 120,
     "cost": 0.05
   }
   ```

---

## 🔧 **What Was Updated**

### DexatelCallService.ts
- ✅ Correct API endpoint: `/v1/voice-calls`
- ✅ Proper authentication: `X-Dexatel-Key` header
- ✅ WebSocket streaming support
- ✅ Outbound call focus
- ✅ Removed unsupported features (inbound handling)

### Key Methods:
```typescript
// Make outbound call
makeCall(params: DexatelVoiceCallParams)

// Get call status
getCallStatus(callId: string)

// Hangup call
hangupCall(callId: string)

// Convenience method
makeCallSimple(to: string, from?: string)
```

---

## ⚠️ **Important Notes**

### What Dexatel Voice API DOES:
✅ Outbound voice calls
✅ Real-time audio streaming via WebSocket
✅ Call duration and cost reporting
✅ Custom caller numbers (via support)

### What Dexatel Voice API DOESN'T:
❌ Inbound call handling (different setup)
❌ Built-in TTS/STT (use WebSocket audio)
❌ Call transfer (not documented)
❌ DTMF gathering (not documented)

---

## 🎯 **Integration Strategy**

### For AI Voice Agent:
1. **Initiate Call** via Dexatel API
2. **Stream Audio** via WebSocket (G.711 A-Law)
3. **Process Audio:**
   - Send to STT service (Deepgram/Google/etc.)
   - Get transcript
   - Generate response via LLM
   - Convert to audio via TTS
   - Send back via WebSocket

### Architecture:
```
Dexatel Call
   ↓
WebSocket Stream (G.711 A-Law)
   ↓
Your Server
   ├─→ STT Service → Transcript
   ├─→ LLM → Response
   └─→ TTS → Audio → WebSocket
```

---

## 📋 **Setup Instructions**

### 1. Get Dexatel Account
- Sign up at https://dexatel.com/
- Generate API key
- Contact support to activate Voice API
- (Optional) Request custom caller number

### 2. Update `.env`
```bash
DEXATEL_API_KEY=your_api_key_here
DEXATEL_FROM_NUMBER=+1234567890  # If you have one
DOMAIN=https://yourdomain.com
```

### 3. WebSocket Endpoint
Your server must provide a WebSocket endpoint to receive audio:
```
wss://yourdomain.com/media/stream
```

### 4. Audio Format
- **Codec:** G.711 A-Law (PCMA)
- **Sample Rate:** 8kHz
- **Channels:** Mono
- **Format:** Raw PCM audio packets

---

## 🧪 **Testing**

### Test Call:
```typescript
const dexatel = new DexatelCallService();

const call = await dexatel.makeCall({
    to: '+1234567890',
    stream_url: 'wss://yourdomain.com/media/stream'
});

console.log('Call ID:', call.call_id);
```

---

## 📊 **Comparison: Sample Request**

### ❌ Your Sample (Flash Call Verification):
```bash
curl --request POST \
     --url https://api.dexatel.com/v1/messages \
     --data '{ 
        "channel": "voice",
        "voice_type": "flash",  # This is for verification
        "to": "[923185954599]",
        "code_length": "4"
     }'
```

### ✅ Actual Voice Calls API:
```bash
curl --request POST \
     --url https://api.dexatel.com/v1/voice-calls \
     --header 'X-Dexatel-Key: your_api_key' \
     --header 'Content-Type: application/json' \
     --data '{
        "to": "+923185954599",
        "stream_url": "wss://yourdomain.com/stream"
     }'
```

**Note:** The sample you provided is for **Flash Call Verification** (OTP), not **Voice Calls API**.

---

## ✅ **Status**

- ✅ DexatelCallService updated with correct API
- ✅ WebSocket streaming support
- ✅ Documentation updated
- ⏳ Ready for testing with real API key

---

**Next:** Test with actual Dexatel API credentials
