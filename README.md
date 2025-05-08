# ActivityBot - Multipurpose Discord Bot

A powerful multipurpose Discord bot with leveling, invite tracking, and more. Features a beautiful web dashboard for easy configuration. Built with Discord.js and Express.

![Bot Logo](src/logo/logo.png)

## Features

### 🌟 General
- 🌐 Beautiful web dashboard for configuration
- 📱 Responsive design for mobile and desktop
- 🔒 Secure authentication system
- 🌍 Multi-language support (English, Kurdish, French, German, Arabic)
- 💾 Persistent data across bot restarts
- ⚙️ Customizable settings per server

### 📊 Leveling System
- 💬 Track chat activity with customizable XP rates
- 🎙️ Track voice activity with real-time XP earning
- 🎯 Separate leveling for chat and voice
- 🏆 Automatic role rewards based on levels
- 📈 Beautiful rank cards to display progress
- � Exclude specific channels and roles from earning XP

### � Leaderboards
- 🏅 Server-specific leaderboards
- 🌎 Global leaderboards across all servers
- 📅 Daily, weekly, and monthly leaderboards
- 🔄 Scheduled leaderboard resets (configurable timezone)
- � Detailed statistics and activity tracking

### 📨 Invite Tracking
- 👥 Track who invited each member to your server
- 🔍 Distinguish between regular, fake, and left invites
- 🎯 Customizable invite settings per server
- 💬 Welcome messages with inviter information
- 🏆 Global invite leaderboard (counting only regular invites)

## Requirements

- Node.js 16.9.0 or higher
- Discord Bot Token
- Discord Application with OAuth2 credentials

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Akar1881/activitybot.git
   cd activitybot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy `example.env` to `.env` and fill in your credentials:
   ```bash
   cp example.env .env
   ```

4. Start the bot and dashboard:
   ```bash
   # Start the bot
   npm start
   
   # Start the dashboard
   npm run web
   
   # For development with auto-reload:
   npm run dev       # Bot
   npm run dev:web   # Dashboard
   ```

## Configuration

1. Create a Discord application at https://discord.com/developers/applications
2. Create a bot user and get your bot token
3. Enable required Privileged Gateway Intents:
   - Message Content Intent
   - Server Members Intent
   - Voice States Intent
4. Set up OAuth2 credentials for the dashboard
5. Add the bot to your server using the OAuth2 URL with these scopes:
   - `bot`
   - `applications.commands`
   
Required bot permissions:
- Manage Roles
- Send Messages
- View Channels
- Read Message History
- Connect
- View Voice States
- Manage Server (for invite tracking)
- Create Instant Invite (for invite tracking)

## Commands

### General
- `/help` - Show all available commands

### Leveling
- `/rank` - Display your rank card
- `/top` - Show server leaderboard (daily, weekly, monthly, or all-time)

### Invite Tracking
- `/invites` - Check your or another user's invite count
- `/resetinvites` - Reset all invite data for the server (Admin only)

## Leveling System

### Chat XP
- Earn XP by chatting in text channels
- Customizable XP rates per message
- Configurable cooldown between XP gains
- Anti-spam measures to prevent abuse
- XP multipliers for special events or roles

### Voice XP
- Real-time voice XP tracking (users earn XP while in voice channels)
- Configurable minimum time to earn XP (default: 1 minute)
- Configurable maximum time to earn XP per session (default: 30 minutes)
- XP is awarded every minute while in voice channels
- Automatic level-up announcements and role rewards
- Voice activity persists across bot restarts

## Invite Tracking System

The bot features a comprehensive invite tracking system:
- Track who invited each member to your server
- Distinguish between regular, fake, and left invites
- Customizable settings per server:
  - Option to count/ignore fake invites (accounts less than 30 days old)
  - Option to count/ignore left invites (users who joined but later left)
- Welcome messages with inviter information
- Customizable welcome channel and message
- Detailed invite statistics for each user
- Invite leaderboard for each server
- Global invite leaderboard across all servers

## Leaderboard System

The bot includes a comprehensive leaderboard system:
- Daily leaderboards (reset at 12:05 AM GMT+3)
- Weekly leaderboards (reset every Monday at 12:05 AM GMT+3)
- Monthly leaderboards (reset on the 1st of each month at 12:05 AM GMT+3)
- All-time leaderboards
- Global XP leaderboard across all servers
- Global invite leaderboard (counting only regular invites)
- Leaderboard data persists across bot restarts
- Configurable through the dashboard

## Dashboard

The web dashboard provides a comprehensive control panel for server administrators:

### General Settings
- Server overview and statistics
- Bot configuration and preferences
- Language selection
- Theme customization

### Leveling System
- Configure XP rates for chat and voice
- Set up role rewards for different levels
- Customize level-up announcements
- Exclude specific channels and roles from earning XP
- View detailed XP statistics

### Leaderboards
- View server-specific leaderboards
- Access global leaderboards across all servers
- Filter by daily, weekly, monthly, or all-time periods
- Track top members by activity
- Export leaderboard data

### Invite Management
- Configure invite tracking settings
- Enable/disable counting fake invites
- Enable/disable counting left invites
- Set up welcome messages with inviter information
- Choose welcome message channel
- Customize welcome message format

### Data Management
- Reset XP data
- Reset invite data
- Back up server configuration

## Languages

The dashboard supports multiple languages with an easy-to-use translation system. Currently supported languages:

- English
- Kurdish (Sorani)

For more information about languages and how to add your own translations, see [LANGUAGES.md](LANGUAGES.md).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Support

NOT CURRENTLY

## Upcoming Features

We're constantly working to improve ActivityBot with new features:
- Ticket support system
- Reaction roles
- Giveaway system
- And much more!

Stay tuned for updates!