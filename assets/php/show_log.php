<?php
// assets/php/show_log.php
header('Content-Type: application/json');

$profile = $_GET['profile'] ?? 'ragcode';
$logFile = __DIR__ . '/../logs/faiss_build_' . $profile . '.log';

if (!file_exists($logFile)) {
    echo json_encode(['line' => 'Waiting for build to start...', 'progress' => 0]);
    exit;
}

$lines = file($logFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
$lastLine = end($lines);

// Parse progress from the log line
$progress = 0;
if ($lastLine) {
    if (preg_match('/batch (\d+)\/(\d+)/', $lastLine, $matches)) {
        $current = (int)$matches[1];
        $total = (int)$matches[2];
        $progress = ($total > 0) ? round(($current / $total) * 100) : 0;
    } elseif (strpos($lastLine, 'Created') !== false && preg_match('/(\d+) chunks/', $lastLine, $matches)) {
        $progress = 10;
    } elseif (strpos($lastLine, 'Building FAISS index') !== false) {
        $progress = 50;
    } elseif (strpos($lastLine, 'Saving FAISS index') !== false) {
        $progress = 90;
    } elseif (strpos($lastLine, 'Build completed successfully') !== false) {
        $progress = 100;
    }
}

echo json_encode([
    'line' => $lastLine ?: 'Build in progress...',
    'progress' => $progress
]);
?>