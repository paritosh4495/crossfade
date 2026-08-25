# Choose the execution and hosting setup

Type: grilling
Status: open
Blocked by: 02, 03
Parent: ../map.md

## Question

Make the call the two research tickets set up.

- Queue mechanism: Postgres `SKIP LOCKED`, Redis, RabbitMQ, or none.
- Where the worker runs: inside the Spring Boot process or as a separate deployable.
- Deployment target, given what free tiers actually permit and what they cost when they do not.
- Concurrency: how many jobs run at once, and how many provider calls in flight per job.
- How the frontend learns about progress: polling, SSE, or WebSocket.
- What happens to in-flight jobs during a deploy or a crash.
- Whether the Python sidecar scales with the app or stays a single instance.

The v1 spec needs one answer per bullet, not a menu.
