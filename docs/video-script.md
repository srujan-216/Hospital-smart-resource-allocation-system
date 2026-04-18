# Video Script — Final Evaluation

**Format:** 3-minute voiceover + screencast. No face cam.
**Tool:** OBS Studio (free). 1920×1080, 30fps, system audio + mic.
**Target length:** 2:55–3:05.

---

## Scene list (at a glance)

| # | Scene | Length | What's on screen |
|---|---|---|---|
| 0 | Cold open | 0:00 – 0:15 | Black → title card |
| 1 | Problem | 0:15 – 0:35 | Home page, stats panel |
| 2 | Citizen submits | 0:35 – 1:20 | Request form → green success card |
| 3 | Staff dashboard tour | 1:20 – 1:45 | Beds dashboard, sidebar, header stats |
| 4 | The bump moment | 1:45 – 2:30 | Admit modal → live bump animation → transfer log |
| 5 | Labs + audit | 2:30 – 2:50 | Labs tab, emergency toggle |
| 6 | Close | 2:50 – 3:00 | Tagline card |

---

## Before you record

**Setup (once):**
1. `cd api && npm run dev`
2. `cd web && npm run dev` (new terminal)
3. Open Chrome, window size 1920×1080, zoom **100%**, **hide bookmarks bar** (`Ctrl+Shift+B`).
4. Sign in as `admin` / `hackathon2026` in Tab 2, land on `/dashboard/beds`.
5. Click the **Reset** button top-right to get a clean seeded state.
6. Make sure ICU priority row is **full** (it is, post-seed) — the bump needs this.

**OBS settings:**
- Output → Recording → 1920×1080, CQP 20, MP4.
- Sources → 1 × Display Capture, 1 × Mic. Mute system sounds.
- Cursor → enable "highlight clicks" if your OBS has it, else use a cursor-highlighter app.

**Voice:**
- Record in a quiet room. Phone voice memo on a mic stand beats a laptop mic.
- Speak 10% slower than feels natural. Pause between scenes.

---

## Scene 0 — Cold open (0:00 – 0:15)

**On screen:**
- Black frame → fade to white title card.
- **Big text (72pt):** *Smart Bed Allocation*
- **Sub (28pt):** *Urgent first. Auto-reallocates. Fully audited.*
- Small corner tag: *Hackathon Aethronix · Final round*

**Voiceover:**
> In an Indian hospital today, admitting a patient takes thirty to forty-five minutes. Phone calls. Whiteboards. And emergencies wait behind routine cases — because nobody has a clear picture of what's free.
>
> We built a system that fixes this. In one click.

*(Pause 1 second. Cut to the live app.)*

---

## Scene 1 — Problem (0:15 – 0:35)

**On screen:** Tab 1, `http://localhost:5173/`. Hero + live stats panel.

**Voiceover:**
> This is the public home page. Anyone — a patient, a family member, a passerby — can see the hospital in real time. Free beds. Waiting. Allocated. Utilization.
>
> No logins. No phone calls. No guessing.

**Action:** slow cursor hover over each of the four stats in the hero. Hold on **Free beds**.

---

## Scene 2 — Citizen submits (0:35 – 1:20)

**Action:** click **Request a bed →**.

**Voiceover (while form loads):**
> Let's say a grandson is filing a request for his grandfather — chest pain, sweating, high blood pressure.

**Fill the form on camera:**
- Name: `Ramesh Yadav`
- Phone: `+91 9876543210`
- City: stays `Lucknow`
- Onset: stays *now*
- Description: `Dada ji chest pain, sweating, BP 160/100, diabetic, sansne mein takleef`
- Tick **Senior citizen (60+)**

**Voiceover (over the typing):**
> Plain Hindi-English works — *sansne mein takleef*, breathing difficulty. Our AI triage picks it up. Phone is validated against the Indian mobile format. He's a senior citizen, so we tick that flag.

**Action:** click **Submit**.

**On screen:** green success card appears. *"✓ Bed Assigned · Automatic"*, bed number, score, SMS preview.

**Voiceover (hit this hard):**
> Watch this. **Nobody clicked allocate.** No doctor touched the form. The AI extracted urgency, added the senior-citizen weight, the Hungarian algorithm ran over every free bed and every waiting patient at once — and picked the globally-optimal match. All in the time it took to press submit.

**Action:** hover over the SMS preview.

**Voiceover:**
> And this is the message the patient receives. Real gateway ready, no-op in demo.

---

## Scene 3 — Staff dashboard tour (1:20 – 1:45)

**Action:** switch to **Tab 2** — `/dashboard/beds`.

**Voiceover:**
> Now the other side. This is what the hospital admin sees. Four wings — ICU, General, Pediatric, Isolation. Forty-eight beds, numbered continuously. Every wing has a **priority row**, outlined red — and a **regular row**, teal.

**Action:** slow cursor sweep across the four blocks.

**Voiceover:**
> A red pulsing dot means a high-risk patient.

**Action:** point cursor at a red-dot bed.

**Voiceover:**
> Everything is live. Every stat up top — occupied, priority free, queued — updates in place.

---

## Scene 4 — The bump moment (1:45 – 2:30)

**Action:** click **+ Admit patient** in the top bar.

**Voiceover:**
> Now the killer moment. A critical patient just walked in. Severe cardiac arrhythmia. Pregnant. Highest priority.

**Fill the modal:**
- Name: `Kavita Sharma`
- Phone: `+91 9123456780`
- Condition: `severe cardiac arrhythmia`
- Risk: **High**
- Preferred block: **ICU Wing**
- Vulnerabilities: tick **Pregnant**

**Action:** click **Admit & auto-allocate**.

**On screen:** watch for — donor bed flashes, recipient bed flashes, two toasts fire, transfer log gets a new entry.

**Voiceover (slow down, narrate the moment):**
> Watch the ICU wing. A lower-risk patient just got moved out of priority — to make room. Kavita takes their slot. Two transfers, logged with a reason. **This is the Hungarian algorithm deciding who to bump so the global cost is minimized** — not a first-come, first-served queue.

**Action:** point at the **Recent transfers** panel on the right.

**Voiceover:**
> Every move on record. Timestamp. Actor. Reason. Medico-legal grade.

---

## Scene 5 — Labs + audit (2:30 – 2:50)

**Action:** click **Labs** in the sidebar.

**Voiceover:**
> Same engine, different resource. Six lab blocks. Thirty labs.

**Action:** click a green (in-use) lab → toggle **Emergency: ON**.

**Voiceover:**
> Toggle emergency mode, and a STAT test can preempt whatever is running. The displaced test goes to the queue. Same audit trail.

---

## Scene 6 — Close (2:50 – 3:00)

**On screen:** fade to a closing card.
- **Big text:** *Urgent first. Auto-reallocates. Fully audited.*
- **Sub:** *No Hungarian button. No guessing. No whiteboard.*
- **Corner:** `github.com/kondameedi-srujan-raj/aethronix` (replace with your real URL)

**Voiceover:**
> Urgent first. Auto-reallocates. Fully audited. That's the whole pitch.
>
> Thank you.

*(Hold the card for 2 full seconds before cutting.)*

---

## On-screen captions to overlay in post

Add these as subtle text overlays during the listed scenes — large, top-center, auto-fade after 2s:

| Time | Caption |
|---|---|
| 0:40 | *Public intake · no login* |
| 1:05 | *AI triage · regex fallback always works* |
| 1:15 | *Hungarian algorithm · O(n³) · global optimum* |
| 1:55 | *Real-time bump · state-driven* |
| 2:20 | *Every move logged* |
| 2:45 | *Same engine · different resource* |

Keep captions **short**. If it takes longer than 1 second to read, cut it.

---

## Edit notes

- Cut every "um", every 0.4s+ silence between sentences.
- Speed up typing sequences to 1.5× in post (keeps momentum).
- **Never** speed up the bump moment — let the viewer see the flash.
- Add a soft ambient track at -24dB. Nothing epic. Lo-fi works.
- Export at 1920×1080 H.264, ~10 Mbps. MP4.

---

## Checklist before you hit upload

- [ ] Length 2:55 – 3:05
- [ ] No personal info visible (browser history, other tabs)
- [ ] No password typed on camera (pre-login before recording)
- [ ] Audio is mono, -16 LUFS, no clipping
- [ ] Captions readable at 480p (YouTube default on phone)
- [ ] Thumbnail: screenshot of the dashboard with the title overlay
- [ ] Title: *Smart Bed Allocation — Hackathon Aethronix Finals*
- [ ] Description: one-paragraph pitch + GitHub link + demo creds

---

## If something breaks during recording

Don't restart the whole take — you can splice. Keep these safety clips pre-recorded in case the live run misbehaves:

- 30-second clean dashboard pan (no interaction)
- 15-second close-up of the transfer log scrolling
- 10-second close-up of the green "Bed Assigned" success card

Cut to these if the live demo glitches. Nobody will know.
