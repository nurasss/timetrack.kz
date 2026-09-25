<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");

$ALLOWED_ORIGINS = ['https://timetrack.kz', 'https://www.timetrack.kz', 'http://localhost:8787', 'http://127.0.0.1:8787'];
$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($requestOrigin, $ALLOWED_ORIGINS, true)) {
    header('Access-Control-Allow-Origin: ' . $requestOrigin);
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');

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
define('TABLET_ACCESS_TTL_SECONDS', 60);
define('TABLET_DEVICE_TTL_SECONDS', 7776000);
define('ADMIN_SESSION_TTL_SECONDS', 43200);
define('ADMIN_SESSION_MAX', 10);
define('PIN_PBKDF2_ITERATIONS', 600000);
define('MANUAL_PHOTO_MAX_BYTES', 900000);
define('PHOTO_MAX_BYTES', 1200000);
define('PHOTO_MAX_DATA_URL_LENGTH', 1700000);
define('OFFLINE_MAX_AGE_SECONDS', 900);
define('CLOCK_FUTURE_TOLERANCE_SECONDS', 30);
define('PIN_CHANGE_MAX_ATTEMPTS', 5);
define('PIN_CHANGE_LOCKOUT_SECONDS', 900);
define('MANUAL_APPROVAL_MAX_ATTEMPTS', 5);
define('MANUAL_APPROVAL_LOCKOUT_SECONDS', 900);
define('RATE_LIMIT_WINDOW_SECONDS', 900);
define('RATE_LIMIT_MAX', 30);

$smtpConfigFile = __DIR__ . DIRECTORY_SEPARATOR . 'smtp-config.php';
if (is_file($smtpConfigFile)) {
    require_once $smtpConfigFile;
}

if (!is_dir($baseDataDir) && !mkdir($baseDataDir, 0700, true)) {
    respond(['ok' => false, 'error' => 'Не удалось создать каталог данных'], 500);
}
@chmod($baseDataDir, 0700);

function respond(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

set_exception_handler(static function (Throwable $error): void {
    respond(['ok' => false, 'error' => 'Ошибка сервера', 'code' => 'STORAGE_ERROR'], 500);
});

function ensure_private_dir(string $dir): void
{
    if (!is_dir($dir) && !mkdir($dir, 0700, true)) {
        throw new RuntimeException('storage directory');
    }
    @chmod($dir, 0700);
}

function write_atomic(string $file, string $data): void
{
    $dir = dirname($file);
    ensure_private_dir($dir);
    $temp = tempnam($dir, '.tmp-');
    if ($temp === false) {
        throw new RuntimeException('storage temp');
    }
    try {
        if (file_put_contents($temp, $data, LOCK_EX) === false) {
            throw new RuntimeException('storage write');
        }
        @chmod($temp, 0600);
        if (!rename($temp, $file)) {
            throw new RuntimeException('storage rename');
        }
        @chmod($file, 0600);
    } finally {
        if (is_file($temp)) {
            @unlink($temp);
        }
    }
}

function read_json_file(string $file): ?array
{
    if (!is_file($file)) {
        return null;
    }
    @chmod($file, 0600);
    $raw = file_get_contents($file);
    $decoded = json_decode($raw === false ? '' : $raw, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('invalid json');
    }
    return $decoded;
}

function valid_slug(string $slug): bool
{
    return (bool)preg_match('/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/', $slug);
}

function read_companies(string $file): array
{
    $decoded = read_json_file($file);
    return $decoded === null ? [] : array_values($decoded);
}

function write_companies(string $file, array $companies): void
{
    write_atomic($file, (string)json_encode($companies, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
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
            'schedules' => [],
        ],
    ];
}

function read_state(string $file): array
{
    $decoded = read_json_file($file);
    if ($decoded === null) {
        return default_state();
    }
    if (!isset($decoded['employees']) || !is_array($decoded['employees']) || !isset($decoded['logs']) || !is_array($decoded['logs'])) {
        throw new RuntimeException('invalid state');
    }
    $state = array_replace_recursive(default_state(), $decoded);
    $state['employees'] = array_values($state['employees']);
    $state['logs'] = array_values($state['logs']);
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

function manual_photos_dir(string $companyDir): string
{
    return $companyDir . DIRECTORY_SEPARATOR . 'manual_photos';
}

function read_state_split(string $companyDir): array
{
    $employeesPath = employees_file($companyDir);
    $settingsPath = settings_file($companyDir);
    $logsPath = logs_file($companyDir);

    if (is_file($employeesPath) || is_file($settingsPath) || is_file($logsPath)) {
        $employeesRaw = read_json_file($employeesPath);
        $settingsRaw = read_json_file($settingsPath);
        $logsRaw = read_json_file($logsPath);
        if (($employeesRaw !== null && (!isset($employeesRaw['employees']) || !is_array($employeesRaw['employees'])))
            || ($settingsRaw !== null && (!isset($settingsRaw['settings']) || !is_array($settingsRaw['settings'])))
            || ($logsRaw !== null && (!isset($logsRaw['logs']) || !is_array($logsRaw['logs'])))) {
            throw new RuntimeException('invalid split state');
        }
        $defaults = default_state();
        $state = [
            'employees' => $employeesRaw['employees'] ?? [],
            'settings' => $settingsRaw === null ? $defaults['settings'] : array_replace($defaults['settings'], $settingsRaw['settings']),
            'logs' => $logsRaw['logs'] ?? [],
        ];
        return normalize_stored_state($state);
    }

    $legacyFile = $companyDir . DIRECTORY_SEPARATOR . 'store.json';
    $state = normalize_stored_state(read_state($legacyFile));
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
    write_atomic($file, (string)json_encode(['employees' => $state['employees']], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
}

function write_settings(string $file, array $state): void
{
    write_atomic($file, (string)json_encode(['settings' => $state['settings']], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
}

function write_logs_file(string $file, array $state): void
{
    write_atomic($file, (string)json_encode(['logs' => $state['logs']], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
}

function public_state(array $state): array
{
    $out = $state;
    if (isset($out['settings'])) {
        unset($out['settings']['adminPin'], $out['settings']['adminPinHash']);
    }
    return $out;
}

function state_for_role(array $state, string $role): array
{
    $out = public_state($state);
    if ($role === 'owner' || $role === 'admin') {
        return $out;
    }
    if ($role === 'recruiter') {
        $out['logs'] = array_map(static function (array $log): array {
            unset($log['empPhoto'], $log['manualPhoto']);
            return $log;
        }, $out['logs'] ?? []);
        return $out;
    }
    $out['employees'] = array_map(static function (array $employee): array {
        unset($employee['photo'], $employee['descriptor']);
        return $employee;
    }, $out['employees'] ?? []);
    $out['logs'] = array_map(static function (array $log): array {
        unset($log['empPhoto']);
        return $log;
    }, $out['logs'] ?? []);
    return $out;
}

function tablet_state(array $state): array
{
    $timezone = new DateTimeZone('Asia/Qyzylorda');
    $today = (new DateTimeImmutable('now', $timezone))->format('Y-m-d');
    $employees = array_map(static fn(array $employee): array => [
        'id' => $employee['id'] ?? '',
        'fname' => $employee['fname'] ?? '',
        'lname' => $employee['lname'] ?? '',
        'workStart' => $employee['workStart'] ?? '09:00',
        'scheduleId' => $employee['scheduleId'] ?? '',
        'descriptor' => $employee['descriptor'] ?? null,
    ], is_array($state['employees'] ?? null) ? $state['employees'] : []);

    $logs = [];
    foreach (is_array($state['logs'] ?? null) ? $state['logs'] : [] as $log) {
        $logDate = '';
        $timestamp = trim((string)($log['eventTimestamp'] ?? $log['clientTimestamp'] ?? $log['ts'] ?? $log['at'] ?? ''));
        if ($timestamp !== '') {
            try {
                $logDate = (new DateTimeImmutable($timestamp))->setTimezone($timezone)->format('Y-m-d');
            } catch (Throwable $error) {
                $logDate = '';
            }
        }
        if ($logDate === '') {
            $rawDate = trim((string)($log['date'] ?? ''));
            if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $rawDate)) {
                $logDate = $rawDate;
            } elseif (preg_match('/^(\d{2})\.(\d{2})\.(\d{4})$/', $rawDate, $parts)) {
                $logDate = $parts[3] . '-' . $parts[2] . '-' . $parts[1];
            }
        }
        if ($logDate !== $today) {
            continue;
        }
        $logs[] = [
            'id' => $log['id'] ?? '',
            'empId' => $log['empId'] ?? '',
            'type' => $log['type'] ?? '',
            'date' => $log['date'] ?? '',
            'time' => $log['time'] ?? '',
            'ts' => $log['ts'] ?? '',
            'at' => $log['at'] ?? '',
            'manual' => !empty($log['manual']),
            'verification' => !empty($log['manual']) ? 'manual' : '',
        ];
    }

    return [
        'employees' => $employees,
        'logs' => $logs,
        'settings' => [
            'recognitionModel' => ($state['settings']['recognitionModel'] ?? 'tiny') === 'ssd' ? 'ssd' : 'tiny',
            'matchThreshold' => min((float)($state['settings']['matchThreshold'] ?? 0.55), 0.55),
            'lateMinutes' => (int)($state['settings']['lateMinutes'] ?? 15),
            'schedules' => normalize_schedules($state['settings']['schedules'] ?? []),
        ],
    ];
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

function parse_photo_data_url($photo): ?array
{
    $photo = (string)$photo;
    if ($photo === '' || strlen($photo) > PHOTO_MAX_DATA_URL_LENGTH) {
        return null;
    }
    if (!preg_match('/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+\/]+={0,2})$/', $photo, $matches)) {
        return null;
    }
    $encoded = $matches[2];
    if (strlen($encoded) % 4 !== 0) {
        return null;
    }
    $binary = base64_decode($encoded, true);
    if ($binary === false || strlen($binary) < 1 || strlen($binary) > PHOTO_MAX_BYTES || base64_encode($binary) !== $encoded) {
        return null;
    }
    $jpeg = strlen($binary) >= 3 && substr($binary, 0, 3) === "\xff\xd8\xff";
    $png = strlen($binary) >= 8 && substr($binary, 0, 8) === "\x89PNG\r\n\x1a\n";
    $webp = strlen($binary) >= 12 && substr($binary, 0, 4) === 'RIFF' && substr($binary, 8, 4) === 'WEBP';
    if (($matches[1] === 'jpeg' && !$jpeg) || ($matches[1] === 'png' && !$png) || ($matches[1] === 'webp' && !$webp)) {
        return null;
    }
    return ['mime' => 'image/' . $matches[1], 'binary' => $binary, 'dataUrl' => 'data:image/' . $matches[1] . ';base64,' . $encoded];
}

function normalize_photo($photo): ?string
{
    $parsed = parse_photo_data_url($photo);
    return $parsed['dataUrl'] ?? null;
}

function normalize_manual_photo($photo): ?string
{
    $parsed = parse_photo_data_url($photo);
    if ($parsed === null || $parsed['mime'] !== 'image/jpeg' || strlen($parsed['binary']) < 64 || strlen($parsed['binary']) > MANUAL_PHOTO_MAX_BYTES) {
        return null;
    }
    return $parsed['binary'];
}

function manual_photo_path_is_safe(string $relativePath): bool
{
    return (bool)preg_match('/^manual_photos\/[a-zA-Z0-9_.-]+\.jpg$/', $relativePath);
}

function save_manual_photo(string $companyDir, array $log, string $binary): string
{
    $dir = manual_photos_dir($companyDir);
    ensure_private_dir($dir);
    $htaccess = $dir . DIRECTORY_SEPARATOR . '.htaccess';
    if (!is_file($htaccess)) {
        write_atomic($htaccess, "Require all denied\n");
    }
    @chmod($htaccess, 0600);
    $timestamp = strtotime((string)($log['ts'] ?? '')) ?: time();
    $stamp = gmdate('Ymd_His', $timestamp);
    $empId = preg_replace('/[^a-zA-Z0-9_-]/', '', (string)($log['empId'] ?? 'emp')) ?: 'emp';
    $logId = preg_replace('/[^a-zA-Z0-9_-]/', '', (string)($log['id'] ?? 'log')) ?: 'log';
    $filename = "{$stamp}_{$empId}_{$logId}.jpg";
    $target = $dir . DIRECTORY_SEPARATOR . $filename;
    if (is_file($target)) {
        $filename = "{$stamp}_{$empId}_{$logId}_" . bin2hex(random_bytes(3)) . '.jpg';
        $target = $dir . DIRECTORY_SEPARATOR . $filename;
    }
    write_atomic($target, $binary);
    return 'manual_photos/' . $filename;
}

function read_manual_photo_data_url(string $companyDir, string $relativePath): ?string
{
    if (!manual_photo_path_is_safe($relativePath)) {
        return null;
    }
    $root = realpath(manual_photos_dir($companyDir)) ?: manual_photos_dir($companyDir);
    $path = realpath($companyDir . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relativePath));
    if ($path === false || !is_file($path) || strncmp($path, $root . DIRECTORY_SEPARATOR, strlen($root . DIRECTORY_SEPARATOR)) !== 0) {
        return null;
    }
    $binary = file_get_contents($path);
    if ($binary === false) {
        return null;
    }
    $parsed = parse_photo_data_url('data:image/jpeg;base64,' . base64_encode($binary));
    return $parsed !== null && $parsed['mime'] === 'image/jpeg' ? $parsed['dataUrl'] : null;
}

function normalize_employee(array $employee): array
{
    return [
        'id' => clean_id($employee['id'] ?? '', 'e'),
        'fname' => clean_text($employee['fname'] ?? '', 80),
        'lname' => clean_text($employee['lname'] ?? '', 80),
        'iin' => clean_text($employee['iin'] ?? '', 12),
        'position' => clean_text($employee['position'] ?? 'Сотрудник', 100),
        'dept' => clean_text($employee['dept'] ?? 'Общий', 100),
        'workStart' => preg_match('/^\d{2}:\d{2}$/', (string)($employee['workStart'] ?? '09:00'))
            ? (string)$employee['workStart']
            : '09:00',
        'scheduleId' => substr(preg_replace('/[^a-zA-Z0-9_-]/', '', (string)($employee['scheduleId'] ?? '')), 0, 64),
        'photo' => normalize_photo($employee['photo'] ?? null),
        'descriptor' => normalize_descriptor($employee['descriptor'] ?? null),
    ];
}

function normalize_time($value, string $fallback): string
{
    $value = (string)$value;
    return preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $value) ? $value : $fallback;
}

function normalize_schedules($schedules): array
{
    if (!is_array($schedules)) {
        return [];
    }
    $normalized = [];
    foreach (array_slice($schedules, 0, 50) as $index => $schedule) {
        if (!is_array($schedule)) {
            continue;
        }
        $days = array_values(array_unique(array_filter(
            array_map('intval', is_array($schedule['days'] ?? null) ? $schedule['days'] : []),
            static fn(int $day): bool => $day >= 1 && $day <= 7
        )));
        sort($days);
        $start = normalize_time($schedule['start'] ?? '', '09:00');
        $end = normalize_time($schedule['end'] ?? '', '18:00');
        if (!$days || $start >= $end) {
            continue;
        }
        $scheduleId = substr(preg_replace('/[^a-zA-Z0-9_-]/', '', (string)($schedule['id'] ?? '')), 0, 64);
        $normalized[] = [
            'id' => $scheduleId !== '' ? $scheduleId : 's' . ($index + 1),
            'name' => clean_text($schedule['name'] ?? '', 80) ?: 'График ' . ($index + 1),
            'days' => $days,
            'start' => $start,
            'end' => $end,
        ];
    }
    return $normalized;
}

function strict_id($value): string
{
    $value = (string)$value;
    return preg_match('/^[a-zA-Z0-9_-]{1,64}$/', $value) ? $value : '';
}

function kazakhstan_time_parts(int $timestamp): array
{
    $date = (new DateTimeImmutable('@' . $timestamp))->setTimezone(new DateTimeZone('Asia/Qyzylorda'));
    return ['hour' => (int)$date->format('H'), 'minute' => (int)$date->format('i')];
}

function kazakhstan_date_key(int $timestamp): string
{
    return (new DateTimeImmutable('@' . $timestamp))->setTimezone(new DateTimeZone('Asia/Qyzylorda'))->format('Y-m-d');
}

function kazakhstan_display_date(int $timestamp): string
{
    $date = (new DateTimeImmutable('@' . $timestamp))->setTimezone(new DateTimeZone('Asia/Qyzylorda'));
    return $date->format('d.m.Y');
}

function kazakhstan_time_string(int $timestamp): string
{
    $parts = kazakhstan_time_parts($timestamp);
    return sprintf('%02d:%02d', $parts['hour'], $parts['minute']);
}

function attendance_event_timestamp(array $log): int
{
    foreach (['eventTimestamp', 'clientTimestamp', 'ts', 'at'] as $field) {
        $value = strtotime((string)($log[$field] ?? ''));
        if ($value !== false) {
            return $value;
        }
    }
    return 0;
}

function employee_late(array $employee, array $settingsState, int $timestamp): bool
{
    $date = (new DateTimeImmutable('@' . $timestamp))->setTimezone(new DateTimeZone('Asia/Qyzylorda'));
    $weekDay = (int)$date->format('w');
    $weekDay = $weekDay === 0 ? 7 : $weekDay;
    $schedule = null;
    foreach (normalize_schedules($settingsState['schedules'] ?? []) as $candidate) {
        if (($candidate['id'] ?? '') === ($employee['scheduleId'] ?? '') && in_array($weekDay, $candidate['days'] ?? [], true)) {
            $schedule = $candidate;
            break;
        }
    }
    $start = $schedule['start'] ?? ($employee['workStart'] ?? '09:00');
    [$hour, $minute] = array_map('intval', explode(':', $start));
    $current = kazakhstan_time_parts($timestamp);
    $lateMinutes = max(0, min(120, (int)($settingsState['lateMinutes'] ?? 15)));
    return $current['hour'] * 60 + $current['minute'] > $hour * 60 + $minute + $lateMinutes;
}

function normalize_stored_state(array $state): array
{
    $employees = [];
    foreach (is_array($state['employees'] ?? null) ? $state['employees'] : [] as $value) {
        if (!is_array($value)) {
            continue;
        }
        $employee = normalize_employee($value);
        if ($employee['id'] !== '' && $employee['fname'] !== '' && $employee['lname'] !== '') {
            $employees[] = $employee;
        }
    }
    $employeeMap = [];
    foreach ($employees as $employee) {
        $employeeMap[$employee['id']] = $employee;
    }
    $logs = [];
    foreach (is_array($state['logs'] ?? null) ? $state['logs'] : [] as $value) {
        if (!is_array($value)) {
            continue;
        }
        $logId = strict_id($value['id'] ?? '');
        $employeeId = strict_id($value['employeeId'] ?? ($value['empId'] ?? ''));
        $timestamp = strtotime((string)($value['ts'] ?? ($value['at'] ?? ($value['eventTimestamp'] ?? ($value['clientTimestamp'] ?? '')))));
        if ($logId === '' || $employeeId === '' || $timestamp === false) {
            continue;
        }
        $employee = $employeeMap[$employeeId] ?? null;
        $manual = !empty($value['manual']);
        $type = ($value['type'] ?? '') === 'checkout' ? 'checkout' : 'checkin';
        $clientTimestamp = strtotime((string)($value['clientTimestamp'] ?? ''));
        $eventTimestamp = $clientTimestamp !== false ? $clientTimestamp : $timestamp;
        $eventId = preg_match('/^[a-zA-Z0-9_-]{1,96}$/', (string)($value['eventId'] ?? '')) ? (string)$value['eventId'] : '';
        $logs[] = array_filter([
            'id' => $logId,
            'employeeId' => $employeeId,
            'empId' => $employeeId,
            'empName' => $employee ? trim($employee['fname'] . ' ' . $employee['lname']) : clean_text($value['empName'] ?? '', 180),
            'empIin' => $employee['iin'] ?? '',
            'empPhoto' => $employee['photo'] ?? null,
            'type' => $type,
            'time' => kazakhstan_time_string($timestamp),
            'date' => kazakhstan_display_date($timestamp),
            'ts' => gmdate('c', $timestamp),
            'at' => gmdate('c', $timestamp),
            'eventTimestamp' => gmdate('c', $eventTimestamp),
            'isLate' => $type === 'checkin' && $employee ? employee_late($employee, $state['settings'] ?? [], $timestamp) : false,
            'verification' => $manual ? 'manual' : '',
            'manual' => $manual,
            'manualPhoto' => manual_photo_path_is_safe((string)($value['manualPhoto'] ?? '')) ? (string)$value['manualPhoto'] : '',
            'eventId' => $eventId,
            'clientTimestamp' => $clientTimestamp !== false ? gmdate('c', $clientTimestamp) : null,
            'offline' => $clientTimestamp !== false ? true : null,
        ], static fn($item) => $item !== null);
    }
    $normalizedSettings = normalize_settings($state['settings'] ?? [], default_state()['settings']);
    if (isset($state['settings']['adminPin']) && is_string($state['settings']['adminPin'])) {
        $normalizedSettings['adminPin'] = $state['settings']['adminPin'];
    }
    if (isset($state['settings']['adminPinHash']) && is_string($state['settings']['adminPinHash'])) {
        $normalizedSettings['adminPinHash'] = $state['settings']['adminPinHash'];
    }
    return ['employees' => $employees, 'logs' => $logs, 'settings' => $normalizedSettings];
}

function parse_attendance_input($input): array
{
    $input = is_array($input) ? $input : [];
    $logId = strict_id($input['id'] ?? '');
    $employeeId = strict_id($input['employeeId'] ?? ($input['empId'] ?? ''));
    if ($logId === '') {
        return ['ok' => false, 'status' => 422, 'error' => 'Некорректный идентификатор отметки', 'code' => 'INVALID_LOG_ID'];
    }
    if ($employeeId === '') {
        return ['ok' => false, 'status' => 422, 'error' => 'Некорректный идентификатор сотрудника', 'code' => 'INVALID_EMPLOYEE_ID'];
    }
    if (isset($input['employeeId'], $input['empId']) && (string)$input['employeeId'] !== (string)$input['empId']) {
        return ['ok' => false, 'status' => 422, 'error' => 'Идентификатор сотрудника не совпадает', 'code' => 'INVALID_EMPLOYEE_ID'];
    }
    $type = (string)($input['type'] ?? '');
    if (!in_array($type, ['checkin', 'checkout'], true)) {
        return ['ok' => false, 'status' => 422, 'error' => 'Некорректный тип отметки', 'code' => 'INVALID_LOG_TYPE'];
    }
    $offline = ($input['offline'] ?? false) === true;
    if (!$offline && (array_key_exists('clientTimestamp', $input) || array_key_exists('eventId', $input))) {
        return ['ok' => false, 'status' => 422, 'error' => 'Онлайн-отметка не принимает клиентское время', 'code' => 'CLIENT_TIME_NOT_ALLOWED'];
    }
    $eventId = (string)($input['eventId'] ?? '');
    if ($offline && !preg_match('/^[a-zA-Z0-9_-]{1,96}$/', $eventId)) {
        return ['ok' => false, 'status' => 422, 'error' => 'Некорректный eventId', 'code' => 'INVALID_EVENT_ID'];
    }
    $clientTimestamp = $offline ? strtotime((string)($input['clientTimestamp'] ?? '')) : false;
    if ($offline && $clientTimestamp === false) {
        return ['ok' => false, 'status' => 422, 'error' => 'Некорректное клиентское время', 'code' => 'INVALID_CLIENT_TIMESTAMP'];
    }
    return ['ok' => true, 'value' => [
        'id' => $logId,
        'employeeId' => $employeeId,
        'type' => $type,
        'offline' => $offline,
        'eventId' => $offline ? $eventId : '',
        'clientTimestamp' => $offline ? gmdate('c', $clientTimestamp) : '',
    ]];
}

function build_attendance_log(array $input, array $employee, array $state, bool $manual = false): array
{
    $now = time();
    $eventTimestamp = $input['offline'] ? strtotime($input['clientTimestamp']) : $now;
    if ($eventTimestamp === false || $eventTimestamp > $now + CLOCK_FUTURE_TOLERANCE_SECONDS || $eventTimestamp < $now - OFFLINE_MAX_AGE_SECONDS) {
        return ['ok' => false, 'status' => 422, 'error' => 'Отметка находится вне допустимого временного окна', 'code' => 'TIME_WINDOW'];
    }
    $previous = array_values(array_filter($state['logs'] ?? [], static fn(array $log): bool => (string)($log['empId'] ?? '') === $input['employeeId']));
    usort($previous, static function (array $left, array $right): int {
        return attendance_event_timestamp($left) <=> attendance_event_timestamp($right);
    });
    $latest = $previous ? $previous[count($previous) - 1] : null;
    if ($latest !== null && $eventTimestamp < attendance_event_timestamp($latest)) {
        return ['ok' => false, 'status' => 409, 'error' => 'Отметка противоречит более новой последовательности', 'code' => 'OUT_OF_ORDER'];
    }
    $expectedType = $latest !== null && ($latest['type'] ?? '') === 'checkin' ? 'checkout' : 'checkin';
    if ($input['type'] !== $expectedType) {
        return ['ok' => false, 'status' => 409, 'error' => 'Сейчас доступна отметка: ' . ($expectedType === 'checkin' ? 'приход' : 'уход'), 'code' => 'INVALID_SEQUENCE'];
    }
    foreach ($previous as $item) {
        if (($item['type'] ?? '') === $input['type'] && abs(attendance_event_timestamp($item) - $eventTimestamp) <= DUPLICATE_WINDOW_SECONDS) {
            return ['ok' => false, 'status' => 409, 'error' => 'Такая отметка уже была недавно', 'code' => 'DUPLICATE_ATTENDANCE'];
        }
    }
    $log = [
        'id' => $input['id'],
        'employeeId' => $employee['id'],
        'empId' => $employee['id'],
        'empName' => trim($employee['fname'] . ' ' . $employee['lname']),
        'empIin' => $employee['iin'] ?? '',
        'empPhoto' => $employee['photo'] ?? null,
        'type' => $expectedType,
        'time' => kazakhstan_time_string($eventTimestamp),
        'date' => kazakhstan_display_date($eventTimestamp),
        'ts' => gmdate('c', $now),
        'at' => gmdate('c', $now),
        'eventTimestamp' => gmdate('c', $eventTimestamp),
        'isLate' => $expectedType === 'checkin' ? employee_late($employee, $state['settings'] ?? [], $eventTimestamp) : false,
        'verification' => $manual ? 'manual' : '',
        'manual' => $manual,
        'manualPhoto' => '',
    ];
    if ($input['offline']) {
        $log['eventId'] = $input['eventId'];
        $log['clientTimestamp'] = $input['clientTimestamp'];
        $log['offline'] = true;
    }
    return ['ok' => true, 'log' => $log];
}

function normalize_log(array $log): array
{
    $type = ($log['type'] ?? '') === 'checkout' ? 'checkout' : 'checkin';
    $manual = !empty($log['manual']);
    $ts = clean_text($log['ts'] ?? gmdate('c'), 48);
    $timestamp = strtotime($ts);
    if ($timestamp === false) {
        $timestamp = time();
        $ts = gmdate('c', $timestamp);
    }
    return [
        'id' => clean_id($log['id'] ?? '', 'l'),
        'employeeId' => clean_id($log['employeeId'] ?? ($log['empId'] ?? ''), 'e'),
        'empId' => clean_id($log['empId'] ?? ($log['employeeId'] ?? ''), 'e'),
        'empName' => clean_text($log['empName'] ?? '', 180),
        'empIin' => clean_text($log['empIin'] ?? '', 12),
        'empPhoto' => normalize_photo($log['empPhoto'] ?? null),
        'type' => $type,
        'time' => clean_text($log['time'] ?? date('H:i', $timestamp), 24),
        'date' => clean_text($log['date'] ?? date('d.m.Y', $timestamp), 24),
        'ts' => $ts,
        'at' => gmdate('c', $timestamp),
        'eventTimestamp' => gmdate('c', $timestamp),
        'isLate' => !empty($log['isLate']),
        'verification' => $manual ? 'manual' : '',
        'manual' => $manual,
        'manualPhoto' => manual_photo_path_is_safe((string)($log['manualPhoto'] ?? '')) ? (string)$log['manualPhoto'] : '',
    ];
}

function normalize_settings(array $settings, array $current = []): array
{
    return [
        'recognitionModel' => ($settings['recognitionModel'] ?? 'tiny') === 'ssd' ? 'ssd' : 'tiny',
        'matchThreshold' => clean_number($settings['matchThreshold'] ?? 0.55, 0.55, 0.35, 0.55),
        'lateMinutes' => (int)clean_number($settings['lateMinutes'] ?? 15, 15, 0, 120),
        'schedules' => normalize_schedules($settings['schedules'] ?? ($current['schedules'] ?? [])),
    ];
}

// Companies created before this feature shipped have no `emailVerified` key
// at all — treat that as already-verified (grandfathered in), so deploying
// this doesn't lock out existing live companies. Only an explicit `false`
// (set by a fresh registration) blocks access.
function company_is_verified(?array $company): bool
{
    if ($company === null) {
        return false;
    }
    if (!array_key_exists('emailVerified', $company)) {
        return true;
    }
    return $company['emailVerified'] === true;
}

function default_security(): array
{
    return [
        'adminPinHash' => null,
        'ownerLogin' => 'admin',
        'pinChangeRequired' => false,
        'pinUpdatedAt' => null,
        'adminSessions' => [],
        'failedAttempts' => 0,
        'lockUntil' => null,
        'loginAttempts' => [],
        'pinChangeAttempts' => 0,
        'pinChangeLockUntil' => null,
        'manualApprovalAttempts' => 0,
        'manualApprovalLockUntil' => null,
        'resetToken' => null,
        'resetExpires' => null,
        'lastResetRequestAt' => null,
        'verifyToken' => null,
        'verifyExpires' => null,
        'lastVerifyRequestAt' => null,
        'tabletToken' => null,
        'tabletExpires' => null,
        'tabletDevices' => [],
        'users' => [],
    ];
}

function read_security(string $file): array
{
    $decoded = read_json_file($file);
    return $decoded === null ? default_security() : array_replace(default_security(), $decoded);
}

function write_security(string $file, array $security): void
{
    write_atomic($file, (string)json_encode($security, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
}

function valid_new_admin_pin(string $pin): bool
{
    if (!preg_match('/^\d{6,12}$/', $pin)) {
        return false;
    }
    $weak = ['000000', '111111', '123456', '654321', '123123', '121212', '112233', '1234'];
    if (in_array($pin, $weak, true)) {
        return false;
    }
    return count(array_unique(str_split($pin))) > 1;
}

function admin_pin_hash(string $pin): string
{
    $salt = random_bytes(16);
    $hash = hash_pbkdf2('sha256', $pin, $salt, PIN_PBKDF2_ITERATIONS, 32, true);
    return 'pbkdf2-sha256$' . PIN_PBKDF2_ITERATIONS . '$'
        . base64_encode($salt) . '$' . base64_encode($hash);
}

function verify_admin_pin_hash(string $pin, string $encoded): bool
{
    $parts = explode('$', $encoded);
    if (count($parts) !== 4 || $parts[0] !== 'pbkdf2-sha256') {
        return false;
    }
    $iterations = (int)$parts[1];
    $salt = base64_decode($parts[2], true);
    $expected = base64_decode($parts[3], true);
    if ($iterations < 100000 || $iterations > 2000000 || $salt === false || $expected === false || strlen($expected) !== 32) {
        return false;
    }
    $actual = hash_pbkdf2('sha256', $pin, $salt, $iterations, 32, true);
    return hash_equals($expected, $actual);
}

function migrate_admin_credentials(array &$state, string $settingsFile, string $securityFile): array
{
    $security = read_security($securityFile);
    $securityChanged = false;
    $settingsChanged = false;
    $legacyPin = trim((string)($state['settings']['adminPin'] ?? ''));

    if (empty($security['adminPinHash']) && $legacyPin !== '') {
        $security['adminPinHash'] = admin_pin_hash($legacyPin);
        $security['pinChangeRequired'] = !valid_new_admin_pin($legacyPin);
        $security['pinUpdatedAt'] = gmdate('c');
        $securityChanged = true;
    }

    $devices = tablet_devices($security);
    $hashedDevices = array_values(array_filter(
        $devices,
        static fn(array $device): bool => !empty($device['tokenHash'])
    ));
    if (count($hashedDevices) !== count($devices)) {
        $security['tabletDevices'] = $hashedDevices;
        $security['tabletToken'] = null;
        $security['tabletExpires'] = null;
        $securityChanged = true;
    }

    if (array_key_exists('adminPin', $state['settings'])) {
        unset($state['settings']['adminPin']);
        $settingsChanged = true;
    }
    if (array_key_exists('adminPinHash', $state['settings'])) {
        unset($state['settings']['adminPinHash']);
        $settingsChanged = true;
    }

    if ($settingsChanged) {
        write_settings($settingsFile, $state);
    }
    if ($securityChanged) {
        write_security($securityFile, $security);
    }
    return $security;
}

function admin_cookie_name(string $slug): string
{
    return 'tt_admin_' . substr(hash('sha256', $slug), 0, 16);
}

function request_is_https(): bool
{
    if (!empty($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off') {
        return true;
    }
    if (strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https') {
        return true;
    }
    return str_starts_with(strtolower((string)($_SERVER['HTTP_HOST'] ?? '')), 'timetrack.kz')
        || str_starts_with(strtolower((string)($_SERVER['HTTP_HOST'] ?? '')), 'www.timetrack.kz');
}

function set_admin_cookie(string $slug, string $token, int $expires): void
{
    setcookie(admin_cookie_name($slug), $token, [
        'expires' => $expires,
        'path' => '/',
        'secure' => request_is_https(),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
}

function clear_admin_cookie(string $slug): void
{
    setcookie(admin_cookie_name($slug), '', [
        'expires' => time() - 3600,
        'path' => '/',
        'secure' => request_is_https(),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
}

function admin_sessions(array $security): array
{
    return is_array($security['adminSessions'] ?? null) ? $security['adminSessions'] : [];
}

function prune_admin_sessions(array $security): array
{
    $now = time();
    $sessions = array_values(array_filter(
        admin_sessions($security),
        static fn($session): bool => !empty($session['expiresAt']) && strtotime((string)$session['expiresAt']) > $now
    ));
    $security['adminSessions'] = array_slice($sessions, -ADMIN_SESSION_MAX);
    return $security;
}

function users(array $security): array
{
    return is_array($security['users'] ?? null) ? $security['users'] : [];
}

function session_role(array $session): string
{
    $role = (string)($session['role'] ?? 'owner');
    return in_array($role, ['owner', 'admin', 'recruiter', 'accountant'], true) ? $role : 'accountant';
}

function issue_admin_session(string $securityFile, string $slug, bool $pinChangeRequired = false, array $user = ['id' => 'owner', 'role' => 'owner', 'name' => 'Администратор']): array
{
    $security = prune_admin_sessions(read_security($securityFile));
    $token = bin2hex(random_bytes(32));
    $csrfToken = bin2hex(random_bytes(24));
    $expires = time() + ADMIN_SESSION_TTL_SECONDS;
    $sessions = admin_sessions($security);
    $sessions[] = [
        'id' => 'as' . bin2hex(random_bytes(8)),
        'tokenHash' => hash('sha256', $token),
        'csrfToken' => $csrfToken,
        'pinChangeRequired' => $pinChangeRequired,
        'userId' => (string)($user['id'] ?? 'owner'),
        'role' => session_role($user),
        'userName' => clean_text($user['name'] ?? 'Администратор', 80),
        'createdAt' => gmdate('c'),
        'lastSeenAt' => gmdate('c'),
        'expiresAt' => gmdate('c', $expires),
    ];
    $security['adminSessions'] = array_slice($sessions, -ADMIN_SESSION_MAX);
    write_security($securityFile, $security);
    set_admin_cookie($slug, $token, $expires);
    return ['csrfToken' => $csrfToken, 'pinChangeRequired' => $pinChangeRequired];
}

function current_admin_session(array $security, string $slug): ?array
{
    $token = trim((string)($_COOKIE[admin_cookie_name($slug)] ?? ''));
    if ($token === '') {
        return null;
    }
    $tokenHash = hash('sha256', $token);
    foreach (admin_sessions($security) as $index => $session) {
        $storedHash = (string)($session['tokenHash'] ?? '');
        $notExpired = !empty($session['expiresAt']) && strtotime((string)$session['expiresAt']) > time();
        if ($notExpired && $storedHash !== '' && hash_equals($storedHash, $tokenHash)) {
            return ['index' => $index, 'session' => $session];
        }
    }
    return null;
}

function require_admin_session(
    string $securityFile,
    string $slug,
    bool $csrfRequired = false,
    bool $allowPinChange = false
): array {
    $security = prune_admin_sessions(read_security($securityFile));
    $match = current_admin_session($security, $slug);
    if ($match === null) {
        clear_admin_cookie($slug);
        respond(['ok' => false, 'error' => 'Сессия админки истекла. Войдите снова.', 'code' => 'ADMIN_AUTH_REQUIRED'], 401);
    }

    $session = $match['session'];
    $csrfToken = (string)($session['csrfToken'] ?? '');
    if (!empty($session['pinChangeRequired']) && !$allowPinChange) {
        respond([
            'ok' => false,
            'error' => 'Установите новый безопасный PIN для продолжения.',
            'code' => 'PIN_CHANGE_REQUIRED',
            'csrfToken' => $csrfToken,
        ], 428);
    }

    if ($csrfRequired) {
        $provided = trim((string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''));
        if ($provided === '' || $csrfToken === '' || !hash_equals($csrfToken, $provided)) {
            respond(['ok' => false, 'error' => 'Защитный токен запроса недействителен', 'code' => 'CSRF_FAILED'], 403);
        }
    }

    $lastSeenAt = strtotime((string)($session['lastSeenAt'] ?? '')) ?: 0;
    if (time() - $lastSeenAt >= 300) {
        $security['adminSessions'][$match['index']]['lastSeenAt'] = gmdate('c');
        write_security($securityFile, $security);
    }
    return ['security' => $security, 'session' => $session, 'csrfToken' => $csrfToken];
}

function revoke_admin_sessions(string $securityFile, string $slug): void
{
    $security = read_security($securityFile);
    $security['adminSessions'] = [];
    write_security($securityFile, $security);
    clear_admin_cookie($slug);
}

function tablet_devices(array $security): array
{
    return is_array($security['tabletDevices'] ?? null) ? $security['tabletDevices'] : [];
}

function public_tablet_devices(array $security): array
{
    return array_map(static fn(array $device): array => [
        'id' => $device['id'] ?? '',
        'createdAt' => $device['createdAt'] ?? null,
        'lastSeenAt' => $device['lastSeenAt'] ?? null,
        'expiresAt' => $device['expiresAt'] ?? null,
    ], array_values(array_filter(
        tablet_devices($security),
        static fn(array $device): bool => empty($device['revokedAt'])
    )));
}

function tablet_token_hash(string $token): string
{
    return hash('sha256', $token);
}

function require_tablet_device(array $input, string $securityFile): array
{
    $token = trim((string)($input['deviceToken'] ?? $input['tabletDeviceToken'] ?? ''));
    $deviceId = trim((string)($input['deviceId'] ?? $input['tabletDeviceId'] ?? ''));
    if (!preg_match('/^[a-zA-Z0-9_-]{1,64}$/', $deviceId)) {
        respond(['ok' => false, 'error' => 'Идентификатор планшета недействителен', 'code' => 'TABLET_DEVICE_REQUIRED'], 403);
    }
    $security = read_security($securityFile);
    $tokenHash = $token === '' ? '' : tablet_token_hash($token);
    foreach (tablet_devices($security) as $index => $device) {
        $storedHash = (string)($device['tokenHash'] ?? '');
        $notExpired = empty($device['expiresAt']) || strtotime((string)$device['expiresAt']) > time();
        $notRevoked = empty($device['revokedAt']);
        if ((string)($device['id'] ?? '') === $deviceId && $tokenHash !== '' && $storedHash !== '' && $notExpired && $notRevoked && hash_equals($storedHash, $tokenHash)) {
            $lastSeenAt = strtotime((string)($device['lastSeenAt'] ?? '')) ?: 0;
            if (time() - $lastSeenAt >= 300) {
                $security['tabletDevices'][$index]['lastSeenAt'] = gmdate('c');
                write_security($securityFile, $security);
            }
            return $device;
        }
    }
    respond([
        'ok' => false,
        'error' => 'Доступ планшета отозван или истёк. Создайте новый QR-код в админке.',
        'code' => 'TABLET_AUTH_REQUIRED',
    ], 403);
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
function require_admin_pin(array $input, string $securityFile): array
{
    $security = read_security($securityFile);
    $remaining = pin_lock_remaining($security);
    if ($remaining > 0) {
        respond(['ok' => false, 'error' => 'Слишком много попыток входа. Попробуйте через ' . (int)ceil($remaining / 60) . ' мин.'], 429);
    }
    $pin = trim((string)($input['adminPin'] ?? ''));
    $pinHash = (string)($security['adminPinHash'] ?? '');
    if ($pin === '' || $pinHash === '' || !verify_admin_pin_hash($pin, $pinHash)) {
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
    return $security;
}

function backup_store(string $companyDir, string $employeesFile): void
{
    $backupDir = $companyDir . DIRECTORY_SEPARATOR . 'backups';
    ensure_private_dir($backupDir);
    if (is_file($employeesFile)) {
        $target = $backupDir . DIRECTORY_SEPARATOR . 'employees-' . gmdate('Ymd-His') . '.json';
        copy($employeesFile, $target);
        @chmod($target, 0600);
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
function allow_request_rate(string $scope, int $max = RATE_LIMIT_MAX, int $window = RATE_LIMIT_WINDOW_SECONDS): bool
{
    static $buckets = [];
    $ip = client_ip() ?: 'unknown';
    $key = $scope . ':' . hash('sha256', $ip);
    $now = time();
    $active = array_values(array_filter($buckets[$key] ?? [], static fn(int $value): bool => $value > $now - $window));
    if (count($active) >= $max) {
        $buckets[$key] = $active;
        return false;
    }
    $active[] = $now;
    $buckets[$key] = $active;
    return true;
}

function rate_limited(string $scope): void
{
    respond(['ok' => false, 'error' => 'Слишком много запросов: ' . $scope, 'code' => 'RATE_LIMITED'], 429);
}

function login_key(string $login): string
{
    return hash('sha256', strtolower(trim($login)));
}

function user_login_locked(array $security, string $login): bool
{
    $record = $security['loginAttempts'][login_key($login)] ?? [];
    return !empty($record['lockUntil']) && strtotime((string)$record['lockUntil']) > time();
}

function record_user_login_failure(array &$security, string $login): void
{
    $key = login_key($login);
    $record = $security['loginAttempts'][$key] ?? ['attempts' => 0, 'lockUntil' => null];
    $record['attempts'] = (int)($record['attempts'] ?? 0) + 1;
    if ($record['attempts'] >= MAX_PIN_ATTEMPTS) {
        $record['lockUntil'] = gmdate('c', time() + PIN_LOCKOUT_SECONDS);
        $record['attempts'] = 0;
    }
    $security['loginAttempts'][$key] = $record;
}

function clear_user_login_failures(array &$security, string $login): void
{
    unset($security['loginAttempts'][login_key($login)]);
}

function verify_owner_pin(array $input, string $securityFile, string $purpose = 'pin'): array
{
    $security = read_security($securityFile);
    $now = time();
    $lockField = $purpose === 'manual' ? 'manualApprovalLockUntil' : 'pinChangeLockUntil';
    $attemptsField = $purpose === 'manual' ? 'manualApprovalAttempts' : 'pinChangeAttempts';
    $maxAttempts = $purpose === 'manual' ? MANUAL_APPROVAL_MAX_ATTEMPTS : PIN_CHANGE_MAX_ATTEMPTS;
    $lockSeconds = $purpose === 'manual' ? MANUAL_APPROVAL_LOCKOUT_SECONDS : PIN_CHANGE_LOCKOUT_SECONDS;
    $lockedUntil = strtotime((string)($security[$lockField] ?? ''));
    if ($lockedUntil !== false && $lockedUntil > $now) {
        return ['ok' => false, 'status' => 429, 'error' => 'Слишком много попыток. Повторите позже.'];
    }
    $pin = trim((string)($purpose === 'manual' ? ($input['supervisorPin'] ?? $input['currentPin'] ?? '') : ($input['currentPin'] ?? '')));
    if ($pin === '' || empty($security['adminPinHash']) || !verify_admin_pin_hash($pin, (string)$security['adminPinHash'])) {
        $security[$attemptsField] = (int)($security[$attemptsField] ?? 0) + 1;
        if ($security[$attemptsField] >= $maxAttempts) {
            $security[$lockField] = gmdate('c', $now + $lockSeconds);
            $security[$attemptsField] = 0;
        }
        write_security($securityFile, $security);
        return ['ok' => false, 'status' => 403, 'error' => 'Неверный PIN'];
    }
    $security[$attemptsField] = 0;
    $security[$lockField] = null;
    write_security($securityFile, $security);
    return ['ok' => true, 'security' => $security];
}

function append_audit(array &$security, array $entry): void
{
    $audit = is_array($security['auditLog'] ?? null) ? $security['auditLog'] : [];
    $entry['at'] = gmdate('c');
    $audit[] = $entry;
    $security['auditLog'] = array_slice($audit, -500);
}

function read_last_logins(string $file): array
{
    $decoded = read_json_file($file);
    return $decoded === null ? [] : $decoded;
}

function write_last_logins(string $file, array $data): void
{
    write_atomic($file, (string)json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
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

$requestLimits = [
    'register' => [5, 3600],
    'checkAdminPin' => [30, RATE_LIMIT_WINDOW_SECONDS],
    'requestPinReset' => [10, RATE_LIMIT_WINDOW_SECONDS],
    'resetPin' => [10, RATE_LIMIT_WINDOW_SECONDS],
    'confirmEmail' => [20, RATE_LIMIT_WINDOW_SECONDS],
    'resendConfirmation' => [10, RATE_LIMIT_WINDOW_SECONDS],
    'verifyTabletAccess' => [20, RATE_LIMIT_WINDOW_SECONDS],
    'addLog' => [120, RATE_LIMIT_WINDOW_SECONDS],
    'addManualLog' => [30, RATE_LIMIT_WINDOW_SECONDS],
    'changeAdminPin' => [10, RATE_LIMIT_WINDOW_SECONDS],
];
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($requestLimits[$action]) && !allow_request_rate($action, $requestLimits[$action][0], $requestLimits[$action][1])) {
    rate_limited($action);
}

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
    if (!valid_new_admin_pin($pin)) {
        respond(['ok' => false, 'error' => 'PIN должен содержать 6–12 цифр и не быть слишком простым'], 422);
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

    if (!mkdir($companyDir, 0700, true)) {
        respond(['ok' => false, 'error' => 'Не удалось создать компанию'], 500);
    }
    @chmod($companyDir, 0700);

    $initialState = default_state();
    write_employees(employees_file($companyDir), $initialState);
    write_settings(settings_file($companyDir), $initialState);
    write_logs_file(logs_file($companyDir), $initialState);
    if (!is_dir(manual_photos_dir($companyDir))) {
        mkdir(manual_photos_dir($companyDir), 0700, true);
    }
    @chmod(manual_photos_dir($companyDir), 0700);

    $htaccess = $companyDir . DIRECTORY_SEPARATOR . '.htaccess';
    write_atomic($htaccess, "Require all denied\n");
    write_atomic(manual_photos_dir($companyDir) . DIRECTORY_SEPARATOR . '.htaccess', "Require all denied\n");

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
            'adminPinHash' => admin_pin_hash($pin),
            'pinUpdatedAt' => gmdate('c'),
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
        . "После подтверждения откройте админ-панель:\n"
        . "{$baseUrl}/admin.html?c={$newSlug}\n\n"
        . "Планшет подключается позже из настроек админки через QR-код."
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
    respond(['ok' => false, 'error' => 'Публичный каталог компаний отключён'], 404);
}

if ($action === 'whoAmI') {
    respond(['ok' => false, 'error' => 'Автоматическое определение компании отключено'], 404);
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
$security = migrate_admin_credentials($state, $settingsFile, $securityFile);

try {
    if ($action === 'state') {
        $session = require_admin_session($securityFile, $slug);
        $role = session_role($session['session'] ?? []);
        respond([
            'ok' => true,
            'state' => state_for_role($state, $role),
            'csrfToken' => $session['csrfToken'],
            'role' => $role,
            'userName' => (string)($session['session']['userName'] ?? ''),
        ]);
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        respond(['ok' => false, 'error' => 'Метод не поддерживается'], 405);
    }

    if ($action === 'tabletState') {
        require_tablet_device($input, $securityFile);
        respond(['ok' => true, 'state' => tablet_state($state)]);
    }

    if ($action === 'checkAdminPin') {
        $security = read_security($securityFile);
        $login = strtolower(trim((string)($input['login'] ?? '')));
        $password = trim((string)($input['password'] ?? $input['adminPin'] ?? ''));
        $matchedUser = null;
        foreach (users($security) as $user) {
            if (strtolower(trim((string)($user['login'] ?? $user['email'] ?? ''))) === $login) {
                $matchedUser = $user;
                break;
            }
        }
        $ownerLogin = strtolower(trim((string)($security['ownerLogin'] ?? 'admin')));
        if ($matchedUser !== null) {
            if (user_login_locked($security, $login)) {
                respond(['ok' => false, 'error' => 'Слишком много попыток входа', 'code' => 'LOGIN_RATE_LIMITED'], 429);
            }
            if ($password !== '' && verify_admin_pin_hash($password, (string)($matchedUser['passwordHash'] ?? ''))) {
                clear_user_login_failures($security, $login);
                write_security($securityFile, $security);
            } else {
                record_user_login_failure($security, $login);
                write_security($securityFile, $security);
                respond(['ok' => false, 'error' => 'Неверные данные для входа'], 403);
            }
            $sessionUser = $matchedUser;
        } elseif ($login === '' || $login === $ownerLogin) {
            $security = require_admin_pin($input, $securityFile);
            $sessionUser = ['id' => 'owner', 'role' => 'owner', 'name' => 'Администратор'];
        } else {
            respond(['ok' => false, 'error' => 'Неверные данные для входа'], 403);
        }
        $pinChangeRequired = !empty($security['pinChangeRequired']);
        $session = issue_admin_session($securityFile, $slug, $pinChangeRequired, $sessionUser);
        $role = session_role($sessionUser);
        record_last_login($lastLoginsFile, client_ip(), $slug, $companyForGate['name'] ?? $slug);
        if ($pinChangeRequired) {
            respond([
                'ok' => true,
                'pinChangeRequired' => true,
                'csrfToken' => $session['csrfToken'],
                'role' => $role,
                'userName' => (string)($sessionUser['name'] ?? 'Администратор'),
            ]);
        }
        respond([
            'ok' => true,
            'state' => state_for_role($state, $role),
            'csrfToken' => $session['csrfToken'],
            'role' => $role,
            'userName' => (string)($sessionUser['name'] ?? 'Администратор'),
        ]);
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
        if (!valid_new_admin_pin($newPin)) {
            respond(['ok' => false, 'error' => 'PIN должен содержать 6–12 цифр и не быть слишком простым'], 422);
        }

        $security['adminPinHash'] = admin_pin_hash($newPin);
        $security['pinChangeRequired'] = false;
        $security['pinUpdatedAt'] = gmdate('c');
        $security['failedAttempts'] = 0;
        $security['lockUntil'] = null;
        $security['resetToken'] = null;
        $security['resetExpires'] = null;
        $security['adminSessions'] = [];
        write_security($securityFile, $security);
        clear_admin_cookie($slug);
        respond(['ok' => true]);
    }

    if ($action === 'changeAdminPin') {
        $session = require_admin_session($securityFile, $slug, true, true);
        $role = session_role($session['session'] ?? []);
        if (!in_array($role, ['owner', 'admin'], true)) {
            respond(['ok' => false, 'error' => 'Недостаточно прав для смены PIN', 'code' => 'FORBIDDEN'], 403);
        }
        $pinAuth = verify_owner_pin($input, $securityFile, 'pin');
        if (!$pinAuth['ok']) {
            respond(['ok' => false, 'error' => $pinAuth['error'], 'code' => 'CURRENT_PIN_INVALID'], $pinAuth['status']);
        }
        $newPin = trim((string)($input['newPin'] ?? ''));
        if (!valid_new_admin_pin($newPin)) {
            respond(['ok' => false, 'error' => 'PIN должен содержать 6–12 цифр и не быть слишком простым'], 422);
        }
        $security = $pinAuth['security'];
        $security['adminPinHash'] = admin_pin_hash($newPin);
        $security['pinChangeRequired'] = false;
        $security['pinUpdatedAt'] = gmdate('c');
        $security['adminSessions'] = [];
        write_security($securityFile, $security);
        $newSession = issue_admin_session($securityFile, $slug, false, ['id' => 'owner', 'role' => 'owner', 'name' => 'Администратор']);
        respond([
            'ok' => true,
            'state' => state_for_role($state, 'owner'),
            'csrfToken' => $newSession['csrfToken'],
            'role' => 'owner',
            'userName' => 'Администратор',
        ]);
    }

    if ($action === 'logoutAdmin') {
        require_admin_session($securityFile, $slug, true, true);
        $security = read_security($securityFile);
        $match = current_admin_session($security, $slug);
        if ($match !== null) {
            array_splice($security['adminSessions'], (int)$match['index'], 1);
            write_security($securityFile, $security);
        }
        clear_admin_cookie($slug);
        respond(['ok' => true]);
    }

    $adminActions = [
        'saveEmployee',
        'deleteEmployee',
        'updateSettings',
        'clearLogs',
        'deleteCompany',
        'requestTabletAccess',
        'manualPhoto',
        'listTabletDevices',
        'revokeTabletDevice',
        'revokeAllTabletDevices',
    ];
    $adminSession = null;
    if (in_array($action, $adminActions, true)) {
        $adminSession = require_admin_session($securityFile, $slug, true);
    }

    if ($adminSession !== null) {
        $role = session_role($adminSession['session'] ?? []);
        $permitted = in_array($action, ['saveEmployee', 'deleteEmployee'], true)
            ? in_array($role, ['owner', 'admin', 'recruiter'], true)
            : ($action === 'manualPhoto' ? in_array($role, ['owner', 'admin', 'accountant'], true) : in_array($role, ['owner', 'admin'], true));
        if (!$permitted) {
            respond(['ok' => false, 'error' => 'Недостаточно прав для этого действия', 'code' => 'FORBIDDEN'], 403);
        }
    }

    if ($action === 'deleteCompany') {
        require_admin_pin($input, $securityFile);
    }

    if ($action === 'manualPhoto') {
        $relativePath = clean_text($input['path'] ?? '', 180);
        $image = read_manual_photo_data_url($companyDir, $relativePath);
        if ($image === null) {
            respond(['ok' => false, 'error' => 'Фото ручной отметки не найдено'], 404);
        }
        respond(['ok' => true, 'image' => $image]);
    }

    if ($action === 'listTabletDevices') {
        $security = read_security($securityFile);
        respond(['ok' => true, 'devices' => public_tablet_devices($security)]);
    }

    if ($action === 'revokeTabletDevice') {
        $deviceId = clean_id($input['deviceId'] ?? '', 'td');
        $security = read_security($securityFile);
        $security['tabletDevices'] = array_values(array_filter(
            tablet_devices($security),
            static fn(array $device): bool => (string)($device['id'] ?? '') !== $deviceId
        ));
        write_security($securityFile, $security);
        respond(['ok' => true, 'devices' => public_tablet_devices($security)]);
    }

    if ($action === 'revokeAllTabletDevices') {
        $security = read_security($securityFile);
        $security['tabletDevices'] = [];
        $security['tabletToken'] = null;
        $security['tabletExpires'] = null;
        write_security($securityFile, $security);
        respond(['ok' => true, 'devices' => []]);
    }

    if ($action === 'requestTabletAccess') {
        $security = read_security($securityFile);
        $security['tabletToken'] = bin2hex(random_bytes(16));
        $security['tabletExpires'] = gmdate('c', time() + TABLET_ACCESS_TTL_SECONDS);
        $security['tabletDevices'] = tablet_devices($security);
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
        $deviceId = 'td' . bin2hex(random_bytes(8));
        $deviceToken = bin2hex(random_bytes(32));
        $devices = tablet_devices($security);
        $devices[] = [
            'id' => $deviceId,
            'tokenHash' => tablet_token_hash($deviceToken),
            'createdAt' => gmdate('c'),
            'lastSeenAt' => gmdate('c'),
            'expiresAt' => gmdate('c', time() + TABLET_DEVICE_TTL_SECONDS),
        ];
        $security['tabletDevices'] = array_slice($devices, -50);
        $security['tabletToken'] = null;
        $security['tabletExpires'] = null;
        write_security($securityFile, $security);
        respond(['ok' => true, 'deviceId' => $deviceId, 'deviceToken' => $deviceToken, 'state' => tablet_state($state)]);
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

        clear_admin_cookie($slug);
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
        respond(['ok' => true, 'state' => state_for_role($state, session_role($adminSession['session'] ?? []))]);
    }

    if ($action === 'deleteEmployee') {
        $id = clean_id($input['id'] ?? '', 'e');
        $state['employees'] = array_values(array_filter(
            $state['employees'],
            static fn($employee) => ($employee['id'] ?? '') !== $id
        ));
        write_employees($employeesFile, $state);
        respond(['ok' => true, 'state' => state_for_role($state, session_role($adminSession['session'] ?? []))]);
    }

    if ($action === 'addLog') {
        $device = require_tablet_device($input, $securityFile);
        $parsed = parse_attendance_input($input['log'] ?? []);
        if (!$parsed['ok']) {
            respond(['ok' => false, 'error' => $parsed['error'], 'code' => $parsed['code']], $parsed['status']);
        }
        foreach ($state['logs'] as $existingLog) {
            if (($existingLog['id'] ?? '') === $parsed['value']['id']) {
                respond(['ok' => false, 'error' => 'Идентификатор отметки уже использован', 'code' => 'DUPLICATE_LOG_ID', 'state' => tablet_state($state)], 409);
            }
        }
        $employee = null;
        foreach ($state['employees'] as $candidate) {
            if (($candidate['id'] ?? '') === $parsed['value']['employeeId']) {
                $employee = $candidate;
                break;
            }
        }
        if ($employee === null) {
            respond(['ok' => false, 'error' => 'Сотрудник не найден', 'code' => 'UNKNOWN_EMPLOYEE'], 422);
        }
        $built = build_attendance_log($parsed['value'], $employee, $state);
        if (!$built['ok']) {
            respond(['ok' => false, 'error' => $built['error'], 'code' => $built['code'], 'state' => tablet_state($state)], $built['status']);
        }
        array_unshift($state['logs'], $built['log']);
        $state['logs'] = array_slice($state['logs'], 0, 10000);
        write_logs_file($logsFile, $state);
        respond(['ok' => true, 'state' => tablet_state($state)]);
    }

    if ($action === 'addManualLog') {
        $device = require_tablet_device($input, $securityFile);
        $rawLog = is_array($input['log'] ?? null) ? $input['log'] : [];
        if (($rawLog['offline'] ?? false) === true) {
            respond(['ok' => false, 'error' => 'Ручная отметка требует подключения к серверу', 'code' => 'CLIENT_TIME_NOT_ALLOWED'], 422);
        }
        $parsed = parse_attendance_input($rawLog);
        if (!$parsed['ok']) {
            respond(['ok' => false, 'error' => $parsed['error'], 'code' => $parsed['code']], $parsed['status']);
        }
        foreach ($state['logs'] as $existingLog) {
            if (($existingLog['id'] ?? '') === $parsed['value']['id']) {
                respond(['ok' => false, 'error' => 'Идентификатор отметки уже использован', 'code' => 'DUPLICATE_LOG_ID', 'state' => tablet_state($state)], 409);
            }
        }
        $employee = null;
        foreach ($state['employees'] as $candidate) {
            if (($candidate['id'] ?? '') === $parsed['value']['employeeId']) {
                $employee = $candidate;
                break;
            }
        }
        if ($employee === null) {
            respond(['ok' => false, 'error' => 'Сотрудник не найден', 'code' => 'UNKNOWN_EMPLOYEE'], 422);
        }
        $reason = clean_text($input['reason'] ?? ($rawLog['reason'] ?? ''), 240);
        if (strlen($reason) < 3) {
            respond(['ok' => false, 'error' => 'Укажите причину ручной отметки', 'code' => 'REASON_REQUIRED'], 422);
        }
        $pinAuth = verify_owner_pin(['supervisorPin' => $input['supervisorPin'] ?? null, 'currentPin' => $input['currentPin'] ?? null], $securityFile, 'manual');
        if (!$pinAuth['ok']) {
            respond(['ok' => false, 'error' => $pinAuth['error'], 'code' => 'SUPERVISOR_PIN_INVALID'], $pinAuth['status']);
        }
        $photoBinary = normalize_manual_photo($rawLog['manualPhoto'] ?? '');
        if ($photoBinary === null) {
            respond(['ok' => false, 'error' => 'Не удалось получить фото ручной отметки', 'code' => 'INVALID_MANUAL_PHOTO'], 422);
        }
        $built = build_attendance_log($parsed['value'], $employee, $state, true);
        if (!$built['ok']) {
            respond(['ok' => false, 'error' => $built['error'], 'code' => $built['code'], 'state' => tablet_state($state)], $built['status']);
        }
        $built['log']['manualPhoto'] = save_manual_photo($companyDir, $built['log'], $photoBinary);
        array_unshift($state['logs'], $built['log']);
        $state['logs'] = array_slice($state['logs'], 0, 10000);
        write_logs_file($logsFile, $state);
        append_audit($pinAuth['security'], ['action' => 'manualAttendance', 'deviceId' => $device['id'] ?? '', 'logId' => $built['log']['id'], 'employeeId' => $built['log']['employeeId'], 'reason' => $reason]);
        write_security($securityFile, $pinAuth['security']);
        respond(['ok' => true, 'state' => tablet_state($state)]);
    }

    if ($action === 'updateSettings') {
        if (!empty($input['settings']['adminPin']) || !empty($input['settings']['adminPinHash'])) {
            respond(['ok' => false, 'error' => 'Смена PIN требует currentPin', 'code' => 'CURRENT_PIN_REQUIRED'], 422);
        }
        $state['settings'] = normalize_settings($input['settings'] ?? [], $state['settings']);
        write_settings($settingsFile, $state);
        respond(['ok' => true, 'state' => state_for_role($state, session_role($adminSession['session'] ?? [])), 'csrfToken' => (string)($adminSession['csrfToken'] ?? '')]);
    }

    if ($action === 'clearLogs') {
        $state['logs'] = [];
        write_logs_file($logsFile, $state);
        respond(['ok' => true, 'state' => state_for_role($state, session_role($adminSession['session'] ?? []))]);
    }

    respond(['ok' => false, 'error' => 'Неизвестное действие'], 404);
} finally {
    if (is_resource($lock)) {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}
