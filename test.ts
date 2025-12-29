// TODO # Concurrency Control – Project Checklist

// Use this checklist before shipping the project and when reviewing critical features.

// ---

// ## 1. Identify Shared Data

// * [ ] List all shared mutable data (e.g. counters, balances, inventory, followers, likes).
// * [ ] Mark which features read/write the same data concurrently.

// ---

// ## 2. Detect Read–Modify–Write Patterns

// * [ ] Search for any logic that does: read → modify → write.
// * [ ] Replace with atomic operations where possible:

//   * Redis: `INCR`, `DECR`, `HINCRBY`
//   * MongoDB: `$inc`, `$push`, `$addToSet`
//   * SQL: `UPDATE value = value + 1`

// ---

// ## 3. Ensure Atomicity

// * [ ] Verify each critical operation is atomic (all-or-nothing).
// * [ ] Use transactions when multiple updates must succeed together.
// * [ ] Confirm no partial updates can leave data inconsistent.

// ---

// ## 4. Apply Proper Concurrency Control

// * [ ] Decide per feature:

//   * Optimistic Concurrency (versioning, conflict detection)
//   * Pessimistic Concurrency (locks, transactions)
// * [ ] Justify the choice (performance vs safety).

// ---

// ## 5. Handle Idempotency

// * [ ] Ensure repeated requests do not corrupt data.
// * [ ] Protect against duplicate actions (double-like, double-follow, double-payment).
// * [ ] Use idempotency keys or unique constraints where needed.

// ---

// ## 6. Distributed Execution Safety

// * [ ] Assume multiple processes/servers/pods are running.
// * [ ] Avoid in-memory locks for shared state.
// * [ ] Use centralized systems (DB, Redis) for coordination.

// ---

// ## 7. Define Source of Truth

// * [ ] Clearly define the authoritative data source.
// * [ ] Treat caches (Redis) as non-authoritative.
// * [ ] Define recovery strategy if cache is lost or corrupted.

// ---

// ## 8. Validate Failure Scenarios

// * [ ] What happens if the process crashes mid-operation?
// * [ ] What happens if Redis/DB temporarily fails?
// * [ ] Ensure retries do not cause duplicate or inconsistent data.

// ---

// ## 9. Test Concurrency Explicitly

// * [ ] Simulate concurrent requests.
// * [ ] Test race conditions intentionally.
// * [ ] Verify counters and shared data remain correct under load.

// ---

// ## 10. Final Review

// * [ ] No shared data without protection.
// * [ ] No reliance on async/await for data safety.
// * [ ] Concurrency decisions documented and intentional.

// ---

// **Rule of Thumb:**
// If multiple operations can touch the same data at the same time, concurrency must be handled at the data level — not with async/await.
