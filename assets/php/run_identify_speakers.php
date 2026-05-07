<?php
// assets/php/run_identify_speakers.php
// Execute identify_speakers.py which reads sansextrasegments.txt and writes identified_speakers.txt

header('Content-Type: application/json');
error_reporting(0);
ini_set('display_errors', 0);

$transcript_dir = __DIR__ . '/../data/transcripts';
$input_path = $transcript_dir . '/sansextrasegments.txt';
$output_path = $transcript_dir . '/identified_speakers.txt';

if (!file_exists($input_path)) {
    echo json_encode([
        'success' => false,
        'error' => 'Input file not found: ' . $input_path
    ]);
    exit;
}

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

$python_script = __DIR__ . '/../py/identify_speakers.py';

if (!file_exists($python_script)) {
    echo json_encode([
        'success' => false,
        'error' => 'Python script not found: ' . $python_script
    ]);
    exit;
}

$cmd = escapeshellcmd($python_binary) . ' ' . escapeshellarg($python_script) . ' 2>&1';
exec($cmd, $output, $return_code);

$output_length = 0;
if (file_exists($output_path)) {
    $output_length = filesize($output_path);
}

if ($return_code !== 0) {
    echo json_encode([
        'success' => false,
        'error' => 'Python script failed with exit code: ' . $return_code,
        'details' => implode("\n", array_slice($output, 0, 10))
    ]);
    exit;
}

echo json_encode([
    'success' => true,
    'message' => 'identify_speakers.py completed successfully',
    'output_path' => $output_path,
    'output_length' => $output_length
]);
?>