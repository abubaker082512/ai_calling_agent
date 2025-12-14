# UI Wireframes - Callify AI Call Center Platform

## 📐 **Design Principles**

- **Dark/Light Mode:** Full theme support
- **Keyboard-First:** All actions accessible via keyboard
- **Sub-Second Updates:** Real-time UI with <1s latency
- **Role-Based Visibility:** Different views for agents, supervisors, admins
- **Responsive:** Mobile, tablet, desktop support

---

## 1️⃣ **Agent Console (Live Call Screen)**

### **Layout Structure**

```
┌─────────────────────────────────────────────────────────────────┐
│ HEADER: Caller Info | CRM Snapshot | Sentiment Meter            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ LEFT PANEL (70%)          │  RIGHT PANEL (30%)                   │
│ ─────────────────────────│──────────────────────────────────    │
│                           │                                       │
│ LIVE TRANSCRIPT           │  AI SUGGESTIONS                       │
│ (Streaming, highlighted)  │  ─────────────────                   │
│                           │  💡 Suggested Reply:                 │
│ User: "I need help with   │  "I'd be happy to help you           │
│       my order"           │   with that. Can you provide         │
│                           │   your order number?"                │
│ Agent: "Sure, can you     │                                       │
│        provide your       │  📚 Knowledge Snippet:               │
│        order number?"     │  "Order lookup requires:             │
│                           │   - Order # or Email                 │
│ User: "ORD-12345"         │   - Last 4 digits of phone"          │
│                           │                                       │
│                           │  ⚠️ Compliance Alert:                │
│                           │  "Verify customer identity           │
│                           │   before sharing details"            │
│                           │                                       │
├─────────────────────────────────────────────────────────────────┤
│ CONTROLS: [🔇 Mute] [⏸️ Hold] [📞 Transfer] [❌ Hangup]         │
└─────────────────────────────────────────────────────────────────┘
```

### **Header Components**

**Caller Info Card:**
```
┌──────────────────────┐
│ 📞 +1 (415) 555-0123│
│ John Doe             │
│ 🕐 00:02:34         │
└──────────────────────┘
```

**CRM Snapshot:**
```
┌──────────────────────┐
│ 👤 Premium Customer  │
│ 📦 3 Active Orders   │
│ ⭐ 4.8 Rating       │
│ 💰 $2,450 LTV       │
└──────────────────────┘
```

**Sentiment Meter:**
```
┌──────────────────────┐
│ 😊 Sentiment: Neutral│
│ ████████░░ 80%       │
│ Confidence: High     │
└──────────────────────┘
```

### **Live Transcript Features**

- **Word-by-word streaming** (like Google Meet captions)
- **Speaker labels** (User vs Agent)
- **Confidence highlighting** (low confidence = yellow highlight)
- **Timestamps** on hover
- **Auto-scroll** with manual override
- **Search** within transcript

### **AI Suggestions Panel**

1. **Suggested Replies** (3-5 options)
   - One-click to insert
   - Keyboard shortcut (Ctrl+1, Ctrl+2, etc.)

2. **Knowledge Snippets**
   - Relevant KB articles
   - FAQs
   - Product info

3. **Compliance Prompts**
   - PCI warnings
   - GDPR reminders
   - Script adherence

### **Call Controls**

```
[🔇 Mute (M)]  [⏸️ Hold (H)]  [📞 Transfer (T)]  [❌ Hangup (X)]
```

### **Post-Call Summary (Auto-popup)**

```
┌─────────────────────────────────────────┐
│ ✅ Call Summary                         │
├─────────────────────────────────────────┤
│ Duration: 2m 34s                        │
│ Outcome: Order Status Inquiry           │
│ Resolution: Resolved                    │
│                                         │
│ 📝 AI-Generated Notes:                 │
│ Customer inquired about order ORD-12345.│
│ Provided tracking info. Customer        │
│ satisfied with response.                │
│                                         │
│ 🎯 Action Items:                       │
│ • Follow up in 2 days                  │
│ • Update CRM with tracking info        │
│                                         │
│ [Save to CRM] [Edit] [Discard]         │
└─────────────────────────────────────────┘
```

---

## 2️⃣ **AI Agent Builder (No-Code)**

### **Layout Structure**

```
┌─────────────────────────────────────────────────────────────────┐
│ TOOLBAR: [Save] [Test] [Deploy] [Version History]               │
├──────────────┬──────────────────────────┬───────────────────────┤
│              │                          │                       │
│ LEFT PANEL   │  CENTER CANVAS           │  RIGHT PANEL          │
│ (20%)        │  (50%)                   │  (30%)                │
│              │                          │                       │
│ 📋 Intents   │  ┌─────────────┐        │  ⚙️ Node Settings    │
│ • Greeting   │  │   START     │        │  ─────────────────    │
│ • Order      │  └──────┬──────┘        │                       │
│ • Support    │         │               │  Intent: Greeting     │
│ • Billing    │         ▼               │                       │
│              │  ┌─────────────┐        │  Utterances:          │
│ 🏷️ Entities  │  │  Greeting   │        │  • "Hello"           │
│ • Order#     │  └──────┬──────┘        │  • "Hi there"        │
│ • Email      │         │               │  • "Good morning"    │
│ • Phone      │         ▼               │                       │
│              │  ┌─────────────┐        │  Response:            │
│ ⚠️ Fallback  │  │ Collect     │        │  "Hello! How can I   │
│ • Low Conf   │  │ Order #     │        │   help you today?"   │
│ • Timeout    │  └──────┬──────┘        │                       │
│ • Error      │         │               │  Voice: Female       │
│              │         ▼               │  Speed: 1.0x         │
│ 🚨 Escalate  │  ┌─────────────┐        │  Pitch: 0            │
│ • Angry      │  │  Lookup     │        │                       │
│ • Complex    │  │  Order      │        │  Confidence: 0.7     │
│ • Request    │  └──────┬──────┘        │                       │
│              │         │               │  [Save Node]         │
│              │         ▼               │                       │
│              │  ┌─────────────┐        │                       │
│              │  │  Provide    │        │                       │
│              │  │  Info       │        │                       │
│              │  └──────┬──────┘        │                       │
│              │         │               │                       │
│              │         ▼               │                       │
│              │  ┌─────────────┐        │                       │
│              │  │    END      │        │                       │
│              │  └─────────────┘        │                       │
└──────────────┴──────────────────────────┴───────────────────────┘
```

### **Node Types**

1. **Start Node** (green)
2. **Intent Node** (blue)
3. **Action Node** (purple)
4. **Condition Node** (yellow)
5. **End Node** (red)
6. **Escalation Node** (orange)

### **Flow Connections**

- **Drag-and-drop** to connect nodes
- **Conditional branches** (if/else)
- **Loop back** for retries
- **Parallel paths** for multi-intent

### **Test Panel**

```
┌─────────────────────────────────┐
│ 🧪 Test Your Agent              │
├─────────────────────────────────┤
│ User: "Hi, I need help"         │
│ Bot: "Hello! How can I help?"   │
│                                 │
│ User: "Check order ORD-12345"   │
│ Bot: "Let me look that up..."   │
│                                 │
│ [Type message...]               │
│ [Send] [Reset] [Export Log]     │
└─────────────────────────────────┘
```

---

## 3️⃣ **Campaign Manager UI**

### **Layout**

```
┌─────────────────────────────────────────────────────────────────┐
│ CAMPAIGNS                                    [+ New Campaign]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 📞 Holiday Sale Outreach                    [▶️ Start]       │ │
│ │ ───────────────────────────────────────────────────────────  │ │
│ │ Status: Paused | Progress: 450/1000 (45%)                    │ │
│ │                                                               │ │
│ │ 📊 Metrics:                                                  │ │
│ │ • Calls Attempted: 450                                       │ │
│ │ • Answer Rate: 68% (306/450)                                 │ │
│ │ • Success Rate: 42% (189/450)                                │ │
│ │ • Avg Duration: 2m 15s                                       │ │
│ │ • Cost: $45.00 ($0.10/call)                                  │ │
│ │                                                               │ │
│ │ [Edit] [Pause] [Stop] [Export Results]                       │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 📞 Payment Reminder                         [▶️ Start]       │ │
│ │ ───────────────────────────────────────────────────────────  │ │
│ │ Status: Scheduled | Starts: Dec 15, 9:00 AM                  │ │
│ │ Contacts: 250 | Agent: Payment Bot                           │ │
│ │ [Edit] [Delete]                                              │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### **Create Campaign Form**

```
┌─────────────────────────────────────────┐
│ Create New Campaign                     │
├─────────────────────────────────────────┤
│ Campaign Name:                          │
│ [Holiday Sale Outreach____________]     │
│                                         │
│ Select Agent:                           │
│ [Sales Bot ▼]                          │
│                                         │
│ Upload Contact List (CSV):              │
│ [📎 Choose File] contacts.csv          │
│ Format: name,phone,email                │
│                                         │
│ Schedule:                               │
│ ○ Start Immediately                     │
│ ● Schedule for later                    │
│   Date: [Dec 15, 2024]                 │
│   Time: [09:00 AM]                     │
│                                         │
│ Retry Policy:                           │
│ Max Attempts: [3]                       │
│ Retry Delay: [2 hours]                 │
│                                         │
│ Throttling:                             │
│ Max Concurrent: [10]                    │
│ Calls/minute: [30]                     │
│                                         │
│ [Create Campaign] [Cancel]              │
└─────────────────────────────────────────┘
```

---

## 4️⃣ **Supervisor Dashboard**

### **Layout**

```
┌─────────────────────────────────────────────────────────────────┐
│ SUPERVISOR DASHBOARD                          🔴 LIVE            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ ┌──────────────┬──────────────┬──────────────┬──────────────┐   │
│ │ Active Calls │ AI Success   │ Avg Handle   │ Escalations  │   │
│ │     12       │    87%       │   3m 24s     │      3       │   │
│ └──────────────┴──────────────┴──────────────┴──────────────┘   │
│                                                                   │
│ LIVE CALLS                                                        │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Agent: Sarah J. | +1415555 0123 | 00:02:15 | 😊 Positive   │ │
│ │ [👁️ Monitor] [🎧 Whisper] [📞 Transfer]                     │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ Agent: AI Bot 1 | +1415555 0456 | 00:01:45 | 😐 Neutral    │ │
│ │ [👁️ Monitor] [⏸️ Pause] [❌ Stop]                           │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ Agent: Mike T.  | +1415555 0789 | 00:05:12 | 😡 Frustrated │ │
│ │ [👁️ Monitor] [🎧 Whisper] [🚨 Escalate]                     │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ AGENT AVAILABILITY                                                │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🟢 Available: 5 | 🔴 Busy: 3 | ⏸️ Break: 2 | 🌙 Offline: 1 │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ESCALATION HEATMAP (Last Hour)                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 9:00 ████░░░░ 4 escalations                                  │ │
│ │ 9:15 ██░░░░░░ 2 escalations                                  │ │
│ │ 9:30 ██████░░ 6 escalations ⚠️                              │ │
│ │ 9:45 ███░░░░░ 3 escalations                                  │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### **Monitor Call Modal**

```
┌─────────────────────────────────────────┐
│ 👁️ Monitoring: Sarah J.                │
├─────────────────────────────────────────┤
│ Live Transcript:                        │
│ ─────────────────                       │
│ User: "I'm having issues with..."       │
│ Agent: "I understand. Let me help..."   │
│                                         │
│ Actions:                                │
│ [🎧 Whisper to Agent]                   │
│ [📞 Join Call]                          │
│ [🚨 Force Transfer]                     │
│ [❌ End Call]                           │
│                                         │
│ [Close]                                 │
└─────────────────────────────────────────┘
```

---

## 5️⃣ **Call Review & QA Screen**

### **Layout**

```
┌─────────────────────────────────────────────────────────────────┐
│ CALL REVIEW: ORD-12345 Inquiry                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🎵 Audio Playback                                            │ │
│ │ ▶️ ━━━━━━━●━━━━━━━━━━━━ 2:34 / 5:12                        │ │
│ │ [⏮️ -10s] [⏸️ Pause] [⏭️ +10s] [🔊 Volume] [⚡ 1.5x]       │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ TRANSCRIPT (Synced with Audio)                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 00:00 Agent: "Hello, thank you for calling..."              │ │
│ │ 00:15 User: "Hi, I need help with my order"                 │ │
│ │ 00:23 Agent: "I'd be happy to help. Order number?"          │ │
│ │ 00:30 User: "ORD-12345"                                     │ │
│ │ 00:35 Agent: "Let me look that up..." [⚠️ 8s delay]        │ │
│ │ 00:43 Agent: "Your order shipped yesterday..."              │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ AI-GENERATED SUMMARY                                             │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Customer inquired about order ORD-12345. Agent provided      │ │
│ │ tracking information. Customer satisfied. Resolution time:   │ │
│ │ 2m 15s. No escalation required.                              │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ QA SCORE: 85/100 ⭐⭐⭐⭐☆                                        │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ✅ Greeting: Excellent (10/10)                              │ │
│ │ ✅ Empathy: Good (8/10)                                     │ │
│ │ ⚠️ Response Time: Fair (7/10) - 8s delay noted             │ │
│ │ ✅ Resolution: Excellent (10/10)                            │ │
│ │ ✅ Closing: Good (8/10)                                     │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ COACHING NOTES                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ [Add note...]                                                │ │
│ │                                                              │ │
│ │ [Save] [Schedule Coaching Session]                           │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎨 **Component Library**

### **Buttons**

```
Primary:   [Save Changes]
Secondary: [Cancel]
Danger:    [Delete]
Icon:      [🔇] [⏸️] [📞]
```

### **Form Fields**

```
Text:      [____________]
Select:    [Option ▼]
Checkbox:  ☑️ Enable feature
Radio:     ○ Option 1  ● Option 2
Toggle:    [ON ●━━━━━]
```

### **Status Badges**

```
🟢 Active   🔴 Busy   ⏸️ Paused   ❌ Failed   ✅ Success
```

### **Sentiment Indicators**

```
😊 Positive   😐 Neutral   😡 Frustrated   😢 Sad   😠 Angry
```

---

## 📱 **Responsive Breakpoints**

- **Desktop:** 1920px+ (full layout)
- **Laptop:** 1366px (condensed panels)
- **Tablet:** 768px (stacked layout)
- **Mobile:** 375px (single column)

---

## ⌨️ **Keyboard Shortcuts**

| Action | Shortcut |
|--------|----------|
| Mute | M |
| Hold | H |
| Transfer | T |
| Hangup | X |
| Suggestion 1 | Ctrl+1 |
| Suggestion 2 | Ctrl+2 |
| Suggestion 3 | Ctrl+3 |
| Search Transcript | Ctrl+F |
| Save Notes | Ctrl+S |

---

## 🎯 **Next Steps**

1. **Create Figma Mockups** from these wireframes
2. **Build React Component Library**
3. **Implement WebRTC Softphone**
4. **Add Real-time State Management** (Redux/Zustand)
5. **Integrate with Backend APIs**

---

**Status:** ✅ Ready for design and development
**Last Updated:** December 14, 2024
**Version:** 1.0
