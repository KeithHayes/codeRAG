<?php
$logFile = '../../assets/logs/vector_build.log';
if (!file_exists($logFile)) {
    echo json_encode(['line' => 'Log file not found.']);
    exit;
}

$lines = file($logFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
$lastLine = end($lines);
echo json_encode(['line' => $lastLine]);
