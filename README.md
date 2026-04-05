# FriendBet

A social betting platform where friends challenge each other, stake points, and settle disputes through a community-driven court system.

## How It Works

### Create a Bet
You think something is going to happen? Put it to the test. Write a bet, set a stake, choose who can see it — public, friends only, or private. Publishing costs a small fee that scales with the bet's duration.

### Place Your Wager
See a bet you like? Pick a side — **for** or **against** — and put your points on the line. The creator's stake gets split among winners proportionally to how much each person wagered.

### The Court System
When a bet expires, anyone who participated can propose an outcome. If someone challenges it, all participants enter a **commit-reveal vote**:

1. **Commit** — lock in your vote as a hash (nobody can see it yet)
2. **Reveal** — expose your actual vote
3. **Settle** — majority wins, losers lose their stake, winners take the pot

This prevents bandwagon voting — you commit blind, so you can't just follow the crowd.

If nobody proposes a resolution within 24 hours, everyone gets their money back. If the court ties or nobody votes, same thing — full refund.

### Streaks & Bonuses
Log in daily to build a streak. Each day earns `streak × 5` bonus points (capped at 20/day). Miss a day and your streak goes into danger — miss the next and it resets to zero. You get 5 streak rescues per month to save it.

The longer your streak, the further your penguin evolves. Win consecutive bets to climb the trophy leaderboard.

### Friend System
Add friends to see their private bets and create friends-only wagers. Friend requests, acceptances, and bet activity all trigger notifications.

## The Point Economy

| Action | Cost / Reward |
|---|---|
| Starting balance | 5,000 points |
| Publish a bet | 10 + duration (hours) points |
| Daily bonus | streak × 5 points (max 20) |
| Win a wager | Your stake back + share of creator's stake |
| Lose a wager | Your stake is gone |
| Court vote (juror) | 100 points stake — returned if you're on the winning side |
| Win streak bonus | wins × 10 points |

Points are the only currency. There's no real money involved — it's about bragging rights and climbing the leaderboard.
