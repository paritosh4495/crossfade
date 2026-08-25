# Free hosting that survives hour-long jobs

Type: research
Status: open
Parent: ../map.md

## Question

The owner wants to deploy on free tiers wherever possible. Find out whether that is actually compatible with this app.

The app needs, at minimum: a Spring Boot process, a Python sidecar process, a Postgres database, and static frontend hosting. Jobs run for minutes to hours and must not be killed mid-flight.

Investigate current free and near-free options and report what each actually allows:

- Does the platform sleep or spin down idle services? What happens to a running background job when it does?
- Are background workers available on the free tier, or only request-serving web services?
- Memory ceilings, and whether a JVM plus a Python process fit inside them.
- Free Postgres options, storage caps, and whether the database is paused after inactivity.
- Container count limits.

Cover at least Oracle Cloud Always Free, Render, Railway, Fly.io, Koyeb, Neon, and Supabase. Include the cheapest genuinely unrestricted option as a baseline, roughly a small VPS running Docker Compose, so the decision has a paid floor to compare against.

Be blunt if free hosting cannot support hour-long background jobs. That is a real possible finding.
