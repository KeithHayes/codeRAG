<?php
// assets/php/remove_timestamps.php
// Remove timestamps from transcript file - reads from rawtranscript.txt, saves to sanstimestamps.txt

header('Content-Type: application/json');
error_reporting(E_ALL);
ini_set('display_errors', 1);

$raw_transcript_path = __DIR__ . '/../data/transcripts/rawtranscript.txt';

if (!file_exists($raw_transcript_path)) {
    http_response_code(404);
    echo json_encode([
        'success' => false,
        'error' => 'Raw transcript file not found at: ' . $raw_transcript_path . '. Please paste a transcript first using the Paste Transcript button.'
    ]);
    exit;
}

$transcript = file_get_contents($raw_transcript_path);

if ($transcript === false) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Failed to read raw transcript file'
    ]);
    exit;
}

if (empty(trim($transcript))) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Raw transcript file is empty'
    ]);
    exit;
}

// Remove timestamp patterns
$lines = explode("\n", $transcript);
$cleaned_lines = [];

foreach ($lines as $line) {
    // Remove lines that contain only a timestamp (e.g., "0:13", "13 seconds", "1 minute, 1 second")
    if (preg_match('/^\d+:\d+$/', trim($line))) {
        continue;
    }
    if (preg_match('/^\d+\s+seconds?$/', trim($line))) {
        continue;
    }
    if (preg_match('/^\d+\s+minutes?,\s+\d+\s+seconds?$/', trim($line))) {
        continue;
    }
    // Remove timestamp prefix from beginning of line
    $line = preg_replace('/^\d+:\d+\s+\d+\s+seconds?\s*/', '', $line);
    $cleaned_lines[] = $line;
}

$cleaned_transcript = implode("\n", $cleaned_lines);

// Create transcripts directory if it doesn't exist
$transcript_dir = __DIR__ . '/../data/transcripts';
if (!is_dir($transcript_dir)) {
    if (!mkdir($transcript_dir, 0755, true)) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Failed to create transcripts directory'
        ]);
        exit;
    }
}

// Save to sanstimestamps.txt
$output_path = $transcript_dir . '/sanstimestamps.txt';
$result = file_put_contents($output_path, $cleaned_transcript);

if ($result === false) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Failed to save timestamp-cleaned transcript to: ' . $output_path
    ]);
    exit;
}

echo json_encode([
    'success' => true,
    'input_path' => $raw_transcript_path,
    'output_path' => $output_path,
    'original_length' => strlen($transcript),
    'cleaned_length' => strlen($cleaned_transcript)
]);
?>