<?php
// assets/php/clean_disfluencies.php
// Clean disfluencies - reads from sanstimestamps.txt, saves to sansdisfluencies.txt

header('Content-Type: application/json');
error_reporting(0);
ini_set('display_errors', 0);

$transcript_dir = __DIR__ . '/../data/transcripts';
$input_path = $transcript_dir . '/sanstimestamps.txt';

if (!file_exists($input_path)) {
    echo json_encode([
        'success' => false,
        'error' => 'Timestamp-cleaned transcript not found at: ' . $input_path
    ]);
    exit;
}

$transcript = file_get_contents($input_path);

if ($transcript === false) {
    echo json_encode([
        'success' => false,
        'error' => 'Failed to read sanstimestamps.txt'
    ]);
    exit;
}

if (empty(trim($transcript))) {
    echo json_encode([
        'success' => false,
        'error' => 'sanstimestamps.txt is empty'
    ]);
    exit;
}

// Try multiple possible Python paths
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

// Path to disfluency cleaner Python script
$python_script = __DIR__ . '/../py/disfluencies.py';

if (!file_exists($python_script)) {
    echo json_encode([
        'success' => false,
        'error' => 'Disfluency cleaner script not found at: ' . $python_script
    ]);
    exit;
}

// Create temporary files for input/output
$temp_input = tempnam(sys_get_temp_dir(), 'transcript_in_');
$temp_output = tempnam(sys_get_temp_dir(), 'transcript_out_');

if ($temp_input === false || $temp_output === false) {
    echo json_encode([
        'success' => false,
        'error' => 'Failed to create temporary files'
    ]);
    exit;
}

file_put_contents($temp_input, $transcript);

// Run the Python script
$cmd = escapeshellcmd($python_binary) . ' ' . 
       escapeshellarg($python_script) . ' ' . 
       escapeshellarg($temp_input) . ' ' . 
       escapeshellarg($temp_output) . ' 2>&1';

exec($cmd, $output, $return_code);

$cleaned = '';
if ($return_code === 0 && file_exists($temp_output)) {
    $cleaned = file_get_contents($temp_output);
}

// Clean up temp files
@unlink($temp_input);
@unlink($temp_output);

if ($return_code !== 0) {
    echo json_encode([
        'success' => false,
        'error' => 'Python script failed with exit code: ' . $return_code,
        'details' => implode("\n", array_slice($output, 0, 5))
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

// Save to sansdisfluencies.txt
$output_path = $transcript_dir . '/sansdisfluencies.txt';
$result = file_put_contents($output_path, $cleaned);

if ($result === false) {
    echo json_encode([
        'success' => false,
        'error' => 'Failed to save disfluency-cleaned transcript to: ' . $output_path
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
?>