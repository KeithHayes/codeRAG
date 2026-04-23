<?php
header('Content-Type: application/json');

if (empty($_SERVER['HTTP_X_REQUESTED_WITH']) || strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) !== 'xmlhttprequest') {
    http_response_code(403);
    echo json_encode(['error' => 'This endpoint only accepts AJAX requests']);
    exit;
}

$config_file = __DIR__ . '/../data/config.json';
$profile = 'ragcode';

if (file_exists($config_file)) {
    $config = json_decode(file_get_contents($config_file), true);
    $profile = $config['filesetconfig'] ?? 'ragcode';
}

$pythonBinary = '/var/www/html/doomsteadRAG/venv_rag/bin/python3';
$pythonScript = '/var/www/html/doomsteadRAG/assets/py/faiss_builder.py';

if (!file_exists($pythonBinary)) {
    $pythonBinary = trim(shell_exec('which python3'));
    if (empty($pythonBinary)) {
        echo json_encode(['success' => false, 'error' => 'Python3 not found']);
        exit;
    }
}

if (!file_exists($pythonScript)) {
    echo json_encode(['success' => false, 'error' => 'FAISS builder script not found']);
    exit;
}

$logFile = __DIR__ . "/../logs/faiss_build_{$profile}.log";
if (file_exists($logFile)) {
    unlink($logFile);
}

$command = escapeshellcmd($pythonBinary) . ' ' . escapeshellarg($pythonScript) . 
           ' --profile ' . escapeshellarg($profile) . ' >> ' . escapeshellarg($logFile) . ' 2>&1 &';

exec($command);

echo json_encode([
    'success' => true,
    'profile' => $profile,
    'message' => 'Build started'
]);
?>