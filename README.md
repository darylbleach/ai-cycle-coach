# AI Cycle Coach

[![License: MIT](https://img.shields.io/github/license/darylbleach/ai-cycle-coach)](LICENSE)
[![OSS Perks](https://img.shields.io/badge/OSS%20Perks-check%20eligibility-0ea5e9)](https://www.ossperks.com/check)

An open-source, AI-powered cycling coach that creates personalized training
plans from Garmin Connect fitness and recovery data.

This project is tested with BrowserStack.

This site is powered by Netlify.

**Repository:** [github.com/darylbleach/ai-cycle-coach](https://github.com/darylbleach/ai-cycle-coach)

## Features

- **User Authentication**: Create an account, log in, and manage your profile
- **Garmin Connect Integration**: Connect your Garmin account to sync health and fitness data
- **Daily Health Metrics**: View your sleep score, body battery, HRV status, stress level, and resting heart rate
- **Training Plans**: Create personalized training plans for power (FTP improvement) or fitness (endurance)
- **Adaptive Workouts**: AI-generated workouts that adapt based on your recovery metrics
- **Training Calendar**: View your upcoming workouts in a calendar view
- **Detailed Workout Breakdowns**: Get detailed instructions for each workout segment
- **Automatic Daily Sync**: Garmin data is automatically synced at 7am daily and workouts are adjusted accordingly

## Tech Stack

- **Frontend**: Next.js, React, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **AI**: OpenAI API for generating training plans

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- Python 3.8+ if you want Garmin Connect sync

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/darylbleach/ai-cycle-coach.git
   cd ai-cycle-coach
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and set the variables. Generate your own
   secrets; do not reuse example values.

   ```bash
   DATABASE_URL="postgresql://username:password@localhost:5432/ai_coach?schema=public"
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-secret-key"
   CRON_API_KEY="your-secure-cron-api-key"
   OPENAI_API_KEY="your-openai-api-key"
   ```

4. Set up the database:

   ```bash
   npx prisma migrate dev --name init
   ```

5. Start the development server:

   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

See [CONTRIBUTING.md](CONTRIBUTING.md) for a fuller local setup, including the
optional Garmin Python environment.

## Usage

1. Create an account or log in
2. Set your FTP (Functional Threshold Power) in the settings
3. Connect your Garmin account to sync your health data
4. Create a training plan based on your goals (Power or Fitness)
5. Follow your daily workouts and track your progress

## Automatic Training Adjustment

The app features an automatic daily adaptation system that works as follows:

1. **Daily Data Sync**: At 7am each day, the system automatically syncs with Garmin to retrieve your latest health metrics.
2. **Training Readiness Calculation**: A training readiness score (0-100) is calculated based on your sleep quality, body battery, stress levels, resting heart rate, and HRV.
3. **Workout Adjustment**: Today's workouts are automatically adjusted based on your training readiness:
   - **Excellent Recovery (80-100)**: Workout intensity may be slightly increased (+5%)
   - **Good Recovery (60-79)**: Workout maintained at planned intensity
   - **Moderate Recovery (40-59)**: Workout intensity reduced (-15%)
   - **Poor Recovery (<40)**: Workout intensity significantly reduced (-35%), with recommendations to consider rest

This ensures that your training is optimally balanced between challenge and recovery, adapting to your body's daily state to maximize training effectiveness while preventing overtraining.

## Open source perks

This project is public and MIT-licensed so it can qualify for maintainer
programs listed on [OSS Perks](https://www.ossperks.com/).

Check current eligibility:

```bash
npx ossperks check --repo darylbleach/ai-cycle-coach
```

Or paste the repo URL into https://www.ossperks.com/check

Application links, program notes, and post-merge steps are in
[docs/OSS_PERKS.md](docs/OSS_PERKS.md).

## Testing

This project is tested with BrowserStack.

Cross-browser checks cover the Next.js UI (auth, dashboard, training calendar,
and settings) on desktop and mobile browsers.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and
the [Code of Conduct](CODE_OF_CONDUCT.md) before opening a pull request.

## Security

Please report vulnerabilities privately. See [SECURITY.md](SECURITY.md).

## License

This project is licensed under the [MIT License](LICENSE).
