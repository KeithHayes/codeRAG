<?php
// assets/php/read_sanstimestamps.php
// Read the timestamp-cleaned transcript file for pipeline processing

header('Content-Type: application/json');
error_reporting(E_ALL);
ini_set('display_errors', 1);

$transcript_dir = __DIR__ . '/../data/transcripts';
$sanstimestamps_path = $transcript_dir . '/sanstimestamps.txt';

if (!file_exists($sanstimestamps_path)) {
    echo json_encode([
        'success' => false,
        'error' => 'Timestamp-cleaned transcript file not found at: ' . $sanstimestamps_path . '. Please run timestamp removal first (right arrow button).'
    ]);
    exit;
}

$content = file_get_contents($sanstimestamps_path);

if ($content === false) {
    echo json_encode([
        'success' => false,
        'error' => 'Failed to read sanstimestamps.txt file'
    ]);
    exit;
}

if (empty(trim($content))) {
    echo json_encode([
        'success' => false,
        'error' => 'sanstimestamps.txt file is empty. Please run timestamp removal on a valid transcript.'
    ]);
    exit;
}

echo json_encode([
    'success' => true,
    'path' => $sanstimestamps_path,
    'length' => strlen($content),
    'content' => $content
]);
?>