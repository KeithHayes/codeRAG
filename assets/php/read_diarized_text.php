<?php
// assets/php/read_diarized_text.php
// Read the diarizated transcript file

header('Content-Type: application/json');
error_reporting(0);
ini_set('display_errors', 0);

$transcript_dir = __DIR__ . '/../data/transcripts';
$diarized_path = $transcript_dir . '/diarizatedtext.txt';

if (!file_exists($diarized_path)) {
    $status_file = $transcript_dir . '/diarization_status.json';
    if (file_exists($status_file)) {
        $status = json_decode(file_get_contents($status_file), true);
        if ($status && $status['running'] === true) {
            echo json_encode([
                'success' => false,
                'error' => 'Diarization still in progress, please wait',
                'running' => true
            ]);
            exit;
        }
    }
    
    echo json_encode([
        'success' => false,
        'error' => 'Diarizated text file not found at: ' . $diarized_path
    ]);
    exit;
}

$content = file_get_contents($diarized_path);

if ($content === false || empty(trim($content))) {
    echo json_encode([
        'success' => false,
        'error' => 'Diarizated text file is empty'
    ]);
    exit;
}

echo json_encode([
    'success' => true,
    'path' => $diarized_path,
    'length' => strlen($content),
    'content' => $content
]);
?>