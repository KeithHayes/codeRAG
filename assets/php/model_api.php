<?php

header('Content-Type: application/json');

$pythonPath = '/var/www/html/doomsteadRAG/assets/py/venv/bin/python3';
$scriptBasePath = '/var/www/html/doomsteadRAG/assets/py/';
$action = $_GET['action'] ?? '';

$scriptMap = [
    'check' => 'model_reader.py',
    'load'  => 'model_loader.py'
];

try {

    $scriptPath = $scriptBasePath . $scriptMap[$action];

    $command = escapeshellcmd($pythonPath) . ' ' . escapeshellarg($scriptPath);
    $output = trim(shell_exec($command));
    $result = json_decode($output, true);

    echo json_encode([
        'success' => true,
        'model' => $result['model'],
        'status' => $result['status'] ?? 'unknown',
        'loader' => $result['loader'] ?? 'unknown'
    ]);
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
