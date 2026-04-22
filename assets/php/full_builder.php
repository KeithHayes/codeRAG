<?php
// assets/php/full_builder.php - Updated for FAISS
header('Content-Type: application/json');

// Verify AJAX request
if (empty($_SERVER['HTTP_X_REQUESTED_WITH']) || strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) !== 'xmlhttprequest') {
    http_response_code(403);
    echo json_encode(['error' => 'This endpoint only accepts AJAX requests']);
    exit;
}

// Get current profile
$config_file = __DIR__ . '/../data/config.json';
$profile = 'ragcode'; // default

if (file_exists($config_file)) {
    $config = json_decode(file_get_contents($config_file), true);
    $profile = $config['filesetconfig'] ?? 'ragcode';
}

// Paths - Updated to use clean venv
$pythonBinary = '/var/www/html/doomsteadRAG/venv_rag/bin/python3';
$pythonScript = '/var/www/html/doomsteadRAG/assets/py/faiss_builder.py';

if (!file_exists($pythonScript)) {
    http_response_code(500);
    echo json_encode(['error' => 'FAISS builder script not found']);
    exit;
}

// Run the builder
$command = escapeshellcmd($pythonBinary) . ' ' . escapeshellarg($pythonScript) . 
           ' --profile ' . escapeshellarg($profile) . ' 2>&1';

// Execute and capture output
$output = shell_exec($command);
$exitCode = $output !== null ? 0 : 1;

// Check if FAISS index was created
$faiss_dir = __DIR__ . "/../data/{$profile}/faiss_index";
$success = file_exists($faiss_dir . '/index.faiss') && file_exists($faiss_dir . '/index.pkl');

echo json_encode([
    'success' => $success,
    'exitCode' => $exitCode,
    'profile' => $profile,
    'output' => $output
]);
?>