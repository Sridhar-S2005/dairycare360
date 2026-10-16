-- DairyCare 360: show the name of the user who raised each ticket.
USE ticket_tracker;

ALTER TABLE tickets
    ADD COLUMN requester_name VARCHAR(120) NOT NULL DEFAULT '' AFTER assignee;

-- Existing tickets cannot reliably be linked to a name unless requester_email matches users.email.
UPDATE tickets t
JOIN users u ON LOWER(t.requester_email) = LOWER(u.email)
SET t.requester_name = u.name
WHERE t.requester_name = '';
