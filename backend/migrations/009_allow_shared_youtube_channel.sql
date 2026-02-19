-- Allow multiple Citelines accounts to share the same YouTube channel ID.
-- The same person may have both a YouTube-auth account and an email account;
-- OAuth proof of channel ownership is sufficient without enforcing uniqueness.
DROP INDEX IF EXISTS users_youtube_channel_id_unique;
