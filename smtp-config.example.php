<?php
// Copy this file to smtp-config.php (gitignored) and fill in real credentials.
// api.php silently disables email sending if smtp-config.php is missing.
//
// Two modes, picked automatically based on whether SMTP_USER/SMTP_PASS are set:
//
// 1) External provider over implicit TLS (AUTH LOGIN, port 465):
define('SMTP_HOST', 'smtp.timetrack.kz');
define('SMTP_PORT', 465); // implicit TLS (SMTPS)
define('SMTP_USER', 'no-reply@timetrack.kz');
define('SMTP_PASS', '');
//
// 2) Local Postfix relay on the same host, trusted by source IP (no TLS, no
//    AUTH). Leave SMTP_USER/SMTP_PASS undefined, point SMTP_HOST at the
//    relay, and define SMTP_FROM since there's no SMTP_USER to fall back to:
// define('SMTP_HOST', '172.18.0.1');
// define('SMTP_PORT', 25);
// define('SMTP_FROM', 'no-reply@timetrack.kz');
