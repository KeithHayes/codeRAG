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
$pyFolder = '/var/www/html/doomsteadRAG/assets/py';

if (!file_exists($pythonScript)) {
    http_response_code(500);
    echo json_encode(['error' => 'Python script not found']);
    exit;
}

// Set permissions for py folder and its contents
try {
    // Set folder permissions
    chmod($pyFolder, 0775);
    
    // Recursively change ownership to www-data
    exec("chown -R www-data:www-data " . escapeshellarg($pyFolder));
    
    // Set executable permissions for all .py files
    exec("find " . escapeshellarg($pyFolder) . " -type f -name '*.py' -exec chmod 775 {} +");
    
    // Set executable permission for the Python binary
    if (file_exists($pythonBinary)) {
        chmod($pythonBinary, 0775);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to set permissions: ' . $e->getMessage()]);
    exit;
}

// Descriptor spec for capturing output
$descriptorspec = [
    1 => ['pipe', 'w'], // stdout
    2 => ['pipe', 'w']  // stderr
];

// Run the process
$process = proc_open([$pythonBinary, $pythonScript], $descriptorspec, $pipes);

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
    'stderr' => $stderr
]);
?>