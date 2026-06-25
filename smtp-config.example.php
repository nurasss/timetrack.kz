<?php
// Copy this file to smtp-config.php (gitignored) and fill in real credentials.
// api.php silently disables email sending if smtp-config.php is missing.

define('SMTP_HOST', 'smtp.timetrack.kz');
define('SMTP_PORT', 465); // implicit TLS (SMTPS)
define('SMTP_USER', 'no-reply@timetrack.kz');
define('SMTP_PASS', '');
