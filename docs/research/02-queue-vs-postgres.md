# Job execution: Postgres queue versus a broker

Research for [issue #3](https://github.com/paritosh4495/crossfade/issues/3). Feeds the decision in #9.
Date: 2026-08-25. Options and tradeoffs only, no decision.

## What the workload actually is

Worth restating, because it rules out more than it looks like:

- Few concurrent jobs. One user transferring one playlist, maybe a handful at once.
- Each job runs for minutes to hours, throttled by Spotify and YouTube Music rate limits.
- Per-track state already lives in Postgres: one row per track, states pending, matched, needs review, written, failed.
- A job can pause for three reasons: the user asks, a 429 forces it, or the user has a review queue open and hasn't touched it for a week.
- Deploy target is free hosting tiers.

The pause-for-a-week case is the one that breaks brokers, and the free-tier constraint is the one that breaks the assumption that a broker helps at all. Both are covered below.

## The finding I did not expect

No free compute tier I could verify gives you an always-on process.

- Render spins down a free web service after 15 minutes without inbound traffic, and free plans cover web services, static sites, Postgres, and Key Value only. Background workers are not on the free list.
- Koyeb's free instance cannot run Worker Services and scales to zero after an hour of no traffic (secondary sources, see confidence notes).
- Fly.io deprecated its Hobby, Launch, and Scale plans on 7 October 2024 and no longer offers a free tier to new accounts.
- Railway's free tier is $1 of monthly usage credit at 1 vCPU / 0.5 GB.

Neon scales its free compute to zero after five minutes idle, and Supabase pauses free projects after a week of inactivity.

This matters more than the queue choice. Whatever you pick, the process will be killed at an arbitrary point mid-job, repeatedly, as normal operation rather than as failure. Every option therefore needs the same thing: resumable per-track progress in Postgres and a way to reclaim an abandoned job. Once you have built that, the broker is carrying a pointer, not state.

Second-order consequence: a sleeping web service plus a Postgres that scales to zero means a long job only advances while somebody is hitting the app. A 500-track transfer on Render free will not run to completion overnight on its own. An external pinger or a paid always-on worker is the fix. Flagging it because it changes what "background job" means here.

## Option A: Postgres queue via SELECT ... FOR UPDATE SKIP LOCKED

Postgres blesses this use case in the manual, in as many words:

> With `SKIP LOCKED`, any selected rows that cannot be immediately locked are skipped. Skipping locked rows provides an inconsistent view of the data, so this is not suitable for general purpose work, but can be used to avoid lock contention with multiple consumers accessing a queue-like table.

Two ways to use it, and the difference is the whole game.

**Long transaction.** Claim the row and hold the lock for the duration of the job. Correct on paper. Terrible here, because a transaction open for two hours pins a connection, blocks vacuum from cleaning tuples, and shows up as idle-in-transaction. Do not do this for hour-long jobs.

**Short claim, external lease.** One quick transaction runs `SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1`, sets `status = 'running'`, `claimed_by`, and `lease_expires_at`, then commits. The worker heartbeats the lease while it processes tracks. A reaper resets leases that expired. `SKIP LOCKED` only protects the claim, which is all you need. This is what db-scheduler does internally with heartbeats and dead-execution detection.

Restart mid-job: the lease expires, the reaper flips the row back to claimable, another worker picks it up and continues from the first track that isn't `written`. No message to lose, because there was no message.

Pause is an `UPDATE jobs SET status = 'paused'`. The claim query doesn't select paused rows. Resume is another `UPDATE`. Indefinite pause costs nothing, because a row that no query selects is not a running clock. This is the single largest advantage over any broker, and it applies directly to the review queue: a job sitting in `awaiting_review` for a month has no TTL, no redelivery timer, and nothing that will decide it looks dead.

Durability is whatever your database durability is. Better still, the claim and the track-row writes can share a transaction, so within Postgres you get exactly-once semantics for free rather than at-least-once plus idempotency work.

Cost: zero extra infrastructure. You already need Postgres.

Integration code: a status column or a small `job_queue` table, one `@Scheduled` poller, one native query, a reaper. Call it 100 to 200 lines including tests. Libraries if you don't want to hand-roll:

- **db-scheduler** (Apache 2.0). One `scheduled_tasks` table, `db-scheduler-spring-boot-starter`, heartbeat-based dead execution recovery. The README contrasts it with Quartz's eleven tables.
- **JobRunr** (open-source core, Pro tier for priority queues, rate limiting, batches). Postgres backend, Spring Boot starter, a dashboard where you requeue or delete jobs. States are ENQUEUED, PROCESSING, SUCCEEDED, FAILED.
- **ShedLock** (Apache 2.0) if you only need "don't run this scheduled task twice across instances". Its README is blunt that it is not and will never be a scheduler.

Honest downsides: polling latency (mitigable with `LISTEN`/`NOTIFY`, but that needs a dedicated non-pooled connection, so most people just poll every few seconds); repeated `UPDATE`s on a hot status column create dead tuples and vacuum work; you own the reaper and its bugs; a scale-to-zero Postgres adds cold-start latency to every poll and burns free compute hours on an empty queue. That last one is real. Polling every 5 seconds keeps a Neon free compute awake permanently and will eat the 100 CU-hour allowance.

## Option B: Redis

Three sub-options, and they are not equivalent.

**Raw lists (`LPUSH` / `BRPOP`).** No acknowledgement. Once a worker pops, the message is gone. Kill the process and the pointer vanishes. Recovery means scanning Postgres for jobs stuck in `running`, which is exactly the reaper from option A. So raw lists give you a wakeup signal and nothing else.

**Streams with consumer groups.** The real option. `XREADGROUP` delivers, the message sits in the Pending Entries List until `XACK`, and `XAUTOCLAIM` with a `min-idle-time` hands abandoned messages to another consumer. Redis has no consumer heartbeat and does not detect a dead consumer, so you write the claim loop and pick the idle timeout yourself.

**Redisson** (Apache 2.0) wraps lists and streams behind `RBlockingQueue` and friends if you'd rather not touch the primitives.

Now the problems.

Durability on free tiers is bad. Render's free Key Value instance is in-memory only and loses all data whenever it restarts. Upstash's free plan is 500K commands per month, 256 MB, 10 GB bandwidth, one database. 500K commands sounds generous until you count a poll loop: one command per second is about 2.6 million per month, five times over budget. Blocking reads with long timeouts cut that down, but I could not find documented limits on blocking-command duration against Upstash, and Upstash is REST-first, which complicates blocking. Treat that as unverified.

Pause has no Redis expression. You either stop the listener container (pauses all jobs, not one) or never enqueue in the first place. Since a job is not one message but a long-running loop over tracks, pause realistically means the worker checks a Postgres flag between tracks. Redis isn't expressing pause. Postgres is.

Indefinite pause for review is a genuinely poor fit. A message that sits unacked in the PEL for three days is indistinguishable from one owned by a crashed consumer, and `XAUTOCLAIM` will reassign it. The only clean pattern is to ack and drop the message on entering review, then re-enqueue on resume. Which means the durable record of "this job exists and is waiting" is the Postgres row, not the stream.

Two sources of truth, sharply. The enqueue and the Postgres write are not one transaction. You need an outbox table or fully idempotent handlers, and a boot-time reconciler that reads Postgres and rebuilds stream state. `XPENDING` lets you inspect what the broker thinks it has, which is more than RabbitMQ offers, but you are still writing reconciliation code.

Integration code: `spring-boot-starter-data-redis`, a `StreamMessageListenerContainer`, consumer group creation, serializer config, manual `XACK`, plus the `XAUTOCLAIM` loop. Spring Data Redis makes the happy path about four lines, but the full setup with object mapping wants several beans. Realistically 200 to 400 lines plus config, and the claim loop is the part that will have the bugs.

## Option C: RabbitMQ

The strongest durability story of the three, and the worst fit for this workload.

Quorum queues use Raft. Messages confirmed to the publisher "should not be lost as long as at least a majority of RabbitMQ nodes hosting the quorum queue are not permanently made unavailable". Unconfirmed publishes get no guarantee, so publisher confirms are mandatory, not optional.

Free tier: CloudAMQP's Little Lemur is genuinely free, with a 1 million message per month quota, max 100 queues, and a 20 connection limit, on a shared multi-tenant server where vhosts separate tenants. The catch that matters for a hobby app is a **28 day max idle queue time**. A queue nobody touches for a month gets removed.

Then the two defaults that decide this option.

**Delivery acknowledgement timeout defaults to 30 minutes** (`consumer_timeout`, 1,800,000 ms). Exceed it and the channel closes with `PRECONDITION_FAILED`, and every subsequent delivery on that channel, from every consumer on it, is requeued. A job that runs for hours cannot be one unacked delivery. Full stop. Your choices are to ack immediately on receipt and track all progress in Postgres, or to chunk each job into many small messages, one per track or per batch of tracks.

**Quorum queues have a default delivery-limit of 20** based on `delivery-count`, after which the message is dropped or dead-lettered. A job requeued repeatedly across a long 429 backoff can be discarded silently. You would need to raise the limit and wire a dead-letter exchange.

Restart mid-job: unacked deliveries requeue when the channel or connection closes, which is the behaviour you want, but only if you weren't forced into ack-on-receipt by the 30-minute timeout. If you were, RabbitMQ's headline durability advantage is gone and Postgres is doing the recovery.

Pause has the nicest mechanical lever of any option. Spring AMQP's `RabbitListenerEndpointRegistry` lets you fetch a container by id and call `stop()` or `start()`, and `autoStartup=false` lets you decide at boot. But that pauses a consumer, not a job. Per-job pause still lives in a Postgres column.

Indefinite pause is the worst of the four. There is no native "hold this for a week". The options are nack-requeue in a hot loop (burns the 1M message quota fast), message TTL plus dead-letter routing, or the delayed message exchange plugin. Each of them fights the 30-minute ack timeout and the delivery limit at the same time.

Integration code is the lightest of the brokers on the surface. `spring-boot-starter-amqp` plus `@RabbitListener` is maybe 50 to 100 lines for a happy path. The real cost is the configuration around it: quorum queue declaration, DLX, prefetch, manual ack mode, retry and backoff policy, publisher confirms, connection recovery. Call it a day of work you will revisit.

Summary judgment: RabbitMQ is built for many short messages with routing and fan-out. This is a handful of long jobs with no routing. Wrong shape, and the 30-minute ack timeout says so explicitly.

## Option D: Spring `@Scheduled` and `@Async`, no queue

The defaults are worth knowing before dismissing this.

The auto-configured `ThreadPoolTaskExecutor` has 8 core threads, growing to `spring.task.execution.pool.max-size` once the queue fills, shrinking after 60 seconds idle. The auto-configured task **scheduler is a single thread** unless you set `spring.task.scheduling.pool.size`. One hour-long `@Scheduled` method blocks every other scheduled task in the app. That has bitten a lot of people.

On shutdown, `spring.task.execution.shutdown.await-termination=true` and `await-termination-period` make Spring stop accepting new async tasks and wait for running ones, bounded by `spring.lifecycle.timeout-per-shutdown-phase`. Useful for seconds of grace. Useless for a job with two hours left.

Restart mid-job: in-flight work is lost unless progress is in Postgres. It is, per-track, so the loss is bounded to whatever track was in flight. That part is fine.

Pause is a boolean the worker checks between tracks. Identical to option A, because it is option A.

Multi-instance is the failure mode. Two instances both fire the same `@Scheduled` method and both process the same job. ShedLock with the JdbcTemplate provider on Postgres fixes exactly that, and nothing else.

The honest framing: "no queue" here is really "Postgres queue without the claim query". Add crash recovery and multi-instance safety and you have rebuilt option A, badly. It is defensible only if you commit to a single instance forever. On free tiers that is a plausible commitment, but it is a commitment.

## The two-sources-of-truth question, concretely

The ticket calls this the hard constraint, and it holds up under examination.

With a broker, `INSERT INTO jobs` and `publish(jobId)` are not one atomic operation. Whichever order you pick, a crash between them leaves either a job nobody will run or a message pointing at a job that doesn't exist. The standard fixes are a transactional outbox table (in Postgres, polled and published, so you are running option A anyway to drive the broker) or full idempotency plus a boot-time reconciler.

The reconciler is the tell. On startup you must answer "for every job Postgres thinks is queued or running, does a message exist?" RabbitMQ cannot answer that question at all. Redis Streams can partly, via `XPENDING`. In both cases you end up reading Postgres and rebuilding broker state from it. At which point the broker is a cache of Postgres, and you are paying operational cost, a free-tier quota, and a network hop for a cache of a table you already query.

There is one thing a broker genuinely gives you that Postgres polling does not: push delivery, so a job starts in milliseconds instead of on the next poll tick. For a transfer that runs for an hour, that latency is noise.

## Comparison

| | Postgres SKIP LOCKED | Redis Streams | RabbitMQ | `@Async` / `@Scheduled` |
|---|---|---|---|---|
| Extra infrastructure | none | one service | one service | none |
| Free tier | already have it | Upstash 500K cmds/mo, 256 MB; Render free Key Value is in-memory only | CloudAMQP Little Lemur, 1M msg/mo, 28 day idle queue removal | n/a |
| Restart mid-job | lease expires, reaper requeues, resume from track rows | PEL plus `XAUTOCLAIM` after idle timeout; you write the claim loop | unacked requeued on channel close, but 30 min ack timeout usually forces ack-on-receipt | work lost, resume from track rows |
| Pause | `UPDATE status = 'paused'` | no native concept; ack and drop, re-enqueue on resume | no native concept; container `stop()` pauses all consumers | boolean checked between tracks |
| Indefinite review pause | free, a row nobody selects | poor, PEL entry looks like a dead consumer | worst, fights ack timeout and delivery-limit 20 | free |
| Durability | full ACID, same txn as track rows | depends on AOF/RDB; zero on Render free Key Value | strongest (quorum plus publisher confirms) | none of its own |
| Exactly-once | yes, within one transaction | at-least-once, idempotency required | at-least-once, idempotency required | n/a |
| Second source of truth | no | yes, needs outbox or reconciler | yes, and RabbitMQ cannot be queried to reconcile | no |
| Spring code | ~100-200 lines, or db-scheduler / JobRunr | ~200-400 lines plus claim loop | ~50-100 lines plus significant config | ~20 lines, plus ShedLock if multi-instance |
| Multi-instance safe | yes, by construction | yes | yes | no, needs ShedLock |

## Recommendation

**Recommendation: Postgres with `SELECT ... FOR UPDATE SKIP LOCKED`, short claim transaction plus a lease and a reaper. Reach for db-scheduler if you want the leasing and dead-execution detection written for you rather than hand-rolled.**

Reasoning, in order of weight:

1. **Pause is a row update, and pause is the hardest requirement here.** Three of the four pause triggers (user pause, 429 backoff, review queue) are open-ended. Brokers model absence of work as a timer, and every timer in RabbitMQ and Redis Streams reads a week-long review pause as a dead consumer. Postgres reads it as a row with a status. That is not a small convenience, it is the difference between the design working and being fought.

2. **The free-tier compute reality flattens the durability argument.** Since no free tier gives an always-on process, you must build resumable per-track progress and abandoned-job reclaim regardless. Once that exists, RabbitMQ's Raft guarantees are protecting a job ID you can recompute from a table you already have.

3. **The 30-minute `consumer_timeout` disqualifies the naive RabbitMQ design outright.** Any RabbitMQ version of this either acks on receipt (giving up the durability that was the reason to choose it) or shreds jobs into per-track messages (multiplying message count against a 1M/month free quota and putting per-track state in two places at once).

4. **Redis on free tiers is either not durable or not affordable to poll.** Render's free Key Value loses everything on restart. Upstash's 500K commands per month does not survive a one-second poll loop. Both are solvable with money, and neither is solvable with the constraint as written.

5. **Two sources of truth is a real cost, not a purist objection.** Both broker options require an outbox or a boot-time reconciler, and both reconcilers read Postgres to rebuild broker state. That is option A wearing a hat.

Where I would push back on my own recommendation: if this ever grows to many concurrent users with dozens of simultaneous transfers, polling a hot `jobs` table with frequent status `UPDATE`s will generate real vacuum pressure and the poll interval will start to matter. That is a scale problem for a paid tier, and the migration path from a Postgres queue to a broker is straightforward because the job state stays where it is either way. Migrating the other way, unpicking a broker that has become a partial source of truth, is not.

Option D deserves one honest note. For a single instance in the earliest version, `@Scheduled` plus a lock is enough, and it is genuinely less code. But the gap between D and A is one `SKIP LOCKED` query and a `lease_expires_at` column. Paying that up front is cheaper than finding the double-processing bug in production.

## Confidence

**High.** Postgres `SKIP LOCKED` semantics and its documented suitability for queue tables (quoted from the manual). Redis Streams consumer group mechanics, PEL, `XACK`, `XAUTOCLAIM`, and the absence of consumer failure detection. RabbitMQ quorum queue durability wording and the publisher confirm requirement. CloudAMQP Little Lemur limits including the 28 day idle queue removal. Render free tier behaviour: 15 minute spin-down, no background workers on free, free Postgres expiring after 30 days, free Key Value being in-memory only. Upstash free limits. Neon and Supabase free limits and their sleep and pause behaviour. Fly.io's 7 October 2024 plan deprecation. Spring Boot task executor and scheduler defaults (8 core threads, single scheduler thread). db-scheduler, JobRunr, and ShedLock licensing and scope.

**Medium.** The 30 minute `consumer_timeout` default and the quorum queue delivery-limit of 20 come from RabbitMQ's own docs, but the exact defaults have changed across versions and the page notes the 30 minute figure applies to quorum queues in RabbitMQ 4.3 and later. Verify against whatever version CloudAMQP's shared plan runs before relying on it. Koyeb's free tier restrictions (no Worker Services, one hour scale-to-zero) come from secondary sources; Koyeb's own pricing page did not confirm them and their docs pricing URL returns 404. Railway's $1/month free credit is from their pricing page, but the free-tier-versus-trial distinction there is easy to misread.

**Unverified.** Whether Upstash imposes a maximum duration on blocking commands such as `BLPOP` and `XREADGROUP BLOCK` over its TCP endpoint, and how blocking interacts with their REST-first model. This decides whether Redis on Upstash free is viable at all, and I could not find first-party documentation either way. Whether Redis persistence (AOF or RDB) is enabled on Upstash's free plan specifically; their pricing page lists persistence as a feature without breaking it down by tier. Whether the owner is willing to run an external pinger or pay for an always-on worker, which changes the free-tier analysis considerably.

## Sources

- PostgreSQL 18, SELECT, locking clauses: https://www.postgresql.org/docs/current/sql-select.html
- Redis Streams and consumer groups: https://redis.io/docs/latest/develop/data-types/streams/
- RabbitMQ quorum queues: https://www.rabbitmq.com/docs/quorum-queues
- RabbitMQ consumers, acknowledgements, `consumer_timeout`: https://www.rabbitmq.com/docs/consumers
- Spring AMQP, programmatic endpoint registration and `RabbitListenerEndpointRegistry`: https://docs.spring.io/spring-amqp/reference/amqp/receiving-messages/async-annotation-driven/registration.html
- Spring AMQP, listener concurrency: https://docs.spring.io/spring-amqp/reference/amqp/listener-concurrency.html
- Spring Data Redis, Streams support: https://docs.spring.io/spring-data/redis/reference/redis/redis-streams.html
- Spring Boot, task execution and scheduling: https://docs.spring.io/spring-boot/reference/features/task-execution-and-scheduling.html
- Spring Boot, graceful shutdown: https://docs.spring.io/spring-boot/reference/web/graceful-shutdown.html
- db-scheduler: https://github.com/kagkarlsson/db-scheduler
- JobRunr documentation: https://www.jobrunr.io/en/documentation/
- ShedLock: https://github.com/lukas-krecan/ShedLock
- CloudAMQP plans (Little Lemur): https://www.cloudamqp.com/plans.html
- Upstash pricing: https://upstash.com/pricing
- Render free tier: https://render.com/docs/free
- Neon pricing: https://neon.com/pricing
- Supabase pricing: https://supabase.com/pricing
- Fly.io discontinued plans: https://fly.io/docs/about/discontinued-plans/
- Koyeb pricing (did not confirm free instance worker or sleep limits): https://www.koyeb.com/pricing
- Railway pricing: https://railway.com/pricing
