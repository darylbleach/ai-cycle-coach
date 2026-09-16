# Open-source perks

This repository is public and MIT-licensed so it can be checked against vendor
programs on [OSS Perks](https://www.ossperks.com/).

OSS Perks does not grant credits itself. It tells you which programs the repo
currently qualifies for. You still apply on each vendor's form.

## Check eligibility

1. Open https://www.ossperks.com/check
2. Paste `https://github.com/darylbleach/ai-cycle-coach`
3. Or from this repo:

   ```bash
   npx ossperks check --repo darylbleach/ai-cycle-coach
   ```

GitHub license detection can take a few minutes after the `LICENSE` file lands
on the default branch (`development`).

## What OSS Perks looks for

Most programs require:

- A **public** GitHub repository (this repo is already public)
- An **OSI-approved license** at the repository root (`LICENSE`, MIT)
- Active maintenance
- A **Code of Conduct** for programs such as Vercel and DigitalOcean

Some programs also require stars, non-commercial use, or a specific tech
dependency. Those cannot be satisfied by files alone.

## Programs this stack is a good fit for

Apply after GitHub shows the MIT license on
https://github.com/darylbleach/ai-cycle-coach

| Program | Why it fits | Apply |
| --- | --- | --- |
| [Vercel for Open Source](https://vercel.com/open-source-program) | App already has `vercel.json` and is a Next.js project | Seasonal application |
| [Netlify Open Source Plan](https://opensource-form.netlify.com/) | Hosting alternative; homepage and README include “This site is powered by Netlify” | Form |
| [Sentry for Open Source](https://sentry.io/for/open-source/) | Error monitoring for a public MIT project | Sentry OSS page |
| [Neon Open Source Program](https://neon.com/programs/open-source) | App uses PostgreSQL via Prisma | Neon program page |
| [PostHog for Open Source](https://posthog.com/startups) | Analytics/replay credits for small OSS projects | Sign up, then apply |
| [Codecov](https://about.codecov.io/for/open-source/) | Public repos are free | Sign in with GitHub |
| [Snyk for Open Source](https://snyk.io/open-source/) | Dependency scanning; non-commercial projects | Snyk OSS page |
| [GitBook Community](https://docs.gitbook.com/account-management/plans/apply-for-the-non-profit-open-source-plan) | Docs hosting | GitBook form |
| [Mintlify OSS](https://mintlify.typeform.com/oss-program) | Docs; non-commercial, not company-owned | Typeform |
| [JetBrains OSS](https://www.jetbrains.com/shop/eform/opensource) | IDE licenses for core maintainers | Form |
| [OpenAI Codex for OSS](https://openai.com/form/codex-for-oss/) | Maintainer access; rolling review | Form |
| [DigitalOcean OSS credits](mailto:opensource@digitalocean.com) | Hosting credits; logo on the site; 100+ stars for paid tiers | Email |
| [BrowserStack for Open Source](https://www.browserstack.com/open-source) | Cross-browser testing; README must include the exact sentence `This project is tested with BrowserStack.` | Re-apply after that line is on the default branch |

## Programs that need more traction first

These usually stay ineligible until the project has community usage:

- GitHub Copilot Pro for maintainers (popularity thresholds)
- Claude for Open Source (typically 5,000+ stars or 1M npm downloads)
- Cossistant (100+ stars)
- DigitalOcean paid credit tiers (100+ / 500+ / 10,000+ stars)

## After merging this setup

1. Confirm GitHub shows **MIT license** on the repo overview
2. Add a short GitHub description and topics (`nextjs`, `cycling`, `garmin`, `prisma`, `openai`, `typescript`)
3. Rotate `CRON_API_KEY` in Vercel/DigitalOcean because a previous value was committed
4. Re-run `npx ossperks check --repo darylbleach/ai-cycle-coach`
5. Apply to the programs marked eligible or needs-review
