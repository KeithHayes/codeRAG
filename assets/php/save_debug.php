<?php
// assets/php/save_debug.php
header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['stage']) || !isset($input['output'])) {
    echo json_encode(['success' => false, 'error' => 'Missing stage or output']);
    exit;
}

$stage = preg_replace('/[^a-zA-Z0-9_-]/', '', $input['stage']);
$output = $input['output'];
$timestamp = $input['timestamp'] ?? date('Y-m-d H:i:s');

$debug_dir = __DIR__ . '/../data/debug';
if (!is_dir($debug_dir)) {
    if (!mkdir($debug_dir, 0755, true)) {
        echo json_encode(['success' => false, 'error' => 'Failed to create debug directory']);
        exit;
    }
}

$filename = $debug_dir . '/' . $stage . '_output.txt';
$content = "Timestamp: {$timestamp}\n\n{$output}";

$result = file_put_contents($filename, $content);

if ($result === false) {
    echo json_encode(['success' => false, 'error' => 'Failed to save debug file']);
    exit;
}

echo json_encode([
    'success' => true,
    'path' => 'debug/' . $stage . '_output.txt',
    'stage' => $stage
]);
?>