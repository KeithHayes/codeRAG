<?php
// assets/php/show_log.php - Get latest log line for build modal
header('Content-Type: application/json');

$profile = $_GET['profile'] ?? 'ragcode';
$logFile = __DIR__ . '/../logs/faiss_build_' . $profile . '.log';

if (!file_exists($logFile)) {
    // Try default log
    $logFile = __DIR__ . '/../logs/vector_build.log';
}

if (!file_exists($logFile)) {
    echo json_encode(['line' => 'Waiting for build to start...']);
    exit;
}

$lines = file($logFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
$lastLine = end($lines);

if ($lastLine === false) {
    echo json_encode(['line' => 'Build starting...']);
} else {
    echo json_encode(['line' => $lastLine]);
}
?>