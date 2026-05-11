<?php
// assets/php/check_format_status.php
// Check the status of background formatting process

header('Content-Type: application/json');
error_reporting(0);
ini_set('display_errors', 0);

$transcript_dir = __DIR__ . '/../data/transcripts';
$status_file = $transcript_dir . '/format_status.json';
$output_path = $transcript_dir . '/formattedtext.txt';
$log_file = $transcript_dir . '/format.log';

$response = [
    'running' => false,
    'completed' => false,
    'error' => null,
    'output_exists' => false,
    'log_tail' => ''
];

// Get log tail
if (file_exists($log_file)) {
    $lines = file($log_file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $response['log_tail'] = implode("\n", array_slice($lines, -20));
}

if (file_exists($status_file)) {
    $status = json_decode(file_get_contents($status_file), true);
    
    if ($status) {
        $response['running'] = $status['running'] ?? false;
        $response['completed'] = $status['completed'] ?? false;
        $response['error'] = $status['error'] ?? null;
        $response['start_time'] = $status['start_time'] ?? null;
        $response['pid'] = $status['pid'] ?? null;
    }
}

// Check if output was created successfully
if (file_exists($output_path) && filesize($output_path) > 0) {
    $response['output_exists'] = true;
    $response['output_size'] = filesize($output_path);
    
    // If output exists and status says running, update it
    if ($response['running']) {
        $response['running'] = false;
        $response['completed'] = true;
        $updated_status = [
            'running' => false,
            'completed' => true,
            'end_time' => time(),
            'pid' => $response['pid'],
            'error' => null,
            'stage' => 'format_text'
        ];
        file_put_contents($status_file, json_encode($updated_status));
    }
}

// Check if process died but no output
if ($response['running'] && $response['pid']) {
    // Check if process still running
    $pid = $response['pid'];
    $process_running = false;
    
    if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
        $output = shell_exec("tasklist /FI \"PID eq $pid\" 2>NUL");
        $process_running = (strpos($output, (string)$pid) !== false);
    } else {
        $output = shell_exec("ps -p $pid 2>/dev/null");
        $process_running = (strpos($output, (string)$pid) !== false);
    }
    
    if (!$process_running) {
        $response['running'] = false;
        $response['completed'] = true;
        $response['error'] = 'Process terminated unexpectedly';
        $updated_status = [
            'running' => false,
            'completed' => true,
            'end_time' => time(),
            'pid' => $pid,
            'error' => 'Process terminated unexpectedly',
            'stage' => 'format_text'
        ];
        file_put_contents($status_file, json_encode($updated_status));
    }
}

echo json_encode($response);