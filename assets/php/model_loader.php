<?php

header('Content-Type: application/json');

try {
    $pythonPath = '/var/www/html/doomsteadRAG/assets/py/venv/bin/python3';
    $scriptPath = '/var/www/html/doomsteadRAG/assets/py/model_loader.py';

    if (!file_exists($pythonPath) || !file_exists($scriptPath)) {
        throw new Exception("Python environment not properly configured");
    }

    $command = escapeshellcmd($pythonPath) . ' ' . escapeshellarg($scriptPath);
    $output = trim(shell_exec($command));

    if (empty($output)) {
        throw new Exception("No response from model reader");
    }

    $result = json_decode($output, true);

    if (json_last_error() !== JSON_ERROR_NONE || !isset($result['model'])) {
        throw new Exception("Invalid model data received");
    }

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
