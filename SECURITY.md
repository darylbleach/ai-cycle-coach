# Security Policy

## Supported versions

Please report security issues against the latest `development` branch.

## Reporting a vulnerability

Do not open a public GitHub issue for security reports.

Use GitHub's private vulnerability reporting on this repository:

https://github.com/darylbleach/ai-cycle-coach/security/advisories/new

If private reporting is unavailable, email the maintainer at
darylbleach@me.com with:

- A description of the issue
- Steps to reproduce
- Impact if exploited
- Any suggested fix

Please do not include real user data, Garmin tokens, or production secrets in
the report.

## Secrets and local data

This project stores Garmin Connect tokens on disk and uses environment
variables for database, OAuth, cron, and OpenAI credentials.

- Copy `.env.example` rather than committing a real `.env` file
- Never commit files under `garmin-tokens/`
- Rotate any credential that may have been committed historically, including
  `CRON_API_KEY`, `NEXTAUTH_SECRET`, database URLs, and OAuth client secrets

## Production notes

Cron endpoints (`/api/cron/daily-sync` and related Garmin sync routes) require
`CRON_API_KEY` to be set. Requests without a matching `X-Cron-API-Key` header
are rejected.
