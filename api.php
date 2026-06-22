<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$baseDataDir = __DIR__ . DIRECTORY_SEPARATOR . 'data';
$companiesFile = $baseDataDir . DIRECTORY_SEPARATOR . 'companies.json';
define('DUPLICATE_WINDOW_SECONDS', 120);

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

function write_state(string $file, array $state): void
{
    file_put_contents(
        $file,
        json_encode($state, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT),
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

    if (!valid_slug($newSlug)) {
        respond(['ok' => false, 'error' => 'Некорректный идентификатор (3-32 символа, латиница, цифры, дефис)'], 422);
    }
    if ($companyName === '') {
        respond(['ok' => false, 'error' => 'Укажите название компании'], 422);
    }
    if (strlen($pin) < 4) {
        respond(['ok' => false, 'error' => 'PIN должен быть не менее 4 символов'], 422);
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
    write_state($companyDir . DIRECTORY_SEPARATOR . 'store.json', $initialState);

    $htaccess = $companyDir . DIRECTORY_SEPARATOR . '.htaccess';
    file_put_contents($htaccess, "Require all denied\n");

    $companies = read_companies($companiesFile);
    $companies[] = [
        'slug' => $newSlug,
        'name' => $companyName,
        'createdAt' => gmdate('c'),
    ];
    write_companies($companiesFile, $companies);

    respond([
        'ok' => true,
        'company' => [
            'slug' => $newSlug,
            'name' => $companyName,
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

// === All other actions require a valid slug ===

if (!valid_slug($slug)) {
    respond(['ok' => false, 'error' => 'Укажите компанию (?c=slug)'], 400);
}

$companyDir = $baseDataDir . DIRECTORY_SEPARATOR . $slug;
if (!is_dir($companyDir)) {
    respond(['ok' => false, 'error' => 'Компания не найдена'], 404);
}

$storeFile = $companyDir . DIRECTORY_SEPARATOR . 'store.json';
$lockFile = $companyDir . DIRECTORY_SEPARATOR . 'store.lock';

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

$lock = fopen($lockFile, 'c');
if (!$lock || !flock($lock, LOCK_EX)) {
    respond(['ok' => false, 'error' => 'Не удалось заблокировать хранилище'], 500);
}

$state = read_state($storeFile);

try {
    if ($action === 'state') {
        respond(['ok' => true, 'state' => public_state($state)]);
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        respond(['ok' => false, 'error' => 'Метод не поддерживается'], 405);
    }

    if ($action === 'checkAdminPin') {
        if (!admin_authorized($input, $state)) {
            respond(['ok' => false, 'error' => 'Неверный PIN админки'], 403);
        }
        respond(['ok' => true, 'state' => public_state($state)]);
    }

    if (in_array($action, ['saveEmployee', 'deleteEmployee', 'updateSettings', 'clearLogs', 'deleteCompany'], true) &&
        !admin_authorized($input, $state)) {
        respond(['ok' => false, 'error' => 'Неверный PIN админки'], 403);
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
        write_state($storeFile, $state);
        respond(['ok' => true, 'state' => public_state($state)]);
    }

    if ($action === 'deleteEmployee') {
        $id = clean_id($input['id'] ?? '', 'e');
        $state['employees'] = array_values(array_filter(
            $state['employees'],
            static fn($employee) => ($employee['id'] ?? '') !== $id
        ));
        write_state($storeFile, $state);
        respond(['ok' => true, 'state' => public_state($state)]);
    }

    if ($action === 'addLog') {
        $log = normalize_log($input['log'] ?? []);
        if (recent_duplicate($state['logs'], $log)) {
            respond(['ok' => false, 'error' => 'Такая отметка уже была недавно', 'state' => public_state($state)], 409);
        }
        array_unshift($state['logs'], $log);
        $state['logs'] = array_slice($state['logs'], 0, 10000);
        write_state($storeFile, $state);
        respond(['ok' => true, 'state' => public_state($state)]);
    }

    if ($action === 'updateSettings') {
        $state['settings'] = normalize_settings($input['settings'] ?? [], $state['settings']);
        write_state($storeFile, $state);
        respond(['ok' => true, 'state' => public_state($state)]);
    }

    if ($action === 'clearLogs') {
        $state['logs'] = [];
        write_state($storeFile, $state);
        respond(['ok' => true, 'state' => public_state($state)]);
    }

    respond(['ok' => false, 'error' => 'Неизвестное действие'], 404);
} finally {
    if (is_resource($lock)) {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}
