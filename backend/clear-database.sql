-- Clear all annotations from the database
-- Run this in Railway's database console

-- Option 1: Just clear annotations (keep user accounts)
DELETE FROM shares;

-- Option 2: Complete wipe (clear users too - they'll need to re-register)
-- DELETE FROM shares;
-- DELETE FROM users;

-- Verify the wipe
SELECT COUNT(*) as share_count FROM shares;
SELECT COUNT(*) as user_count FROM users;
