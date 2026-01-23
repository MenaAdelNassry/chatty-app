📊 Visual Workflows (Mermaid)
-----------------------------

### 1\. Logic Flow (Controller)

```mermaid
graph TD
    A[Request: REMOVE Reaction] --> B{Get Post & Reaction from Cache/DB}
    
    B -- "Post Not Found" --> C[❌ Throw 404]
    B -- "Reaction Not Found" --> D[✅ Return 200 OK directly]
    
    B -- "Reaction Found" --> E[Proceed to Remove]
    
    E --> F[Cache: Update Object in RAM]
    F --> G[Cache: HSET (Overwrite Counts)]
    F --> H[Cache: HDEL User Reaction]
    
    H --> I[Queue: Add 'removeReactionFromDB' Job]
    I --> J[Response: 200 OK]
```

2\. Sequence Diagram (User's Implementation)

```mermaid
sequenceDiagram
    autonumber
    actor User as 👤 User
    participant API as 🛡️ Controller
    participant Cache as ⚡ Redis
    participant Queue as 📨 Queue

    User->>API: DELETE /reaction/:postId
    
    API->>Cache: Get Post & User Reaction
    Cache-->>API: Returns Post Object + Reaction
    
    Note over API: Memory Processing 🧠
    API->>API: post.reactions.like - 1
    
    Note over API, Cache: Cache Update 💾
    API->>Cache: MULTI
    API->>Cache: 1. HDEL reactions:postId userId
    API->>Cache: 2. HSET posts:postId (New Counts JSON)
    API->>Cache: EXEC
    
    API->>Queue: Add Job (removeReactionFromDB)
    API-->>User: 200 OK
```
