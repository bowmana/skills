export const DEFAULT_SAMPLE = `flowchart TD
    subgraph Source["DATA SOURCE"]
        A[System A<br/>Registration<br/>& Scheduling]
    end

    subgraph Sync["NIGHTLY SYNC"]
        B[CRON Job - 2:00 AM<br/>SQL Extract + ETL]
    end

    subgraph Storage["TABLES"]
        C1[(staging<br/>wiped daily)]
        C2[(persistent<br/>review flags)]
        C1 -.linked by key.-> C2
    end

    A -->|patient data| Sync
    Sync -->|loads rows| C1
    C1 --> D[Backend Script]
    C2 --> D
    D -->|JSON| E[Frontend UI]
    E -->|update flags| C2

    style C1 fill:#ffe6e6
    style C2 fill:#e6ffe6
    style D fill:#fff4e6
`;

export const SAMPLES: Record<string, string> = {
  flowchart: DEFAULT_SAMPLE,
  'flowchart (elk)': `---
config:
  layout: elk
---
flowchart LR
    a --> b
    a --> c
    b --> d
    c --> d
    d --> e[Long label with<br/>a line break]
`,
  sequence: `sequenceDiagram
    participant App
    participant API
    participant DB
    App->>API: POST /login
    API->>DB: verify credentials
    DB-->>API: user row
    API-->>App: JWT
    Note over App,API: session established
`,
  class: `classDiagram
    class Animal {
        +String name
        +makeSound() void
    }
    class Dog {
        +fetch() void
    }
    Animal <|-- Dog
`,
  state: `stateDiagram-v2
    [*] --> Idle
    Idle --> Loading: fetch
    Loading --> Ready: success
    Loading --> Error: failure
    Error --> Loading: retry
    Ready --> [*]
`,
  er: `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE_ITEM : contains
    CUSTOMER {
        string name
        string email
    }
`,
  gantt: `gantt
    title Release plan
    dateFormat YYYY-MM-DD
    section Build
    Research :done, r1, 2026-07-01, 7d
    Implement :active, i1, after r1, 14d
    section Ship
    QA :q1, after i1, 5d
`,
  pie: `pie title Time spent
    "Coding" : 55
    "Meetings" : 25
    "Reviews" : 20
`,
  mindmap: `mindmap
  root((mermaid-lite))
    Rendering
      mermaid 11
      elk layout
    Canvas
      pan zoom
      annotations
`,
};
