<?php
// run_format_text.php - Stage 3: Format text into proper sentences and paragraphs
// ASYNC VERSION - Runs in background to avoid 504 timeouts
// Reads: assets/data/transcripts/sansdisfluencies.txt
// Calls: format_text.py
// Writes: assets/data/transcripts/formattedtext.txt

header('Content-Type: application/json');
error_reporting(0);
ini_set('display_errors', 0);

$transcript_dir = __DIR__ . '/../data/transcripts';
$input_path = $transcript_dir . '/sansdisfluencies.txt';
$output_path = $transcript_dir . '/formattedtext.txt';
$status_file = $transcript_dir . '/format_status.json';
$pid_file = $transcript_dir . '/format.pid';
$log_file = $transcript_dir . '/format.log';

// Check if already running
if (file_exists($status_file)) {
    $status = json_decode(file_get_contents($status_file), true);
    if ($status && isset($status['running']) && $status['running'] === true) {
        echo json_encode([
            'success' => true,
            'async' => true,
            'already_running' => true,
            'message' => 'Formatting already in progress',
            'status_endpoint' => 'assets/php/check_format_status.php'
        ]);
        exit;
    }
}

if (!file_exists($input_path)) {
    echo json_encode([
        'success' => false,
        'error' => 'Disfluency-cleaned transcript not found at: ' . $input_path
    ]);
    exit;
}

// Find Python binary
$python_paths = [
    '/var/www/html/doomsteadRAG/venv_rag/bin/python3',
    '/usr/bin/python3',
    '/usr/local/bin/python3',
    trim(shell_exec('which python3 2>/dev/null'))
];

$python_binary = null;
foreach ($python_paths as $path) {
    if ($path && file_exists($path)) {
        $python_binary = $path;
        break;
    }
}

if (!$python_binary) {
    echo json_encode([
        'success' => false,
        'error' => 'Python3 not found'
    ]);
    exit;
}

// Path to Python script
$python_script = __DIR__ . '/../py/format_text.py';

if (!file_exists($python_script)) {
    echo json_encode([
        'success' => false,
        'error' => 'Python script not found at: ' . $python_script
    ]);
    exit;
}

// Initialize status file
$initial_status = [
    'running' => true,
    'completed' => false,
    'start_time' => time(),
    'pid' => null,
    'error' => null,
    'stage' => 'format_text'
];
file_put_contents($status_file, json_encode($initial_status));

// Start background process
$cmd = "nohup " . escapeshellcmd($python_binary) . " " . 
       escapeshellarg($python_script) . " " . 
       escapeshellarg($input_path) . " " . 
       escapeshellarg($output_path) . " >> " . 
       escapeshellarg($log_file) . " 2>&1 & echo $!";

$pid = shell_exec($cmd);
$pid = trim($pid);

// Update status file with PID
$status = [
    'running' => true,
    'completed' => false,
    'start_time' => time(),
    'pid' => $pid,
    'error' => null,
    'stage' => 'format_text'
];
file_put_contents($status_file, json_encode($status));

echo json_encode([
    'success' => true,
    'async' => true,
    'message' => 'Text formatting started in background',
    'pid' => $pid,
    'status_endpoint' => 'assets/php/check_format_status.php'
]);