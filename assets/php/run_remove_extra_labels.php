<?php
// assets/php/run_remove_extra_labels.php
// Execute remove_extra_labels.py which reads segmentedtext.txt and writes sansextrasegments.txt

header('Content-Type: application/json');
error_reporting(0);
ini_set('display_errors', 0);

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

$python_script = __DIR__ . '/../py/remove_extra_labels.py';

if (!file_exists($python_script)) {
    echo json_encode([
        'success' => false,
        'error' => 'Python script not found: ' . $python_script
    ]);
    exit;
}

$cmd = escapeshellcmd($python_binary) . ' ' . escapeshellarg($python_script) . ' 2>&1';
exec($cmd, $output, $return_code);

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
    'message' => 'remove_extra_labels.py completed successfully'
]);
?>