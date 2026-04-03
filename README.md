# FriendBet Vite Version

A betting app built with Vite and Supabase.

## Setup Instructions

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and anon key from Settings > API

### 2. Configure Database

1. Open the Supabase SQL Editor
2. Copy and paste the contents of `supabase-schema.sql`
3. Run the SQL to create all tables and policies

### 3. Enable Email Authentication

1. Go to Authentication > Providers
2. Make sure Email is enabled
3. Optionally configure SMTP for production (Supabase provides a default for development)

### 4. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 5. Install and Run

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:5173`

### 6. Build for Production

```bash
npm run build
```

Output will be in the `dist/` folder.

## Deployment to GitHub Pages

1. Build the project: `npm run build`
2. Upload the contents of `dist/` to your GitHub Pages repository
3. Make sure your Supabase project allows requests from your GitHub Pages domain in Authentication > URL Configuration

## Database Testing

### Running SQL Schema Tests

1. Open your Supabase project dashboard
2. Go to SQL Editor
3. Copy and paste the contents of `tests/database-tests.sql`
4. Click "Run" to execute tests

The tests will verify:
- Profile auto-creation on signup
- Bet creation (draft and published)
- Point deduction on bet creation
- Insufficient points rejection
- Wager placement
- Wager on own bet rejection
- Bet resolution and payout calculation
- Daily bonus system
- RLS policy enforcement
- Friend request flow

Each test will output "TEST X PASSED" or "TEST X FAILED" in the results.

### Running Frontend Tests

```bash
npm run test        # Watch mode
npm run test:run    # Run once
npm run test:ui     # Visual UI mode
```

Note: Frontend tests use mocked Supabase client - they test frontend logic only, not database functionality.

## Features

- **Authentication**: Email/password signup and login
- **Points System**: Start with 5000 points, earn daily bonuses
- **Bets**: Create public, friends-only, or private bets
- **Wagers**: Bet for or against with custom stakes
- **Friends**: Send and accept friend requests
- **Notifications**: Get notified about friend requests and bet resolutions
- **Reveal Wagers**: See who bet for/against when a bet resolves
- **Admin Panel**: Manage users and adjust points (admin only)

## Project Structure

```
src/
├── main.js              # Entry point
├── app.js               # Main app controller
├── index.css            # Styles
├── lib/
│   ├── supabase.js      # Supabase client
│   └── store.js         # State management
├── services/
│   ├── auth.js          # Authentication
│   ├── bets.js          # Bet operations
│   ├── friends.js       # Friendships
│   ├── notifications.js # Notifications
│   ├── transactions.js  # Transaction history
│   └── users.js         # User management
└── components/
    ├── auth.js          # Login/Register forms
    ├── bet-card.js      # Bet display
    ├── bet-modal.js     # Create/Edit bet
    ├── winner-modal.js  # Select winner
    └── ...              # Other modals
```
