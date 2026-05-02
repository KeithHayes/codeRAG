<?php
// assets/php/read_formatted_text.php
// Read the formatted transcript file for use by the pipeline

header('Content-Type: application/json');
error_reporting(0);
ini_set('display_errors', 0);

$transcript_dir = __DIR__ . '/../data/transcripts';
$formatted_path = $transcript_dir . '/formattedtext.txt';
$fallback_path = $transcript_dir . '/sansdisfluencies.txt';

if (file_exists($formatted_path)) {
    $content = file_get_contents($formatted_path);
    
    if ($content !== false && !empty(trim($content))) {
        echo json_encode([
            'success' => true,
            'path' => $formatted_path,
            'length' => strlen($content),
            'content' => $content,
            'source' => 'formatted'
        ]);
        exit;
    }
}

// Fallback to sansdisfluencies.txt
if (file_exists($fallback_path)) {
    $content = file_get_contents($fallback_path);
    
    if ($content !== false && !empty(trim($content))) {
        echo json_encode([
            'success' => true,
            'path' => $fallback_path,
            'length' => strlen($content),
            'content' => $content,
            'source' => 'disfluencies_only'
        ]);
        exit;
    }
}

echo json_encode([
    'success' => false,
    'error' => 'No formatted or disfluency-cleaned transcript available'
]);