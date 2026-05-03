<?php
// assets/php/read_segmented_text.php
// Read the diarizated transcript file

header('Content-Type: application/json');
error_reporting(0);
ini_set('display_errors', 0);

$transcript_dir = __DIR__ . '/../data/transcripts';
$segmented_path = $transcript_dir . '/segmentedtext.txt';

if (!file_exists($segmented_path)) {
    $status_file = $transcript_dir . '/segmentation_status.json';
    if (file_exists($status_file)) {
        $status = json_decode(file_get_contents($status_file), true);
        if ($status && $status['running'] === true) {
            echo json_encode([
                'success' => false,
                'error' => 'Segmentation still in progress, please wait',
                'running' => true
            ]);
            exit;
        }
    }
    
    echo json_encode([
        'success' => false,
        'error' => 'Segmented text file not found at: ' . $segmented_path
    ]);
    exit;
}

$content = file_get_contents($segmented_path);

if ($content === false || empty(trim($content))) {
    echo json_encode([
        'success' => false,
        'error' => 'Segmented text file is empty'
    ]);
    exit;
}

echo json_encode([
    'success' => true,
    'path' => $segmented_path,
    'length' => strlen($content),
    'content' => $content
]);
?>