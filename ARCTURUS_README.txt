Arcturus CMS compatibility patch

Included backend fixes:
- users + user_stats integration
- registration insert fixed for Arcturus users table
- stats_setup_done stored in user_stats
- farming mapped to gathering
- knowledge stat supported
- Arcturus bans table support
- leaderboard fields moved to user_stats where appropriate

SQL notes:
MySQL versions that do not support IF NOT EXISTS on ADD COLUMN may require manual checks before running arcturus_migration.sql.
