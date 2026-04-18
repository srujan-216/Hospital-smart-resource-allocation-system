# Talk track — read this aloud while recording

**How to use:** open this file on a second monitor (or on your phone). Read the **bold** lines out loud, slowly. When you see `[CLICK ...]`, do that click. When you see `[PAUSE 1s]`, stop talking for one second.

Practice once silently before you hit record. Total runtime: ~3 minutes.

---

## Start here

Before you hit record:

- App is running (`npm run dev` in `api/` and `web/`)
- Chrome at `http://localhost:5173/` — the public home page
- Second tab signed in as `admin`, sitting on `/dashboard/beds`
- Dashboard has been **Reset** (button top-right)
- Chrome zoom **100%**, bookmarks bar hidden
- Close Slack, email, anything that might ping

---

## The talk track

[START RECORDING. Tab 1 showing.]

**"Hi. This is Smart Bed Allocation — a hospital admission engine we built for Hackathon Aethronix."**

**"In an Indian hospital today, admitting a patient takes thirty to forty-five minutes. Phone calls. Whiteboards. And emergencies wait behind routine cases, because nobody has a clear picture of what's free. We fixed that."**

[PAUSE 1s]

**"This is the public home page. Anyone can see the hospital in real time — free beds, waiting, allocated, utilization. No login needed."**

[CLICK "Request a bed →"]

**"Let's file a request. A grandson is submitting for his grandfather."**

[Type name: `Ramesh Yadav`]
[Type phone: `+91 9876543210`]
[Type description: `Dada ji chest pain, sweating, BP 160/100, diabetic, sansne mein takleef`]
[Tick "Senior citizen (60+)"]

**"Plain Hindi-English works — our AI triage picks up 'sansne mein takleef' as breathing difficulty. Phone is validated against the Indian mobile format. He's a senior, so we tick that."**

[CLICK Submit]

[PAUSE 2s — let the green card appear]

**"Watch this. Nobody clicked allocate. No doctor touched the form. The AI extracted urgency, added the senior-citizen weight, the Hungarian algorithm ran over every free bed and every waiting patient at once, and picked the globally-optimal match. All in the time it took to press submit."**

[Hover over the SMS preview]

**"And this is the SMS the patient receives."**

[SWITCH to Tab 2 — dashboard]

**"Now the staff side. Four wings — I.C.U., General, Pediatric, Isolation. Forty-eight beds. Every wing has a priority row, red, and a regular row, teal. A red pulsing dot means a high-risk patient."**

[Slow cursor sweep across the four blocks]

**"Now the killer moment."**

[CLICK "+ Admit patient" top-right]

[Type name: `Kavita Sharma`]
[Type phone: `+91 9123456780`]
[Type condition: `severe cardiac arrhythmia`]
[Pick Risk: High]
[Pick Preferred block: ICU Wing]
[Tick Pregnant]

**"A critical patient just walked in. Severe arrhythmia. Pregnant. Highest priority. I.C.U. priority row is already full."**

[CLICK "Admit & auto-allocate"]

[PAUSE 2s — watch the flash rings and toasts]

**"Watch the I.C.U. wing. A lower-risk patient just got moved out of priority, to make room. Kavita takes their slot. Two transfers, logged with a reason. This is the Hungarian algorithm deciding who to bump, not a first-come-first-served queue."**

[Point at the "Recent transfers" panel on the right]

**"Every move on record. Timestamp. Actor. Reason. Hospital-grade audit trail."**

[CLICK "Labs" in the sidebar]

**"Same engine, different resource. Six lab blocks, thirty labs. Toggle emergency mode and a stat test preempts whatever is running. The displaced test goes to the queue. Same audit trail."**

[CLICK any green lab → toggle Emergency ON]

[PAUSE 1s]

**"That's it. Urgent first. Auto-reallocates. Fully audited. No Hungarian button. No guessing. No whiteboard."**

[PAUSE 1s]

**"Thank you."**

[STOP RECORDING]

---

## If you mess up

- **Small stumble on a word?** Keep going. Loom lets you trim, but tiny stumbles sound human.
- **Big mistake mid-recording?** Stop, delete the video from Loom, restart. It's free and unlimited.
- **App glitches?** Hit the Reset button, close Loom, start again.

Three takes max. Pick the best one.

---

## After you stop

1. Loom auto-uploads.
2. Click the pencil icon → **Trim** → cut any dead air at start and end.
3. Click **Share → Copy link**.
4. Make sure the link setting is **"Anyone with the link can view"**.
5. Paste the link in your hackathon submission form.

Done.
