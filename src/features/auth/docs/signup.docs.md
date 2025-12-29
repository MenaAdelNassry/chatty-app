# 🚀 Feature: User Sign Up Documentation

## 1. System Workflow (Data Flow)

> This diagram illustrates the complete flow from the client request to the database write operation.

```mermaid
sequenceDiagram
    autonumber
    participant Client
    participant Controller
    participant Cloudinary
    participant Redis
    participant Queue
    participant Worker
    participant DB as MongoDB

    Client->>Controller: POST /signup (Body + Image)

    Note over Controller: Validation & ID Generation

    rect rgb(255, 230, 230)
        Note over Controller, Cloudinary: ⚠️ Potential Bottleneck
        Controller->>Cloudinary: Upload Image (Await)
        Cloudinary-->>Controller: Return Image URL
    end

    Controller->>Redis: Save User Data (Cache)
    Controller->>Queue: Add Job (Background Process)

    Controller-->>Client: 201 Created (Token + User Data)

    Note over Queue, DB: Async Write-Behind
    Queue->>Worker: Process Job
    Worker->>DB: Save to 'Auth' & 'User' Collections
```

2. API Contract (Data Structure)
📥 Request Body (Client -> Server)
JSON

{
  "username": "Mena_Gerges",
  "password": "password123",
  "email": "mena@example.com",
  "avatarColor": "#f44336",
  "avatarImage": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
📤 Response Data (Server -> Client)
JSON

{
  "message": "User created successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "651234567890abcdef123456",
    "username": "Mena_Gerges",
    "email": "mena@example.com",
    "profilePicture": "[https://res.cloudinary.com/demo/image/upload/v1/user.jpg](https://res.cloudinary.com/demo/image/upload/v1/user.jpg)",
    "uId": "83402840211"
  }
}
3. Technical Implementation Notes 🛠️
🔒 Security & Hashing
Password Handling: Passwords remain in plain text throughout the Controller, Redis, and Queue layers.

Hashing Location: Hashing is strictly performed at the Data Access Layer using Mongoose pre('save') hook.

Implication: Developers must ensure Redis/Queue logs are secured as they contain raw passwords.

⚠️ Performance & Constraints
Cloudinary Upload: The current implementation performs a synchronous (await) upload to Cloudinary within the request lifecycle.

Risk: High concurrency (e.g., 100+ simultaneous signups) may cause Event Loop Blocking due to network I/O latency, leading to request timeouts.

Status: Acceptable for current traffic load.

Write-Behind Pattern: We return a success response before data is persisted to MongoDB.

Risk: Rare edge case where the Worker fails (e.g., duplicate key error) after the user has already received a success token.

🔮 Future Improvements
[ ] Move Cloudinary upload to the Client-side (React) to reduce server load.

[ ] Implement encryption for sensitive data inside Redis and BullMQ.

