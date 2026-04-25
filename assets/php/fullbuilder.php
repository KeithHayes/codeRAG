<?php
// assets/php/fullbuilder.php
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

if (!isset($_SERVER['HTTP_X_REQUESTED_WITH']) || $_SERVER['HTTP_X_REQUESTED_WITH'] !== 'XMLHttpRequest') {
    http_response_code(403);
    echo json_encode(['error' => 'AJAX requests only']);
    exit;
}

$config_file = __DIR__ . '/../data/config.json';
$profile = 'ragcode';

if (file_exists($config_file)) {
    $config = json_decode(file_get_contents($config_file), true);
    $profile = $config['filesetconfig'] ?? 'ragcode';
}

$python_binary = '/var/www/html/doomsteadRAG/venv_rag/bin/python3';
if (!file_exists($python_binary)) {
    $python_binary = trim(shell_exec('which python3'));
}

$python_script = __DIR__ . '/../py/faiss_builder.py';

if (!file_exists($python_script)) {
    echo json_encode(['error' => 'FAISS builder script not found', 'success' => false]);
    exit;
}

$cmd = escapeshellcmd($python_binary) . ' ' . escapeshellarg($python_script) . ' --profile ' . escapeshellarg($profile) . ' 2>&1';
$output = shell_exec($cmd);
$exitCode = shell_exec('echo $?');

$faiss_dir = __DIR__ . "/../data/{$profile}/faiss_index";
$success = file_exists($faiss_dir . '/index.faiss') && file_exists($faiss_dir . '/index.pkl');

echo json_encode([
    'success' => $success,
    'exitCode' => (int)$exitCode,
    'profile' => $profile,
    'output' => $output
]);
?>