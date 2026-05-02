<?php
// assets/php/save_disfluencies.php
// Save disfluency-cleaned transcript to sansdisfluencies.txt

header('Content-Type: application/json');
error_reporting(0);
ini_set('display_errors', 0);

$input = json_decode(file_get_contents('php://input'), true);
$transcript = $input['transcript'] ?? '';

if (empty($transcript)) {
    echo json_encode([
        'success' => false,
        'error' => 'No transcript content provided'
    ]);
    exit;
}

$transcript_dir = __DIR__ . '/../data/transcripts';

if (!is_dir($transcript_dir)) {
    if (!mkdir($transcript_dir, 0755, true)) {
        echo json_encode([
            'success' => false,
            'error' => 'Failed to create transcripts directory'
        ]);
        exit;
    }
}

$file_path = $transcript_dir . '/sansdisfluencies.txt';
$result = file_put_contents($file_path, $transcript);

if ($result === false) {
    echo json_encode([
        'success' => false,
        'error' => 'Failed to save disfluency-cleaned transcript file'
    ]);
    exit;
}

echo json_encode([
    'success' => true,
    'path' => $file_path,
    'size' => $result
]);
?>