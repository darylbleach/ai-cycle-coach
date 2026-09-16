# Contributing to AI Cycle Coach

Thanks for helping make this project better. This app is an open-source,
Garmin-aware cycling coach built with Next.js, Prisma, and OpenAI.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to contribute

- Report bugs and propose features through GitHub Issues
- Improve documentation, setup instructions, or examples
- Fix bugs and submit pull requests
- Help review open pull requests

## Local development

### Prerequisites

- Node.js 18+ and npm
- Python 3.8+ (for Garmin Connect sync)
- PostgreSQL

### Setup

1. Fork the repository and clone your fork:

   ```bash
   git clone https://github.com/<your-username>/ai-cycle-coach.git
   cd ai-cycle-coach
   ```

2. Install JavaScript dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and fill in local values. Never commit real
   secrets. Generate strong values for `NEXTAUTH_SECRET`, `CRON_API_KEY`, and
   `INTERNAL_API_KEY`.

4. Set up the database:

   ```bash
   npx prisma migrate dev
   ```

5. Optional Garmin sync environment:

   ```bash
   python3 -m venv garmin-env
   source garmin-env/bin/activate
   pip install -r requirements.txt
   mkdir -p garmin-tokens
   ```

6. Start the app:

   ```bash
   npm run dev
   ```

The app runs at [http://localhost:3000](http://localhost:3000).

## Pull requests

1. Create a branch from `development`.
2. Keep changes focused and describe the problem they solve.
3. Do not commit `.env` files, Garmin token files, or API keys.
4. Update docs when you change setup, environment variables, or behavior.
5. Open a pull request against `development` and fill in the template.

## Security

Do not report vulnerabilities in public issues. See [SECURITY.md](SECURITY.md).
