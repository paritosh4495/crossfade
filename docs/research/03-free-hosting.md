# Free hosting that survives hour-long jobs

Research for [issue #4](https://github.com/paritosh4495/crossfade/issues/4).
Date checked: **2026-08-25**. Pricing and free-tier terms move fast, so re-verify before committing to anything here.

## Verdict

**No. Free managed PaaS cannot run Crossfade's hour-long background jobs.** Not "it's awkward". The free tiers of Render, Railway, Fly.io and Koyeb each fail at least one hard requirement outright, usually several.

Three failure modes, worst first.

**Background workers are not free anywhere.** Render restricts free deployment to static sites, web services, Postgres and Key Value. Workers and cron are paid-only. Koyeb's free allowance is one *web* service. A web service is request-driven, so a job that outlives its HTTP request is running on borrowed time.

**Idle spin-down kills the process.** Render free web services spin down after 15 minutes without inbound traffic. Koyeb free instances scale to zero after an hour without traffic. A transfer job is CPU-busy but receives no inbound requests, so it looks idle by the only metric these platforms measure. Render's own docs say local filesystem changes are lost on spin-down, which means the process is terminated, not paused.

**512 MB memory ceilings.** Render free is 0.1 CPU / 512 MB. Koyeb free is 0.1 vCPU / 512 MB. A JVM alone wants more than that, before the Python sidecar exists.

Exactly one free option clears all three bars: Oracle Cloud Always Free Ampere A1, which is a real VM you control. It has its own problems, covered below.

The second honest finding is simpler. Every free tier is also a spin-down tier, except a VM. If you want a process that runs for two hours untouched, you want a machine, not a platform.

## Requirement baseline

Crossfade needs all of this running at once, continuously:

| Process | Realistic RSS |
| --- | --- |
| Spring Boot JVM | 400 to 700 MB, tunable to about 300 MB with a constrained heap, at a throughput cost |
| Python sidecar | 100 to 150 MB |
| Postgres, only if self-hosted | 150 to 250 MB at default `shared_buffers` |

512 MB is not survivable. 1 GB is tight and forces an external managed Postgres. 2 GB is comfortable. 4 GB is roomy enough to self-host Postgres alongside.

## Comparison table

| Provider | Free compute | Sleeps? | What happens to a running job | Background workers free? | RAM ceiling (free) | Free Postgres | Card required |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Oracle Always Free | 1,500 OCPU-h + 9,000 GB-h/mo Arm A1; 2x AMD micro at 1 GB each | No | Nothing, it's a VM you own | Yes, it's a VM | ~12 GB if run continuously | Self-host, or 2x Autonomous DB at 20 GB | Yes, with verification hold |
| Render | 750 instance-h/mo web service | Yes, 15 min idle | Killed, filesystem changes lost | **No**, paid only, from $7/mo | 512 MB | 1 GB, **expires 30 days after creation** | Not to start |
| Railway | $1/mo credit, plus one-time $5 that expires in 30 days | Credit runs out instead | Service suspends at zero balance | Yes in principle, but $1/mo buys almost nothing | 1 GB on Trial | Deployable, but bills against the same credit | Post-paid card to continue |
| Fly.io | **None.** 2 h machine runtime / 7 days trial | Trial machines auto-stop after 5 min | Stopped | N/A | 4 GB, trial only | None free | Yes, after trial |
| Koyeb | 1 web service, 0.1 vCPU / 512 MB / 2 GB SSD | Yes, scale-to-zero at 1 h no traffic | Killed | **No**, one *web* service only | 512 MB | 5 free hours/month only | Yes, $29 pre-auth hold |
| Neon | 0.5 GB storage, 100 CU-h/mo per project | Autosuspend at 5 min, **cannot be disabled on Free** | DB connection drops, resumes on next connect | N/A, DB only | n/a | That is the product | Not to start |
| Supabase | 500 MB DB, 500 MB RAM, 5 GB egress, 2 active projects | **Project paused after 1 week of inactivity** | Manual restore from dashboard | N/A, DB only | n/a | That is the product | Not to start |
| Google Cloud Always Free | 1x e2-micro at 1 GB, **US regions only** | No | Nothing, it's a VM | Yes | 1 GB | None free | Yes, for trial |
| Cloudflare Pages | 500 builds/mo, unmetered requests | N/A | N/A, static | N/A | n/a | n/a | No |

### Paid floor for comparison

| Option | Spec | Price | India presence |
| --- | --- | --- | --- |
| Hetzner CX23 | shared x86, specs unverified | €5.49/mo ex-VAT | No. DE, FI, US, SG |
| Hetzner CAX11 | 2 vCPU Arm, 4 GB, 40 GB NVMe, 20 TB traffic | €5.99/mo ex-VAT | No, CAX is EU-only |
| Contabo Cloud VPS 4 | 4 vCPU, 8 GB, 100 GB SSD, unlimited traffic | $6.60/mo at the 24-month rate | **Yes** |
| DigitalOcean Basic | 1 vCPU, 2 GB, 50 GB SSD, 2 TB transfer | $12.00/mo | Bangalore (BLR1), not verified on the page I fetched |
| DigitalOcean Basic | 1 vCPU, 1 GB, 25 GB SSD | $6.00/mo | as above |

Both Hetzner prices are post-adjustment. Hetzner raised cloud prices effective 15 June 2026, 08:00 CEST, taking CAX11 from €4.49 to €5.99 and CX23 from €3.99 to €5.49. Existing servers may keep legacy pricing until reconfigured.

So the paid floor is roughly $6 to $7 a month for a machine with no spin-down, no worker restrictions, and enough RAM for the whole stack under Docker Compose. Judge every free option against that number, because the time spent fighting a free tier is worth more than $7 a month.

## Per-provider detail

### Oracle Cloud Always Free, the only free option that actually works

Oracle's docs state: *"All tenancies get the first 1,500 OCPU hours and 9,000 GB hours per month for free for VM instances using the VM.Standard.A1.Flex shape."* Over a 730-hour month that is about 2 OCPUs and about 12 GB RAM running continuously, split as one 2-OCPU / 12 GB instance or two 1-OCPU instances. Note this is *less* than the 4 OCPU / 24 GB figure most blog posts and older guides still quote. The current documentation says 1,500 and 9,000. Also included: two AMD `E2.1.Micro` instances at 1/8 OCPU and 1 GB each, 200 GB total block storage, one flexible load balancer at 10 Mbps, and 2 VCNs.

Even at the lower numbers this is the most generous free compute anywhere, and 12 GB is far more than Crossfade needs.

It never sleeps. It is a VM. A two-hour job runs for two hours.

Background workers are not a concept here, because you run whatever processes you want. Spring Boot, the Python sidecar and Postgres all live in one Docker Compose stack.

For Postgres, self-host it in that same stack, since 200 GB of block storage is ample. The two Always Free Autonomous Databases (1 OCPU, 20 GB, 20 concurrent sessions) are Oracle DB, not Postgres, so they are not a drop-in.

**Reclamation.** Oracle's docs are explicit: *"Idle Always Free compute instances may be reclaimed by Oracle."* Idle means that over a 7-day period, all of these hold at once: CPU 95th-percentile below 20%, network utilisation below 20%, and for A1 shapes only, memory utilisation below 20%.

This is survivable but real. A Crossfade instance serving a couple of users a week looks idle by all three measures most of the time. The fix is to run the JVM with a large committed heap (`-Xms`) so memory utilisation stays above 20% permanently. The memory criterion alone blocks reclamation on A1 shapes, and it is the honest lever rather than a fake-traffic cron. Either way, treat the instance as disposable. Script the whole build, back the database up off-box, and be able to rebuild in an hour.

**Signup.** Oracle requires a credit or debit card carrying a major card logo and not requiring a PIN, with a temporary verification hold. This is where Indian cards are widely reported to fail, and where Oracle's automated fraud checks reject accounts with no appeal path. I could not verify signup failure rates from any primary source. It is community reputation, not documented policy, but it is well-attested enough to plan around. The same goes for "out of host capacity" errors on A1 shapes in popular regions: real, widely reported, undocumented by Oracle, and worth budgeting a few days of retries for.

**Home region is permanent.** Oracle's docs: *"Your home region is the geographic location where your account and identity resources will be created. You can't change this after signing up."* Always Free block volume capacity is home-region-only. For an India-based owner and Indian users the choices are Mumbai (`ap-mumbai-1`) or Hyderabad (`ap-hyderabad-1`), both single-AD. Mumbai is the more contested region for A1 capacity. Hyderabad is often easier to get instances in and costs only a few ms.

When the 30-day trial ends, paid-service access disappears and Always Free resources continue indefinitely at the stated limits. Object storage above 20 GB is deleted at trial end.

### Render, disqualified by design

Free deployment covers static sites, web services, Postgres and Key Value only. Background workers and cron jobs need a paid instance, starting at $7/mo for Starter at 0.5 CPU / 512 MB. Free web services get 0.1 CPU / 512 MB and 750 instance-hours per workspace per month, and spin down after 15 minutes of inactivity, taking about a minute to wake and losing local filesystem changes.

Free Postgres is 1 GB of storage at 0.1 CPU / 256 MB, one per workspace, and it expires 30 days after creation, with a 14-day grace period to upgrade before deletion. That alone rules it out for anything you intend to keep.

Render is a reasonable paid target: about $7 for the web service, $7 for the worker, plus Postgres. That lands near $15 to $20 a month, more than double the VPS floor, for less RAM.

### Railway, no meaningful free tier

The Free plan is $1 of credit per month. New accounts get a one-time $5 grant that expires after 30 days. Trial services cap at 1 GB RAM, shared vCPU, and 5 services per project. When credit runs out the plan reverts to $1/mo and services suspend at zero balance. Stateful volumes created by Trial accounts are deleted 30 days after credits expire.

A dollar a month does not run a JVM continuously. Nowhere close. The Hobby plan at $5/mo including $5 of usage is a real product with a generous per-service ceiling (48 GB, 48 vCPU), but by then you are paying, and $5 of metered usage will not cover a 24/7 JVM plus sidecar plus Postgres either.

### Fly.io, no free tier at all any more

The trial is 2 hours of machine runtime or 7 days, whichever comes first, and trial machines auto-stop after 5 minutes of running. Up to 10 machines at 2 vCPU / 4 GB each, 20 GB of volumes. No card needed to start. When the trial ends without a card, apps stop and you cannot deploy.

After that it is pay-as-you-go. A shared-CPU-1x / 256 MB machine is about $2.02/mo in Amsterdam, a performance-1x / 2 GB about $32.19/mo, with 40% off for reserved compute blocks. Stopped machines still bill $0.15 per GB per 30 days for storage. Every organisation needs a card on file.

Fly is interesting as a cheap paid option, since a 1 GB shared machine costs a few dollars a month and Fly does not force spin-down unless you configure auto-stop. But it is not free, and Fly's Postgres story has churned repeatedly.

### Koyeb, one 512 MB web service

Each organisation gets one free web service at 0.1 vCPU, 512 MB RAM and 2 GB SSD, in Frankfurt or Washington DC only. It scales to zero after an hour without traffic. Free Postgres is 0.25 vCPU / 1 GB RAM / 1 GB storage, but only 5 free hours a month, which is a demo rather than a database.

A card is mandatory even for free. Koyeb *"verif[ies] the card you enter by placing a $29 pre-authorization hold and immediately canceling it,"* and account validation can take up to 3 business days.

512 MB, one service, no India region, scale-to-zero. Disqualified.

One caveat: reports circulate that after Koyeb's acquisition the free Starter tier closed to new signups and the roadmap shifted to AI inference. I could not confirm that from Koyeb's own documentation, which still describes the free instance as available. Treat the free tier's survival as uncertain.

### Neon, good free Postgres with a caveat that does not hurt you

The Free plan gives 0.5 GB of storage per project, 100 CU-hours per month per project (roughly 400 hours at 0.25 CU), 100 projects, and 10 branches per project. Computes autosuspend after 5 minutes of inactivity, and you cannot disable that on Free. Exhaust the CU-hours and the compute suspends until the next billing period.

Autosuspend sounds alarming but it is the good kind. Resume is fast and transparent to a connection pool that retries, nothing like Supabase's week-long pause. The real constraints are the 0.5 GB storage cap and the CU-hour budget. A job hammering the DB for two hours burns compute hours quickly, and 400 hours a month is not unlimited.

No India region. The closest is AWS Asia Pacific (Singapore), `aws-ap-southeast-1`, roughly 30 to 60 ms from India. Fine for a job-oriented app if you batch writes.

### Supabase, the pause is the problem

The Free plan gives a 500 MB database on shared CPU with 500 MB RAM, 5 GB egress, 2 active projects, and 500k edge function invocations. Projects pause after 1 week of inactivity and need a manual restore from the dashboard. Backups are not downloadable on Free.

That week-long pause is materially worse than Neon's five-minute autosuspend, because recovery is manual. For a low-traffic hobby app it is a coin-flip whether the database is up when someone visits. In exchange, Supabase has Mumbai (`ap-south-1`), which Neon does not, giving it the best latency of any free managed Postgres for Indian users. If you can guarantee weekly activity, which needs a non-sleeping host anyway, Supabase Free works and the auth product is a bonus.

### Others worth knowing

Google Cloud Always Free gives one non-preemptible `e2-micro` at 1 GB RAM plus 30 GB of standard persistent disk, but only in `us-west1`, `us-central1` or `us-east1`. No India region on the free tier, and 1 GB is too small for JVM plus Python plus Postgres. Free outbound transfer is only 1 GB a month from North America. The 90-day, $300 trial requires a card. Cloud Run's free tier (2M requests, 360k GB-seconds, 180k vCPU-seconds per month) is request-billed and scales to zero, which is the wrong shape for hour-long jobs.

Cloudflare Pages handles the React/Vite build: 500 builds a month, 1 concurrent build, a 20-minute build timeout, 20,000 files, 25 MiB per asset, 100 projects, 100 custom domains, and no documented bandwidth or request cap. This part of the stack is free forever on a global CDN with Indian PoPs. Netlify and Vercel are comparable. Cloudflare meters least aggressively.

## Design implications regardless of host

These follow from the job-duration requirement and are worth building in now.

**Make jobs resumable from the database, not from process memory.** Persist per-track progress so a killed job restarts at track 340 of 500, not at zero. This turns "the host killed my process" from data loss into a delay, and it is the single change that makes cheap hosting tolerable.

**Do not rely on in-process schedulers surviving restarts.** Claim work with a `SELECT ... FOR UPDATE SKIP LOCKED` queue table and a lease plus heartbeat, so an orphaned job gets reclaimed when its lease expires.

**Externalise the OAuth token store.** Nothing on a container filesystem survives.

**Cap concurrency at one or two transfers per instance** on any 1 to 2 GB box. Spotify and YouTube Music both rate-limit, so the job spends its time waiting on IO, not CPU.

## Recommendations

### Recommended setup

Oracle Cloud Always Free A1 in Mumbai or Hyderabad, running the whole stack in Docker Compose, with the frontend on Cloudflare Pages.

- One `VM.Standard.A1.Flex` at 2 OCPU / 12 GB, inside the 1,500 OCPU-h and 9,000 GB-h allowance.
- Spring Boot, the Python sidecar, Postgres and Caddy for TLS, as one Compose stack. No spin-down, no worker restrictions, no memory anxiety, and Postgres on local NVMe with zero network latency.
- Frontend static build on Cloudflare Pages, free and CDN-fronted.
- Total cost ₹0 a month, with in-country latency for Indian users.
- Block reclamation by running the JVM with a large `-Xms` so A1 memory utilisation stays above 20%. Take nightly `pg_dump` backups to OCI Object Storage, which gives 20 GB free, and to somewhere off Oracle as well.
- Treat the box as cattle. Keep the `docker-compose.yml` and a provisioning script in the repo so a rebuild takes an hour, not a weekend.

Do this only if you can actually get an account and an A1 instance. Time-box it. If signup or capacity fights you for more than a few days, fall back rather than sinking a week into it.

### Recommended fallback

A $6 to $7 a month VPS running the identical Docker Compose stack.

The stack is deliberately identical, so this is `docker compose up` on a different box, not a re-architecture. That portability is the point, and it is what makes betting on Oracle low-risk.

- Contabo Cloud VPS 4 at $6.60/mo, 4 vCPU / 8 GB / 100 GB, if the India region matters most. Best specs per rupee here by a wide margin, with the caveats Contabo is known for: variable performance and slow support.
- Hetzner CAX11 at €5.99/mo, 2 vCPU Arm / 4 GB / 40 GB NVMe / 20 TB traffic, if reliability matters most. EU-only for the Arm line, so 120 to 150 ms to Indian users, which is fine for a job-based app where nobody waits on a keystroke.
- DigitalOcean 2 GB Basic at $12/mo in Bangalore, if you want a polished console plus India latency and will pay double for it.

Not recommended: stitching together a Render free web service, Neon free Postgres and Cloudflare Pages. It looks free and will demo fine, but the 15-minute spin-down kills transfers mid-flight, background workers are not free anyway, and the free Render Postgres deletes itself after 30 days. You would spend more time working around it than the $7 a month it saves.

## Sources

All checked 2026-08-25.

- [Oracle, Always Free Resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm), for limits, the A1 allowance, idle reclamation and trial expiry
- [Oracle, Sign Up for the Free Oracle Cloud Promotion](https://docs.oracle.com/en-us/iaas/Content/GSG/Tasks/signingup_topic-Sign_Up_for_Free_Oracle_Cloud_Promotion.htm), for the card requirement, verification hold and permanent home region
- [Oracle, Regions and Availability Domains](https://docs.oracle.com/en-us/iaas/Content/General/Concepts/regions.htm), for `ap-mumbai-1` and `ap-hyderabad-1`
- [Render, Deploy for Free](https://render.com/docs/free), for spin-down, 750 hours, free service types and the Postgres 30-day expiry
- [Render, Instance Types](https://render.com/docs/compute-plans), for Free at 0.1 CPU / 512 MB and workers starting at Starter
- [Render, Background Workers](https://render.com/docs/background-workers)
- [Railway, Pricing Plans](https://docs.railway.com/reference/pricing/plans), for Trial at 1 GB / 2 vCPU and Hobby at $5
- [Railway, Free Trial](https://docs.railway.com/reference/pricing/free-trial), for the $5 one-time grant, the $1/mo Free plan and volume deletion
- [Fly.io, Free Trial](https://fly.io/docs/about/free-trial/), for 2 machine-hours, 7 days and the 5-minute auto-stop
- [Fly.io, Pricing](https://fly.io/docs/about/pricing/), for machine prices, the card requirement and reserved blocks
- [Koyeb, Instances reference](https://www.koyeb.com/docs/reference/instances), for free instance specs and scale-to-zero at 1 hour
- [Koyeb, Pricing FAQ](https://www.koyeb.com/docs/faqs/pricing), for the $29 pre-auth hold, validation delay and free service regions
- [Koyeb, Pricing](https://www.koyeb.com/pricing), for free Postgres at 5 hours a month
- [Neon, Plans](https://neon.com/docs/introduction/plans), for 0.5 GB, 100 CU-hours and autosuspend that cannot be disabled
- [Neon, Regions](https://neon.com/docs/introduction/regions), for no India and Singapore as `aws-ap-southeast-1`
- [Supabase, Pricing](https://supabase.com/pricing), for the 500 MB DB, 500 MB RAM, 2 active projects and 1-week pause
- [Supabase, Going into Production](https://supabase.com/docs/guides/platform/going-into-prod), for the inactivity pause, manual restore and lack of downloadable backups on Free
- [Supabase, Regions](https://supabase.com/docs/guides/platform/regions), for Mumbai `ap-south-1`
- [Google Cloud, Free cloud features](https://docs.cloud.google.com/free/docs/free-cloud-features), for e2-micro US-only, the Cloud Run free tier and the 90-day $300 trial
- [Cloudflare, Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Hetzner, Price adjustment 15 June 2026](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/), for CAX11 at €5.99 and CX23 at €5.49
- [Hetzner, Cloud](https://www.hetzner.com/cloud/), for locations: DE, FI, US, SG
- [Contabo, VPS](https://contabo.com/en/vps/), for Cloud VPS 4 at $6.60/mo and the India region
- [DigitalOcean, Droplet pricing](https://www.digitalocean.com/pricing/droplets), for the $4, $6 and $12 Basic tiers

### Could not verify from a primary source

- Oracle signup rejection rates for Indian cards, and "out of host capacity" for A1 shapes in Mumbai. Both are heavily reported by users. Neither is documented by Oracle. Plan for them, but treat the severity as anecdotal.
- Whether Koyeb's free tier is still open to new signups after the acquisition. Search results say the Starter tier closed to new users. Koyeb's own docs still describe the free instance. Unresolved.
- Hetzner CX23 specs, meaning vCPU, RAM and disk. The price is documented. The spec table did not render on any Hetzner page I fetched.
- DigitalOcean Bangalore (BLR1) availability, and whether pricing is region-flat. Asserted by secondary sources. The pricing page I fetched did not list regions.
- Render's exact dollar prices. The pricing page did not render, so the $7/mo Starter figure comes from Render-hosted secondary pages rather than the pricing table itself.
- Whether Railway's Free plan requires a card. The docs are silent.
