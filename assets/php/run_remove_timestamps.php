<?php
// run_remove_timestamps.php - Stage 1: Remove timestamps from raw transcript
// Reads: assets/data/transcripts/rawtranscript.txt
// Calls: remove_timestamps.py
// Writes: assets/data/transcripts/sanstimestamps.txt

header('Content-Type: application/json');
error_reporting(0);
ini_set('display_errors', 0);

$transcript_dir = __DIR__ . '/../data/transcripts';
$input_path = $transcript_dir . '/rawtranscript.txt';
$output_path = $transcript_dir . '/sanstimestamps.txt';

// Check if input exists
if (!file_exists($input_path)) {
    echo json_encode([
        'success' => false,
        'error' => 'Raw transcript file not found at: ' . $input_path
    ]);
    exit;
}

$transcript = file_get_contents($input_path);

if ($transcript === false) {
    echo json_encode([
        'success' => false,
        'error' => 'Failed to read raw transcript file'
    ]);
    exit;
}

if (empty(trim($transcript))) {
    echo json_encode([
        'success' => false,
        'error' => 'Raw transcript file is empty'
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
        'error' => 'Python3 not found in any expected location'
    ]);
    exit;
}

// Path to Python script
$python_script = __DIR__ . '/../py/remove_timestamps.py';

if (!file_exists($python_script)) {
    echo json_encode([
        'success' => false,
        'error' => 'Python script not found at: ' . $python_script
    ]);
    exit;
}

// Create temporary file for input (to avoid command line length limits)
$temp_input = tempnam(sys_get_temp_dir(), 'timestamp_in_');
$temp_output = tempnam(sys_get_temp_dir(), 'timestamp_out_');

if ($temp_input === false || $temp_output === false) {
    echo json_encode([
        'success' => false,
        'error' => 'Failed to create temporary files'
    ]);
    exit;
}

file_put_contents($temp_input, $transcript);

// Run Python script
$cmd = escapeshellcmd($python_binary) . ' ' .
       escapeshellarg($python_script) . ' ' .
       escapeshellarg($temp_input) . ' ' .
       escapeshellarg($temp_output) . ' 2>&1';

exec($cmd, $output, $return_code);

// Read result
$cleaned = '';
if ($return_code === 0 && file_exists($temp_output)) {
    $cleaned = file_get_contents($temp_output);
} elseif ($return_code !== 0) {
    // Read error file if exists
    if (file_exists($temp_output)) {
        $cleaned = file_get_contents($temp_output);
    }
}

// Clean up temp files
@unlink($temp_input);
@unlink($temp_output);

if ($return_code !== 0) {
    echo json_encode([
        'success' => false,
        'error' => 'Python script failed with exit code: ' . $return_code,
        'details' => implode("\n", array_slice($output, 0, 10)),
        'output' => $cleaned ?: null
    ]);
    exit;
}

if (empty(trim($cleaned))) {
    echo json_encode([
        'success' => false,
        'error' => 'Python script returned empty output'
    ]);
    exit;
}

// Save to output file
$result = file_put_contents($output_path, $cleaned);

if ($result === false) {
    echo json_encode([
        'success' => false,
        'error' => 'Failed to save cleaned transcript to: ' . $output_path
    ]);
    exit;
}

echo json_encode([
    'success' => true,
    'input_path' => $input_path,
    'output_path' => $output_path,
    'original_length' => strlen($transcript),
    'cleaned_length' => strlen($cleaned)
]);