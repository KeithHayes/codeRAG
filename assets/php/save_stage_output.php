<?php
// save_stage_output.php - Save intermediate pipeline stage output
header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['stage']) || !isset($input['output'])) {
    echo json_encode(['success' => false, 'error' => 'Missing stage or output']);
    exit;
}

$stage = preg_replace('/[^a-zA-Z0-9_-]/', '', $input['stage']);
$output = $input['output'];
$timestamp = $input['timestamp'] ?? date('Y-m-d H:i:s');

$transcript_dir = __DIR__ . '/../data/transcripts';
if (!is_dir($transcript_dir)) {
    if (!mkdir($transcript_dir, 0755, true)) {
        echo json_encode(['success' => false, 'error' => 'Failed to create transcripts directory']);
        exit;
    }
}

$filename = $transcript_dir . '/stage_' . $stage . '.txt';
$content = "Timestamp: {$timestamp}\n\n{$output}";

$result = file_put_contents($filename, $content);

if ($result === false) {
    echo json_encode(['success' => false, 'error' => 'Failed to save stage output']);
    exit;
}

echo json_encode(['success' => true, 'path' => 'transcripts/stage_' . $stage . '.txt']);
?>