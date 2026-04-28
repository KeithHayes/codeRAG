<?php
// assets/php/save_transcript_output.php
header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);
$output = $data['output'] ?? '';

if (empty($output)) {
    echo json_encode(['success' => false, 'error' => 'No output content provided']);
    exit;
}

$transcript_dir = __DIR__ . '/../data/transcripts';

if (!is_dir($transcript_dir)) {
    if (!mkdir($transcript_dir, 0755, true)) {
        echo json_encode(['success' => false, 'error' => 'Failed to create transcripts directory']);
        exit;
    }
}

$file_path = $transcript_dir . '/transcriptoutput.txt';
$result = file_put_contents($file_path, $output);

if ($result === false) {
    echo json_encode(['success' => false, 'error' => 'Failed to save transcript output file']);
    exit;
}

echo json_encode([
    'success' => true,
    'path' => $file_path,
    'size' => $result
]);
?>