<?php
// assets/php/save_remove_extra_labels.php
// Save output from remove_extra_labels.py to sansextrasegments.txt

header('Content-Type: application/json');
error_reporting(0);
ini_set('display_errors', 0);

$input = json_decode(file_get_contents('php://input'), true);
$output = $input['output'] ?? '';

if (empty($output)) {
    echo json_encode([
        'success' => false,
        'error' => 'No output content provided'
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

$file_path = $transcript_dir . '/sansextrasegments.txt';
$result = file_put_contents($file_path, $output);

if ($result === false) {
    echo json_encode([
        'success' => false,
        'error' => 'Failed to save file: ' . $file_path
    ]);
    exit;
}

echo json_encode([
    'success' => true,
    'path' => $file_path,
    'size' => $result
]);
?>