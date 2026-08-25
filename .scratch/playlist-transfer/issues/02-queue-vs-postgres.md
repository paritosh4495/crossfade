# Job execution: Postgres queue versus a broker

Type: research
Status: open
Parent: ../map.md

## Question

The owner leans toward RabbitMQ or Redis but wants the tradeoffs before deciding. Gather them.

Compare, for this workload specifically (few concurrent jobs, each long-running, each pausable and resumable, each with per-track rows already in Postgres):

- Postgres as the queue via `SELECT ... FOR UPDATE SKIP LOCKED`
- Redis, whether raw lists, Streams, or a library on top
- RabbitMQ
- Spring scheduling and `@Async` with no queue at all

For each: operational cost on free hosting tiers, what breaks when the process restarts mid-job, how pause and resume are expressed, how the review-queue pause fits, message durability, and how much Spring Boot integration code it takes.

Weigh it against the hard constraint that job state already lives in Postgres per-track. A broker that duplicates that state creates two sources of truth.

Output is options and tradeoffs, not the decision. The decision is ticket 08.
