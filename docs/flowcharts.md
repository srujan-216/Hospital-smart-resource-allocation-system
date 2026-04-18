# Flowcharts

Every key path in the Smart Bed Allocation system, as a mermaid flowchart. Paste any of these into a markdown preview (GitHub, VS Code, HackMD) to render.

---

## Table of contents

1. [End-to-end system context](#1-end-to-end-system-context)
2. [Patient intake — the happy path](#2-patient-intake--the-happy-path)
3. [Patient intake — queue path](#3-patient-intake--queue-path)
4. [Staff admit — with bump](#4-staff-admit--with-bump)
5. [Risk change — promote / demote](#5-risk-change--promote--demote)
6. [Discharge — pull-in from queue](#6-discharge--pull-in-from-queue)
7. [Lab emergency preemption](#7-lab-emergency-preemption)
8. [Lab maintenance toggle](#8-lab-maintenance-toggle)
9. [Authentication — staff login](#9-authentication--staff-login)
10. [Real-time feedback loop](#10-real-time-feedback-loop)
11. [State machines](#11-state-machines)

---

## 1. End-to-end system context

```mermaid
flowchart LR
    subgraph Actors["Actors"]
        C["Citizen /<br/>Family member"]
        S["Hospital staff<br/>admin / nurse"]
    end

    subgraph Frontend["React + Vite"]
        HP["Home · Request · Queue<br/>(public)"]
        DP["Dashboard<br/>Beds · Labs<br/>(staff, JWT)"]
    end

    subgraph Backend["Express API"]
        PR["Public routes<br/>/requests /queue<br/>/resources /audit /triage"]
        SR["Staff routes<br/>/beds /labs /allocations/auto<br/>/seed"]
        ENG["Allocation engine<br/>scoring · hungarian<br/>smart-beds · smart-labs"]
    end

    subgraph Store["Storage"]
        DB[("Mongo / JSON")]
    end

    C --> HP
    S --> DP
    HP --> PR
    DP --> PR
    DP --> SR
    PR --> ENG
    SR --> ENG
    ENG --> DB

    style C fill:#f1f5f9
    style S fill:#fef3c7
    style ENG fill:#dcfce7,stroke:#10b981
    style DB fill:#e0f2fe
```

---

## 2. Patient intake — the happy path

A citizen submits a request, the Hungarian algorithm runs, and a bed is assigned before the form animation finishes.

```mermaid
flowchart TD
    A([Citizen lands on /d/hospital/request]) --> B[Fills form<br/>name · phone · city<br/>onset · description · vulnerabilities]
    B --> C{Client-side validation<br/>phone regex 6-9<br/>date window · name chars}
    C -- invalid --> B
    C -- valid --> D[POST /api/requests]

    D --> E[Zod schema validation]
    E -- fail --> E1([400 — details])
    E -- pass --> F[Triage service]

    F --> F1{ANTHROPIC_API_KEY set?}
    F1 -- yes --> F2[Call Claude API<br/>source = claude]
    F1 -- no --> F3[Rule-based regex parser<br/>source = rule]
    F2 --> G
    F3 --> G

    G[Extract urgency 1–10<br/>+ acuity hint<br/>+ matched keywords] --> H[Store request in DB<br/>status = waiting]
    H --> I[performAutoAllocation]

    I --> J[Build cost matrix<br/>waiting × free beds]
    J --> K[runHungarian O n³]
    K --> L{Free bed matched?}

    L -- yes --> M[markBedOccupied<br/>createAllocation<br/>addAudit]
    M --> N[Return JSON<br/>auto_allocated = true<br/>allocation with bed + score + SMS preview]
    N --> O([Green '✓ Bed assigned' screen])

    L -- no --> P[Return JSON<br/>auto_allocated = false<br/>status = waiting]
    P --> Q([Amber 'Added to queue' screen])

    style M fill:#dcfce7
    style N fill:#dcfce7
    style O fill:#bbf7d0
    style P fill:#fef3c7
    style Q fill:#fde68a
```

---

## 3. Patient intake — queue path

If no bed is free, the request waits. Each subsequent request or discharge re-runs Hungarian.

```mermaid
flowchart TD
    A[Request submitted<br/>no bed free] --> B[Status = waiting]
    B --> C[Appears on /d/hospital/queue<br/>with live score bars]

    D[Wait timer ticks<br/>wait factor climbs] --> E[Score rises<br/>up to +20 after 45 min]

    F{Trigger:<br/>new request? discharge?<br/>risk change opens a slot?} --> G[performAutoAllocation runs]
    G --> H[Hungarian re-matches<br/>entire queue × free beds]
    H --> I{This patient now matched?}
    I -- yes --> J[Status = allocated<br/>audit logged]
    I -- no --> B

    style B fill:#fef3c7
    style J fill:#dcfce7
```

---

## 4. Staff admit — with bump

Staff opens the admit modal and the patient takes priority over the lowest-risk ICU occupant.

```mermaid
flowchart TD
    A([Staff clicks '+ Admit patient']) --> B[Fill modal<br/>name · condition · risk<br/>preferred block · vulnerabilities]
    B --> C[POST /api/beds/admit]
    C --> D[smart-beds.admitPatient]

    D --> E{risk_level?}
    E -- low or medium --> F{Regular bed free<br/>in preferred block?}
    F -- yes --> F1[Admit to regular]
    F -- no --> F2{Any regular bed free?}
    F2 -- yes --> F1
    F2 -- no --> F3[Enqueue]

    E -- high --> G{Priority bed free<br/>in preferred block?}
    G -- yes --> G1[Admit to priority]
    G -- no --> G2{Any priority bed free?}
    G2 -- yes --> G1
    G2 -- no --> H[Find lowest-risk<br/>priority occupant]

    H --> I{Found someone<br/>lower-risk?}
    I -- no --> J[Enqueue<br/>reason: no bump possible]
    I -- yes --> K{Regular bed free?}
    K -- no --> J
    K -- yes --> L[BUMP<br/>move lower-risk → regular<br/>log TransferEvent bumped_down]
    L --> M[Admit high-risk → priority<br/>log TransferEvent admitted_priority]

    F1 --> N[addAudit bed:admit]
    G1 --> N
    M --> N
    F3 --> N
    J --> N

    N --> O[Return new BedsState]
    O --> P[UI: toast + flash<br/>affected tiles]

    style L fill:#fee2e2,stroke:#ef4444
    style M fill:#dcfce7,stroke:#10b981
    style J fill:#fef3c7
    style F3 fill:#fef3c7
```

---

## 5. Risk change — promote / demote

Staff edits a patient's risk. The system maintains the priority-row invariant.

```mermaid
flowchart TD
    A([Staff clicks bed → changes risk toggle]) --> B[POST /api/beds/:id/risk]
    B --> C[smart-beds.changeRisk]
    C --> D[Update patient.risk_level]

    D --> E{New risk = high?}
    E -- yes --> F{Currently in regular row?}
    F -- no --> Z1[log risk_changed]
    F -- yes --> G{Any priority bed free?}
    G -- no --> Z1
    G -- yes --> H[Swap patient into priority<br/>log upgrade_to_priority]
    H --> Q[Pull queued patient<br/>into freed regular slot if any]

    E -- no --> I{New risk = low or medium?}
    I -- no --> Z1
    I -- yes --> J{Currently in priority row?}
    J -- no --> Z1
    J -- yes --> K{Any regular bed free?}
    K -- no --> Z1
    K -- yes --> L[Swap patient into regular<br/>log demote_to_regular]
    L --> M[Pull queued high-risk<br/>into freed priority slot if any]

    Q --> N[addAudit bed:risk_change]
    M --> N
    Z1 --> N

    N --> O[Return BedsState]
    O --> P[UI: toast + flash]

    style H fill:#dcfce7,stroke:#10b981
    style L fill:#e0f2fe,stroke:#0ea5e9
    style Q fill:#fef3c7
    style M fill:#fef3c7
```

---

## 6. Discharge — pull-in from queue

```mermaid
flowchart TD
    A([Staff clicks Discharge]) --> B[POST /api/beds/:id/discharge]
    B --> C[smart-beds.discharge]
    C --> D[Clear bed<br/>status = available]
    D --> E[log discharged]
    E --> F{Anyone in queue?}
    F -- no --> G[Return BedsState]
    F -- yes --> H{Top queued patient<br/>risk matches freed row?}
    H -- yes --> I[Pull patient into freed bed<br/>log pulled_from_queue]
    H -- no, row mismatch --> J{Any bed of the right row<br/>available elsewhere?}
    J -- yes --> I
    J -- no --> K[Leave in queue]
    I --> G
    K --> G
    G --> L[addAudit bed:discharge]
    L --> M[UI: toast + flash]

    style D fill:#e0f2fe
    style I fill:#dcfce7
```

---

## 7. Lab emergency preemption

Lab is in-use, emergency toggled ON, new STAT test assigned → current occupant preempted.

```mermaid
flowchart TD
    A([Lab in status = in_use]) --> B[Staff toggles Emergency: ON]
    B --> C[POST /api/labs/:id/emergency]
    C --> D[smart-labs.toggleEmergency]
    D --> E[Set lab.emergency = true<br/>log emergency_on]

    F([Staff clicks '+ Assign patient']) --> G[POST /api/labs/:id/assign<br/>patient · request_type]
    G --> H{lab.status?}
    H -- maintenance --> H1([400 Rejected])
    H -- available --> I[Assign directly<br/>log assigned]
    H -- in_use --> J{lab.emergency?}
    J -- false --> J1([400 Rejected])
    J -- true --> K[Preempt current occupant<br/>push to queue<br/>log preempted_to_queue]
    K --> L[Assign new STAT test<br/>log assigned_emergency]

    I --> M[addAudit lab:assign]
    L --> M
    M --> N[Return LabsState]
    N --> O[UI: toast + flash]

    style K fill:#fee2e2,stroke:#ef4444
    style L fill:#dcfce7,stroke:#10b981
```

---

## 8. Lab maintenance toggle

```mermaid
flowchart TD
    A([Staff toggles Maintenance]) --> B[POST /api/labs/:id/maintenance]
    B --> C[smart-labs.toggleMaintenance]
    C --> D{Current status?}

    D -- maintenance --> E[Set status = available<br/>log maintenance_off]
    D -- available --> F[Set status = maintenance<br/>log maintenance_on]
    D -- in_use --> G[Preempt current occupant<br/>push to queue<br/>log preempted_to_queue]
    G --> H[Set status = maintenance<br/>log maintenance_on]

    E --> I[addAudit lab:maintenance]
    F --> I
    H --> I
    I --> J[Return LabsState]
    J --> K[UI: toast + flash]

    style G fill:#fee2e2
    style F fill:#fef3c7
    style H fill:#fef3c7
```

---

## 9. Authentication — staff login

```mermaid
flowchart TD
    A([Staff visits /login]) --> B[Enter username + password]
    B --> C[POST /api/auth/login]
    C --> D{Credentials match<br/>ADMIN_USERNAME / ADMIN_PASSWORD?}
    D -- no --> E([401 invalid credentials])
    D -- yes --> F[Sign JWT<br/>secret = JWT_SECRET<br/>exp = 12h]
    F --> G[Return token + username]
    G --> H[Client saves to localStorage]
    H --> I[Redirect to /dashboard/beds]

    J([Any staff route hit]) --> K[Axios interceptor<br/>adds Authorization: Bearer]
    K --> L[requireAdmin middleware]
    L --> M{Valid signed JWT?}
    M -- no --> N([401])
    M -- yes --> O[Request proceeds<br/>to route handler]

    style F fill:#dcfce7
    style E fill:#fee2e2
    style N fill:#fee2e2
```

---

## 10. Real-time feedback loop

Every backend state change emits a `TransferEvent`. The UI turns it into a visible moment.

```mermaid
flowchart LR
    subgraph Back["Backend"]
        A[smart-beds or smart-labs<br/>mutates state] --> B[logTransfer<br/>kind · reason · resource_ids]
        B --> C[In-memory transfers array]
    end

    subgraph Front["Frontend — Dashboard"]
        D[8s poll<br/>GET /api/beds or /api/labs] --> E[useTransferFeedback<br/>diffs prev vs new]
        E --> F{New transfers?}
        F -- no --> G([Render tiles])
        F -- yes --> H[For each new transfer]
        H --> I[toast.push kind + reason]
        H --> J[flash affected tiles<br/>teal ring 1.1s × 2]
        I --> G
        J --> G
    end

    C --> D

    style B fill:#dcfce7
    style I fill:#fef3c7
    style J fill:#e0f2fe
```

---

## 11. State machines

### Bed states

```mermaid
stateDiagram-v2
    [*] --> available
    available --> occupied : admit / pull-from-queue
    occupied --> available : discharge
    occupied --> occupied : risk change in same row
    occupied --> occupied_priority : promote (regular → priority)
    occupied_priority --> occupied : demote (priority → regular)
    occupied_priority --> occupied_bumped : bumped by higher-risk arrival
    occupied_bumped --> available : discharge
```

### Lab states

```mermaid
stateDiagram-v2
    [*] --> available
    available --> in_use : assign patient
    available --> maintenance : toggle maintenance ON
    in_use --> available : reset / patient done
    in_use --> maintenance : maintenance ON (preempt)
    in_use --> in_use : emergency toggle (flag only)
    maintenance --> available : toggle maintenance OFF

    note right of in_use
        emergency flag ON →
        new assign preempts
        current occupant to queue
    end note
```

### Request lifecycle

```mermaid
stateDiagram-v2
    [*] --> waiting : POST /api/requests
    waiting --> allocated : Hungarian matches bed
    waiting --> waiting : next request / discharge re-runs Hungarian
    allocated --> completed : discharge
    waiting --> cancelled : admin manual (not wired in UI)
    completed --> [*]
    cancelled --> [*]
```

---

## How to read these diagrams

- **Rectangles** = synchronous actions (function calls, DB writes).
- **Diamonds** = decision points.
- **Rounded rectangles** = user-facing endpoints or results.
- **Cylinders** = data stores.
- **Dotted arrows** = optional / conditional paths.
- **Colour**: green = happy path, yellow = queue / maintenance, red = rejection or preemption, blue = storage / info.

For the narrated flow, see [`docs/demo-guide.md`](demo-guide.md). For the code references behind each node, see [`docs/architecture.md`](architecture.md).
