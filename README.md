# AI Cycling Coach

An AI-powered cycling coach application that creates personalized training plans based on your fitness data from Garmin Connect.

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

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/ai-coach.git
   cd ai-coach
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory with the following variables:
   ```
   DATABASE_URL="postgresql://username:password@localhost:5432/ai_coach?schema=public"
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-secret-key"
   OPENAI_API_KEY="your-openai-api-key"
   ```

4. Set up the database:
   ```
   npx prisma migrate dev --name init
   ```

5. Start the development server:
   ```
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

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

## License

This project is licensed under the MIT License - see the LICENSE file for details. 