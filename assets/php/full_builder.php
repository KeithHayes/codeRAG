<?php
header('Content-Type: application/json');

// Verify AJAX request
if (empty($_SERVER['HTTP_X_REQUESTED_WITH']) || strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) !== 'xmlhttprequest') {
    http_response_code(403);
    echo json_encode(['error' => 'This endpoint only accepts AJAX requests']);
    exit;
}

// Paths
$pythonBinary = '/var/www/html/doomsteadRAG/assets/py/venv/bin/python';
$pythonScript = '/var/www/html/doomsteadRAG/assets/py/full_builder.py';

if (!file_exists($pythonScript)) {
    http_response_code(500);
    echo json_encode(['error' => 'Python script not found']);
    exit;
}

// Command as array
$cmd = [$pythonBinary, $pythonScript];

// Descriptor spec for capturing output
$descriptorspec = [
    1 => ['pipe', 'w'], // stdout
    2 => ['pipe', 'w']  // stderr
];

// Run the process
$process = proc_open($cmd, $descriptorspec, $pipes);

if (is_resource($process)) {
    $stdout = stream_get_contents($pipes[1]);
    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    $exitCode = proc_close($process);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to start Python process']);
    exit;
}

// Return structured JSON response
echo json_encode([
    'success' => $exitCode === 0,
    'exitCode' => $exitCode,
    'stdout' => $stdout,
    'stderr' => $stderr,
]);
