<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$ALLOWED_ORIGINS = ['https://timetrack.kz', 'https://www.timetrack.kz', 'http://localhost:8787', 'http://127.0.0.1:8787'];
$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($requestOrigin, $ALLOWED_ORIGINS, true)) {
    header('Access-Control-Allow-Origin: ' . $requestOrigin);
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$baseDataDir = __DIR__ . DIRECTORY_SEPARATOR . 'data';
$companiesFile = $baseDataDir . DIRECTORY_SEPARATOR . 'companies.json';
$lastLoginsFile = $baseDataDir . DIRECTORY_SEPARATOR . 'last-logins.json';
define('DUPLICATE_WINDOW_SECONDS', 120);
define('MAX_PIN_ATTEMPTS', 6);
define('PIN_LOCKOUT_SECONDS', 900);
define('BACKUP_KEEP', 20);
define('RESET_TOKEN_TTL_SECONDS', 1800);
define('RESET_REQUEST_COOLDOWN_SECONDS', 120);
define('EMAIL_VERIFY_TTL_SECONDS', 86400);
define('TABLET_ACCESS_TTL_SECONDS', 600);

$smtpConfigFile = __DIR__ . DIRECTORY_SEPARATOR . 'smtp-config.php';
if (is_file($smtpConfigFile)) {
    require_once $smtpConfigFile;
}

if (!is_dir($baseDataDir) && !mkdir($baseDataDir, 0755, true)) {
    respond(['ok' => false, 'error' => 'Не удалось создать каталог данных'], 500);
}

function respond(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function valid_slug(string $slug): bool
{
    return (bool)preg_match('/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/', $slug);
}

function read_companies(string $file): array
{
    if (!is_file($file)) {
        return [];
    }
    $raw = file_get_contents($file);
    $decoded = json_decode($raw ?: '', true);
    return is_array($decoded) ? $decoded : [];
}

function write_companies(string $file, array $companies): void
{
    file_put_contents(
        $file,
        json_encode($companies, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT),
        LOCK_EX
    );
}

function delete_directory(string $dir): bool
{
    if (!is_dir($dir)) {
        return true;
    }

    $items = scandir($dir);
    if ($items === false) {
        return false;
    }

    foreach ($items as $item) {
        if ($item === '.' || $item === '..') {
            continue;
        }
        $path = $dir . DIRECTORY_SEPARATOR . $item;
        if (is_dir($path)) {
            if (!delete_directory($path)) {
                return false;
            }
        } elseif (!unlink($path)) {
            return false;
        }
    }

    return rmdir($dir);
}

function default_state(): array
{
    return [
        'employees' => [],
        'logs' => [],
        'settings' => [
            'recognitionModel' => 'tiny',
            'matchThreshold' => 0.55,
            'lateMinutes' => 15,
            'adminPin' => '1234',
        ],
    ];
}

function read_state(string $file): array
{
    if (!is_file($file)) {
        return default_state();
    }

    $raw = file_get_contents($file);
    $decoded = json_decode($raw ?: '', true);
    if (!is_array($decoded)) {
        return default_state();
    }

    $state = array_replace_recursive(default_state(), $decoded);
    $state['employees'] = is_array($state['employees']) ? array_values($state['employees']) : [];
    $state['logs'] = is_array($state['logs']) ? array_values($state['logs']) : [];
    $state['settings'] = is_array($state['settings']) ? $state['settings'] : default_state()['settings'];
    return $state;
}

// Storage is split across three files so the high-frequency action (addLog,
// triggered by every kiosk tap) never has to rewrite employee photos/face
// descriptors, and a settings change never has to rewrite the logs. This is
// the targeted fix for the "one giant JSON file" scaling problem without a
// full DB migration: each file is rewritten only when its own data changes.
function employees_file(string $companyDir): string
{
    return $companyDir . DIRECTORY_SEPARATOR . 'employees.json';
}

function settings_file(string $companyDir): string
{
    return $companyDir . DIRECTORY_SEPARATOR . 'settings.json';
}

function logs_file(string $companyDir): string
{
    return $companyDir . DIRECTORY_SEPARATOR . 'logs.json';
}

function read_state_split(string $companyDir): array
{
    $employeesPath = employees_file($companyDir);
    $settingsPath = settings_file($companyDir);
    $logsPath = logs_file($companyDir);

    if (is_file($employeesPath) || is_file($settingsPath) || is_file($logsPath)) {
        $employeesRaw = is_file($employeesPath) ? json_decode(file_get_contents($employeesPath) ?: '', true) : null;
        $settingsRaw = is_file($settingsPath) ? json_decode(file_get_contents($settingsPath) ?: '', true) : null;
        $logsRaw = is_file($logsPath) ? json_decode(file_get_contents($logsPath) ?: '', true) : null;

        $defaults = default_state();
        return [
            'employees' => is_array($employeesRaw['employees'] ?? null) ? array_values($employeesRaw['employees']) : [],
            'settings' => is_array($settingsRaw['settings'] ?? null)
                ? array_replace($defaults['settings'], $settingsRaw['settings'])
                : $defaults['settings'],
            'logs' => is_array($logsRaw['logs'] ?? null) ? array_values($logsRaw['logs']) : [],
        ];
    }

    // One-time migration from the legacy combined store.json, if present.
    $legacyFile = $companyDir . DIRECTORY_SEPARATOR . 'store.json';
    $state = read_state($legacyFile);
    write_employees($employeesPath, $state);
    write_settings($settingsPath, $state);
    write_logs_file($logsPath, $state);
    if (is_file($legacyFile)) {
        @rename($legacyFile, $legacyFile . '.migrated');
    }
    return $state;
}

function write_employees(string $file, array $state): void
{
    file_put_contents(
        $file,
        json_encode(['employees' => $state['employees']], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT),
        LOCK_EX
    );
}

function write_settings(string $file, array $state): void
{
    file_put_contents(
        $file,
        json_encode(['settings' => $state['settings']], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT),
        LOCK_EX
    );
}

function write_logs_file(string $file, array $state): void
{
    file_put_contents(
        $file,
        json_encode(['logs' => $state['logs']], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT),
        LOCK_EX
    );
}

function public_state(array $state): array
{
    $out = $state;
    if (isset($out['settings']['adminPin'])) {
        unset($out['settings']['adminPin']);
    }
    return $out;
}

function clean_text($value, int $max = 120): string
{
    $value = trim((string)$value);
    $value = preg_replace('/\s+/u', ' ', $value) ?? '';
    return substr($value, 0, $max);
}

function clean_id($value, string $prefix): string
{
    $id = preg_replace('/[^a-zA-Z0-9_-]/', '', (string)$value) ?? '';
    if ($id === '') {
        $id = $prefix . time() . random_int(1000, 9999);
    }
    return substr($id, 0, 64);
}

function clean_number($value, float $default, float $min, float $max): float
{
    $number = is_numeric($value) ? (float)$value : $default;
    return max($min, min($max, $number));
}

function normalize_descriptor($descriptor): ?array
{
    if (!is_array($descriptor) || count($descriptor) < 64) {
        return null;
    }

    return array_map(static fn($item) => (float)$item, array_slice(array_values($descriptor), 0, 256));
}

function normalize_photo($photo): ?string
{
    $photo = (string)$photo;
    if ($photo === '' || strncmp($photo, 'data:image/', 11) !== 0) {
        return null;
    }
    return strlen($photo) > 1600000 ? null : $photo;
}

function normalize_employee(array $employee): array
{
    return [
        'id' => clean_id($employee['id'] ?? '', 'e'),
        'fname' => clean_text($employee['fname'] ?? '', 80),
        'lname' => clean_text($employee['lname'] ?? '', 80),
        'position' => clean_text($employee['position'] ?? 'Сотрудник', 100),
        'dept' => clean_text($employee['dept'] ?? 'Общий', 100),
        'workStart' => preg_match('/^\d{2}:\d{2}$/', (string)($employee['workStart'] ?? '09:00'))
            ? (string)$employee['workStart']
            : '09:00',
        'photo' => normalize_photo($employee['photo'] ?? null),
        'descriptor' => normalize_descriptor($employee['descriptor'] ?? null),
    ];
}

function normalize_log(array $log): array
{
    $type = ($log['type'] ?? '') === 'checkout' ? 'checkout' : 'checkin';
    $verification = in_array(($log['verification'] ?? ''), ['blink', 'head'], true) ? (string)$log['verification'] : '';
    $ts = clean_text($log['ts'] ?? gmdate('c'), 48);
    $timestamp = strtotime($ts);
    if ($timestamp === false) {
        $timestamp = time();
        $ts = gmdate('c', $timestamp);
    }

    return [
        'id' => clean_id($log['id'] ?? '', 'l'),
        'empId' => clean_id($log['empId'] ?? '', 'e'),
        'empName' => clean_text($log['empName'] ?? '', 180),
        'empPhoto' => normalize_photo($log['empPhoto'] ?? null),
        'type' => $type,
        'time' => clean_text($log['time'] ?? date('H:i', $timestamp), 24),
        'date' => clean_text($log['date'] ?? date('d.m.Y', $timestamp), 24),
        'ts' => $ts,
        'isLate' => !empty($log['isLate']),
        'verification' => $verification,
    ];
}

function normalize_settings(array $settings, array $current = []): array
{
    $nextPin = trim((string)($settings['adminPin'] ?? ''));
    return [
        'recognitionModel' => ($settings['recognitionModel'] ?? 'tiny') === 'ssd' ? 'ssd' : 'tiny',
        'matchThreshold' => clean_number($settings['matchThreshold'] ?? 0.55, 0.55, 0.35, 0.8),
        'lateMinutes' => (int)clean_number($settings['lateMinutes'] ?? 15, 15, 0, 120),
        'adminPin' => $nextPin !== '' ? substr($nextPin, 0, 32) : ($current['adminPin'] ?? '1234'),
    ];
}

function admin_authorized(array $input, array $state): bool
{
    return (string)($input['adminPin'] ?? '') === (string)($state['settings']['adminPin'] ?? '1234');
}

// Companies created before this feature shipped have no `emailVerified` key
// at all — treat that as already-verified (grandfathered in), so deploying
// this doesn't lock out existing live companies. Only an explicit `false`
// (set by a fresh registration) blocks access.
function company_is_verified(?array $company): bool
{
    if ($company === null || !array_key_exists('emailVerified', $company)) {
        return true;
    }
    return $company['emailVerified'] === true;
}

function default_security(): array
{
    return [
        'failedAttempts' => 0,
        'lockUntil' => null,
        'resetToken' => null,
        'resetExpires' => null,
        'lastResetRequestAt' => null,
        'verifyToken' => null,
        'verifyExpires' => null,
        'lastVerifyRequestAt' => null,
        'tabletToken' => null,
        'tabletExpires' => null,
    ];
}

function read_security(string $file): array
{
    if (!is_file($file)) {
        return default_security();
    }
    $decoded = json_decode(file_get_contents($file) ?: '', true);
    if (!is_array($decoded)) {
        return default_security();
    }
    return array_replace(default_security(), $decoded);
}

function write_security(string $file, array $security): void
{
    file_put_contents($file, json_encode($security, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
}

function pin_lock_remaining(array $security): int
{
    if (empty($security['lockUntil'])) {
        return 0;
    }
    $remaining = strtotime((string)$security['lockUntil']) - time();
    return max(0, $remaining);
}

// Brute-force guard: a wrong PIN attempt while locked out doesn't reset the
// lock early, so a slow attacker can't keep extending their own lockout
// window to learn timing info, and a legitimate admin just has to wait it out.
function require_admin_pin(array $input, array $state, string $securityFile): void
{
    $security = read_security($securityFile);
    $remaining = pin_lock_remaining($security);
    if ($remaining > 0) {
        respond(['ok' => false, 'error' => 'Слишком много попыток входа. Попробуйте через ' . (int)ceil($remaining / 60) . ' мин.'], 429);
    }
    if (!admin_authorized($input, $state)) {
        $security['failedAttempts'] = ($security['failedAttempts'] ?? 0) + 1;
        if ($security['failedAttempts'] >= MAX_PIN_ATTEMPTS) {
            $security['lockUntil'] = gmdate('c', time() + PIN_LOCKOUT_SECONDS);
            $security['failedAttempts'] = 0;
        }
        write_security($securityFile, $security);
        respond(['ok' => false, 'error' => 'Неверный PIN админки'], 403);
    }
    // Only clear the brute-force counters — this helper runs on every
    // admin-authorized action (saveEmployee, requestTabletAccess, ...), so
    // wiping the whole security record here would also nuke unrelated,
    // still-pending tokens like a freshly issued tablet QR token.
    $security['failedAttempts'] = 0;
    $security['lockUntil'] = null;
    write_security($securityFile, $security);
}

function backup_store(string $companyDir, string $employeesFile): void
{
    $backupDir = $companyDir . DIRECTORY_SEPARATOR . 'backups';
    if (!is_dir($backupDir) && !mkdir($backupDir, 0755, true)) {
        return;
    }
    if (is_file($employeesFile)) {
        $target = $backupDir . DIRECTORY_SEPARATOR . 'employees-' . gmdate('Ymd-His') . '.json';
        copy($employeesFile, $target);
    }
    $files = glob($backupDir . DIRECTORY_SEPARATOR . 'employees-*.json') ?: [];
    sort($files);
    $excess = count($files) - BACKUP_KEEP;
    for ($i = 0; $i < $excess; $i++) {
        @unlink($files[$i]);
    }
}

// Minimal SMTP client over raw sockets (no PHPMailer/Composer in this
// project). Reads/writes the protocol directly; only handles AUTH LOGIN over
// implicit TLS (port 465), which is all the configured provider needs.
function smtp_configured(): bool
{
    return defined('SMTP_HOST') && defined('SMTP_PORT');
}

// Plain-text emails risk a confirmation/reset link getting visually
// line-wrapped by the recipient's client, which can make its auto-link
// detector grab only part of the URL (silently dropping the token). Sending
// as HTML with a real <a href> sidesteps that — the href is a literal
// attribute, independent of how the visible text wraps.
function text_to_html(string $text): string
{
    $escaped = htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
    $linked = preg_replace('#(https?://[^\s<]+)#', '<a href="$1">$1</a>', $escaped);
    return str_replace("\n", "<br>\n", $linked);
}

// AUTH+TLS is only used when SMTP_USER/SMTP_PASS are defined (external
// provider, e.g. a real mailbox over implicit TLS on port 465). Without
// credentials, this connects in the clear with no AUTH — meant for a local
// Postfix relay on a trusted private network (e.g. the docker bridge) that
// authorizes by source IP via mynetworks, not by login.
function send_email(string $to, string $subject, string $bodyText): bool
{
    if (!smtp_configured()) {
        error_log('SMTP not configured (smtp-config.php missing/empty); skipping email to ' . $to);
        return false;
    }

    $useAuth = defined('SMTP_USER') && defined('SMTP_PASS') && SMTP_PASS !== '';
    $fromAddress = defined('SMTP_FROM') ? SMTP_FROM : (defined('SMTP_USER') ? SMTP_USER : 'no-reply@timetrack.kz');

    $errno = 0;
    $errstr = '';
    $scheme = $useAuth ? 'ssl://' : 'tcp://';
    $socket = @stream_socket_client(
        $scheme . SMTP_HOST . ':' . SMTP_PORT,
        $errno,
        $errstr,
        10,
        STREAM_CLIENT_CONNECT
    );
    if (!$socket) {
        error_log("SMTP connect failed to " . SMTP_HOST . ':' . SMTP_PORT . " — $errstr");
        return false;
    }
    stream_set_timeout($socket, 10);

    $expect = static function ($socket, string $code): bool {
        $response = '';
        while (($line = fgets($socket, 515)) !== false) {
            $response .= $line;
            if (preg_match('/^\d{3} /', $line)) {
                break;
            }
        }
        if (substr($response, 0, 3) !== $code) {
            error_log('SMTP unexpected response (wanted ' . $code . "): $response");
            return false;
        }
        return true;
    };
    $send = static function ($socket, string $line): void {
        fwrite($socket, $line . "\r\n");
    };

    $ok = $expect($socket, '220');
    if ($ok) { $send($socket, 'EHLO timetrack.kz'); $ok = $expect($socket, '250'); }
    if ($ok && $useAuth) { $send($socket, 'AUTH LOGIN'); $ok = $expect($socket, '334'); }
    if ($ok && $useAuth) { $send($socket, base64_encode(SMTP_USER)); $ok = $expect($socket, '334'); }
    if ($ok && $useAuth) { $send($socket, base64_encode(SMTP_PASS)); $ok = $expect($socket, '235'); }
    if ($ok) { $send($socket, 'MAIL FROM:<' . $fromAddress . '>'); $ok = $expect($socket, '250'); }
    if ($ok) { $send($socket, 'RCPT TO:<' . $to . '>'); $ok = $expect($socket, '250'); }
    if ($ok) { $send($socket, 'DATA'); $ok = $expect($socket, '354'); }

    if ($ok) {
        $encodedSubject = function_exists('mb_encode_mimeheader')
            ? mb_encode_mimeheader($subject, 'UTF-8')
            : $subject;
        $htmlBody = '<!DOCTYPE html><html><body style="font-family:sans-serif;font-size:15px;line-height:1.5">'
            . text_to_html($bodyText) . '</body></html>';
        $headers = "From: Timetrack <" . $fromAddress . ">\r\n"
            . "To: <{$to}>\r\n"
            . "Subject: {$encodedSubject}\r\n"
            . "MIME-Version: 1.0\r\n"
            . "Content-Type: text/html; charset=UTF-8\r\n"
            . "Content-Transfer-Encoding: base64\r\n\r\n";
        fwrite($socket, $headers);
        fwrite($socket, chunk_split(base64_encode($htmlBody)));
        $send($socket, '.');
        $ok = $expect($socket, '250');
    }

    $send($socket, 'QUIT');
    fclose($socket);
    return $ok;
}

function base_url(): string
{
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'timetrack.kz';
    return "$scheme://$host";
}

// Caddy's reverse_proxy sets X-Forwarded-For automatically, so this is the
// real visitor IP even though PHP/Node sit behind it; REMOTE_ADDR alone
// would just be Caddy's own container address.
function client_ip(): string
{
    $forwarded = (string)($_SERVER['HTTP_X_FORWARDED_FOR'] ?? '');
    if ($forwarded !== '') {
        return trim(explode(',', $forwarded)[0]);
    }
    return (string)($_SERVER['REMOTE_ADDR'] ?? '');
}

// Soft "remember this browser's last company" lookup, NOT authentication —
// whoAmI only ever suggests a company name/slug so index.html can offer a
// shortcut into login.html; the PIN is still required there either way.
function read_last_logins(string $file): array
{
    if (!is_file($file)) {
        return [];
    }
    $decoded = json_decode(file_get_contents($file) ?: '', true);
    return is_array($decoded) ? $decoded : [];
}

function write_last_logins(string $file, array $data): void
{
    file_put_contents($file, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
}

function record_last_login(string $file, string $ip, string $slug, string $name): void
{
    if ($ip === '') {
        return;
    }
    $data = read_last_logins($file);
    $data[$ip] = ['slug' => $slug, 'name' => $name, 'lastLoginAt' => gmdate('c')];
    // Keep the file from growing without bound on a busy shared IP pool.
    if (count($data) > 5000) {
        $data = array_slice($data, -2000, null, true);
    }
    write_last_logins($file, $data);
}

function recent_duplicate(array $logs, array $nextLog): bool
{
    $nextTs = strtotime((string)($nextLog['ts'] ?? '')) ?: 0;
    foreach ($logs as $log) {
        $logTs = strtotime((string)($log['ts'] ?? '')) ?: 0;
        if (($log['empId'] ?? '') === $nextLog['empId'] &&
            ($log['type'] ?? '') === $nextLog['type'] &&
            abs($logTs - $nextTs) <= DUPLICATE_WINDOW_SECONDS) {
            return true;
        }
    }
    return false;
}

// --- Parse input ---

$input = json_decode(file_get_contents('php://input') ?: '{}', true);
if (!is_array($input)) {
    $input = [];
}

$action = (string)($_GET['action'] ?? $input['action'] ?? 'state');
$slug = strtolower(trim((string)($_GET['c'] ?? $input['c'] ?? '')));

// === Registration (no slug needed) ===

if ($action === 'register') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        respond(['ok' => false, 'error' => 'Метод не поддерживается'], 405);
    }

    $newSlug = strtolower(trim((string)($input['slug'] ?? '')));
    $companyName = clean_text($input['name'] ?? '', 120);
    $pin = trim((string)($input['pin'] ?? ''));
    $email = strtolower(trim((string)($input['email'] ?? '')));
    $acceptedPolicy = !empty($input['acceptedPolicy']);
    $acceptedOffer = !empty($input['acceptedOffer']);

    if (!valid_slug($newSlug)) {
        respond(['ok' => false, 'error' => 'Некорректный идентификатор (3-32 символа, латиница, цифры, дефис)'], 422);
    }
    if ($companyName === '') {
        respond(['ok' => false, 'error' => 'Укажите название компании'], 422);
    }
    if (strlen($pin) < 4) {
        respond(['ok' => false, 'error' => 'PIN должен быть не менее 4 символов'], 422);
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        respond(['ok' => false, 'error' => 'Укажите корректный email — на него можно будет восстановить PIN'], 422);
    }
    if (!$acceptedPolicy || !$acceptedOffer) {
        respond(['ok' => false, 'error' => 'Необходимо подтвердить согласие с офертой и политикой конфиденциальности'], 422);
    }

    $companyDir = $baseDataDir . DIRECTORY_SEPARATOR . $newSlug;
    if (is_dir($companyDir)) {
        respond(['ok' => false, 'error' => 'Этот идентификатор уже занят'], 409);
    }

    if (!mkdir($companyDir, 0755, true)) {
        respond(['ok' => false, 'error' => 'Не удалось создать компанию'], 500);
    }

    $initialState = default_state();
    $initialState['settings']['adminPin'] = substr($pin, 0, 32);
    write_employees(employees_file($companyDir), $initialState);
    write_settings(settings_file($companyDir), $initialState);
    write_logs_file(logs_file($companyDir), $initialState);

    $htaccess = $companyDir . DIRECTORY_SEPARATOR . '.htaccess';
    file_put_contents($htaccess, "Require all denied\n");

    $companies = read_companies($companiesFile);
    $companies[] = [
        'slug' => $newSlug,
        'name' => $companyName,
        'email' => $email,
        'emailVerified' => false,
        'createdAt' => gmdate('c'),
        'consent' => [
            'policy' => true,
            'offer' => true,
            'acceptedAt' => gmdate('c'),
        ],
    ];
    write_companies($companiesFile, $companies);

    $verifyToken = bin2hex(random_bytes(16));
    write_security(
        $companyDir . DIRECTORY_SEPARATOR . 'security.json',
        array_replace(default_security(), [
            'verifyToken' => $verifyToken,
            'verifyExpires' => gmdate('c', time() + EMAIL_VERIFY_TTL_SECONDS),
        ])
    );

    $baseUrl = base_url();
    send_email(
        $email,
        'Timetrack — подтвердите email',
        "Спасибо за регистрацию в Timetrack!\n\n"
        . "Компания: {$companyName}\n\n"
        . "Подтвердите email, чтобы активировать компанию (ссылка действует 24 часа):\n"
        . "{$baseUrl}/register.html?confirm=1&c={$newSlug}&token={$verifyToken}\n\n"
        . "После подтверждения станут доступны:\n"
        . "Админ-панель: {$baseUrl}/admin.html?c={$newSlug}\n"
        . "Планшет-киоск: {$baseUrl}/tablet.html?c={$newSlug}"
    );

    respond([
        'ok' => true,
        'company' => [
            'slug' => $newSlug,
            'name' => $companyName,
            'emailVerified' => false,
        ],
    ]);
}

if ($action === 'companies') {
    $companies = read_companies($companiesFile);
    $publicList = array_map(static fn($c) => [
        'slug' => $c['slug'] ?? '',
        'name' => $c['name'] ?? '',
    ], $companies);
    respond(['ok' => true, 'companies' => $publicList]);
}

if ($action === 'whoAmI') {
    $lastLogins = read_last_logins($lastLoginsFile);
    $entry = $lastLogins[client_ip()] ?? null;
    if (!$entry) {
        respond(['ok' => true, 'found' => false]);
    }
    respond(['ok' => true, 'found' => true, 'slug' => $entry['slug'] ?? '', 'name' => $entry['name'] ?? '']);
}

// === All other actions require a valid slug ===

if (!valid_slug($slug)) {
    respond(['ok' => false, 'error' => 'Укажите компанию (?c=slug)'], 400);
}

$companyDir = $baseDataDir . DIRECTORY_SEPARATOR . $slug;
if (!is_dir($companyDir)) {
    respond(['ok' => false, 'error' => 'Компания не найдена'], 404);
}

$lockFile = $companyDir . DIRECTORY_SEPARATOR . 'store.lock';
$securityFile = $companyDir . DIRECTORY_SEPARATOR . 'security.json';
$employeesFile = employees_file($companyDir);
$settingsFile = settings_file($companyDir);
$logsFile = logs_file($companyDir);

if ($action === 'companyInfo') {
    $companies = read_companies($companiesFile);
    $found = null;
    foreach ($companies as $c) {
        if (($c['slug'] ?? '') === $slug) {
            $found = $c;
            break;
        }
    }
    respond([
        'ok' => true,
        'company' => [
            'slug' => $slug,
            'name' => $found['name'] ?? $slug,
        ],
    ]);
}

if ($action === 'confirmEmail') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        respond(['ok' => false, 'error' => 'Метод не поддерживается'], 405);
    }
    $token = trim((string)($input['token'] ?? ''));
    $security = read_security($securityFile);
    $validToken = $token !== '' && !empty($security['verifyToken']) && hash_equals((string)$security['verifyToken'], $token);
    $notExpired = !empty($security['verifyExpires']) && strtotime((string)$security['verifyExpires']) > time();

    if (!$validToken || !$notExpired) {
        respond(['ok' => false, 'error' => 'Ссылка подтверждения недействительна или устарела'], 403);
    }

    $companies = read_companies($companiesFile);
    foreach ($companies as &$c) {
        if (($c['slug'] ?? '') === $slug) {
            $c['emailVerified'] = true;
            break;
        }
    }
    unset($c);
    write_companies($companiesFile, $companies);

    $security['verifyToken'] = null;
    $security['verifyExpires'] = null;
    write_security($securityFile, $security);
    respond(['ok' => true]);
}

if ($action === 'resendConfirmation') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        respond(['ok' => false, 'error' => 'Метод не поддерживается'], 405);
    }
    $companies = read_companies($companiesFile);
    $company = null;
    foreach ($companies as $c) {
        if (($c['slug'] ?? '') === $slug) {
            $company = $c;
            break;
        }
    }

    if ($company && !company_is_verified($company)) {
        $security = read_security($securityFile);
        $cooldownOk = empty($security['lastVerifyRequestAt'])
            || (time() - strtotime((string)$security['lastVerifyRequestAt'])) >= RESET_REQUEST_COOLDOWN_SECONDS;
        if ($cooldownOk) {
            $token = bin2hex(random_bytes(16));
            $security['verifyToken'] = $token;
            $security['verifyExpires'] = gmdate('c', time() + EMAIL_VERIFY_TTL_SECONDS);
            $security['lastVerifyRequestAt'] = gmdate('c');
            write_security($securityFile, $security);

            $baseUrl = base_url();
            send_email(
                (string)($company['email'] ?? ''),
                'Timetrack — подтвердите email',
                "Подтвердите email, чтобы активировать компанию «{$company['name']}» (ссылка действует 24 часа):\n"
                . "{$baseUrl}/register.html?confirm=1&c={$slug}&token={$token}"
            );
        }
    }
    respond(['ok' => true, 'message' => 'Если компания существует и email ещё не подтверждён, письмо отправлено повторно']);
}

$companiesForGate = read_companies($companiesFile);
$companyForGate = null;
foreach ($companiesForGate as $c) {
    if (($c['slug'] ?? '') === $slug) {
        $companyForGate = $c;
        break;
    }
}
if (!company_is_verified($companyForGate)) {
    respond(['ok' => false, 'error' => 'Подтвердите email — мы отправили ссылку при регистрации', 'code' => 'EMAIL_NOT_VERIFIED'], 403);
}

$lock = fopen($lockFile, 'c');
if (!$lock || !flock($lock, LOCK_EX)) {
    respond(['ok' => false, 'error' => 'Не удалось заблокировать хранилище'], 500);
}

$state = read_state_split($companyDir);

try {
    if ($action === 'state') {
        respond(['ok' => true, 'state' => public_state($state)]);
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        respond(['ok' => false, 'error' => 'Метод не поддерживается'], 405);
    }

    if ($action === 'checkAdminPin') {
        require_admin_pin($input, $state, $securityFile);
        record_last_login($lastLoginsFile, client_ip(), $slug, $companyForGate['name'] ?? $slug);
        respond(['ok' => true, 'state' => public_state($state)]);
    }

    if ($action === 'requestPinReset') {
        $companies = read_companies($companiesFile);
        $company = null;
        foreach ($companies as $c) {
            if (($c['slug'] ?? '') === $slug) {
                $company = $c;
                break;
            }
        }
        $requestedEmail = strtolower(trim((string)($input['email'] ?? '')));
        $security = read_security($securityFile);
        $cooldownOk = empty($security['lastResetRequestAt'])
            || (time() - strtotime((string)$security['lastResetRequestAt'])) >= RESET_REQUEST_COOLDOWN_SECONDS;

        if ($company && $requestedEmail !== '' && strtolower((string)($company['email'] ?? '')) === $requestedEmail && $cooldownOk) {
            $token = bin2hex(random_bytes(16));
            $security['resetToken'] = $token;
            $security['resetExpires'] = gmdate('c', time() + RESET_TOKEN_TTL_SECONDS);
            $security['lastResetRequestAt'] = gmdate('c');
            write_security($securityFile, $security);

            $baseUrl = base_url();
            send_email(
                $requestedEmail,
                'Timetrack — сброс PIN администратора',
                "Запрошен сброс PIN для компании «{$company['name']}».\n\n"
                . "Перейдите по ссылке, чтобы задать новый PIN (действует 30 минут):\n"
                . "{$baseUrl}/admin.html?c={$slug}&reset={$token}\n\n"
                . "Если вы не запрашивали сброс — просто игнорируйте это письмо."
            );
        }
        // Deliberately generic regardless of match, so the response can't be
        // used to probe which email address a company is registered with.
        respond(['ok' => true, 'message' => 'Если email указан верно, на него отправлена ссылка для сброса PIN']);
    }

    if ($action === 'resetPin') {
        $token = trim((string)($input['resetToken'] ?? ''));
        $newPin = trim((string)($input['newPin'] ?? ''));
        $security = read_security($securityFile);

        $validToken = $token !== '' && !empty($security['resetToken']) && hash_equals((string)$security['resetToken'], $token);
        $notExpired = !empty($security['resetExpires']) && strtotime((string)$security['resetExpires']) > time();

        if (!$validToken || !$notExpired) {
            respond(['ok' => false, 'error' => 'Ссылка для сброса недействительна или устарела'], 403);
        }
        if (strlen($newPin) < 4) {
            respond(['ok' => false, 'error' => 'PIN должен быть не менее 4 символов'], 422);
        }

        $state['settings']['adminPin'] = substr($newPin, 0, 32);
        write_settings($settingsFile, $state);
        write_security($securityFile, default_security());
        respond(['ok' => true]);
    }

    if (in_array($action, ['saveEmployee', 'deleteEmployee', 'updateSettings', 'clearLogs', 'deleteCompany', 'requestTabletAccess'], true)) {
        require_admin_pin($input, $state, $securityFile);
    }

    if ($action === 'requestTabletAccess') {
        $security = read_security($securityFile);
        $security['tabletToken'] = bin2hex(random_bytes(16));
        $security['tabletExpires'] = gmdate('c', time() + TABLET_ACCESS_TTL_SECONDS);
        write_security($securityFile, $security);
        respond(['ok' => true, 'token' => $security['tabletToken'], 'expiresInSeconds' => TABLET_ACCESS_TTL_SECONDS]);
    }

    if ($action === 'verifyTabletAccess') {
        $token = trim((string)($input['token'] ?? ''));
        $security = read_security($securityFile);
        $validToken = $token !== '' && !empty($security['tabletToken']) && hash_equals((string)$security['tabletToken'], $token);
        $notExpired = !empty($security['tabletExpires']) && strtotime((string)$security['tabletExpires']) > time();
        if (!$validToken) {
            respond(['ok' => false, 'error' => 'Код не совпадает с тем, что выдала админка. Создайте новый QR-код и используйте именно его.'], 403);
        }
        if (!$notExpired) {
            respond(['ok' => false, 'error' => 'Срок действия QR-кода истёк. Создайте новый в Настройках.'], 403);
        }
        respond(['ok' => true]);
    }

    if ($action === 'deleteCompany') {
        $confirmSlug = strtolower(trim((string)($input['confirmSlug'] ?? '')));
        if ($confirmSlug !== $slug) {
            respond(['ok' => false, 'error' => 'Введите идентификатор компании точно как показано'], 422);
        }

        $companies = read_companies($companiesFile);
        $companies = array_values(array_filter(
            $companies,
            static fn($company) => ($company['slug'] ?? '') !== $slug
        ));
        write_companies($companiesFile, $companies);

        flock($lock, LOCK_UN);
        fclose($lock);
        $lock = null;

        if (!delete_directory($companyDir)) {
            respond(['ok' => false, 'error' => 'Не удалось удалить данные компании полностью'], 500);
        }

        respond(['ok' => true]);
    }

    if ($action === 'saveEmployee') {
        $employee = normalize_employee($input['employee'] ?? []);
        if ($employee['fname'] === '' || $employee['lname'] === '') {
            respond(['ok' => false, 'error' => 'Имя и фамилия обязательны'], 422);
        }

        $replaced = false;
        foreach ($state['employees'] as $idx => $existing) {
            if (($existing['id'] ?? '') === $employee['id']) {
                $state['employees'][$idx] = $employee;
                $replaced = true;
                break;
            }
        }
        if (!$replaced) {
            $state['employees'][] = $employee;
        }
        write_employees($employeesFile, $state);
        backup_store($companyDir, $employeesFile);
        respond(['ok' => true, 'state' => public_state($state)]);
    }

    if ($action === 'deleteEmployee') {
        $id = clean_id($input['id'] ?? '', 'e');
        $state['employees'] = array_values(array_filter(
            $state['employees'],
            static fn($employee) => ($employee['id'] ?? '') !== $id
        ));
        write_employees($employeesFile, $state);
        respond(['ok' => true, 'state' => public_state($state)]);
    }

    if ($action === 'addLog') {
        $log = normalize_log($input['log'] ?? []);
        if (recent_duplicate($state['logs'], $log)) {
            respond(['ok' => false, 'error' => 'Такая отметка уже была недавно', 'state' => public_state($state)], 409);
        }
        array_unshift($state['logs'], $log);
        $state['logs'] = array_slice($state['logs'], 0, 10000);
        write_logs_file($logsFile, $state);
        respond(['ok' => true, 'state' => public_state($state)]);
    }

    if ($action === 'updateSettings') {
        $state['settings'] = normalize_settings($input['settings'] ?? [], $state['settings']);
        write_settings($settingsFile, $state);
        respond(['ok' => true, 'state' => public_state($state)]);
    }

    if ($action === 'clearLogs') {
        $state['logs'] = [];
        write_logs_file($logsFile, $state);
        respond(['ok' => true, 'state' => public_state($state)]);
    }

    respond(['ok' => false, 'error' => 'Неизвестное действие'], 404);
} finally {
    if (is_resource($lock)) {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}
