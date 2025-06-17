<?php
// Minimal test script that JUST WORKS
$python = '/var/www/html/doomsteadRAG/assets/py/venv/bin/python3';
$script = '/var/www/html/doomsteadRAG/assets/py/query_doomstead.py';
$testQueries = [
    "There is an elephant named Fred in the room.",
];

foreach ($testQueries as $query) {
    echo "\n=== Testing: '$query' ===\n";
    $output = shell_exec(escapeshellcmd($python).' '.escapeshellarg($script).' --query '.escapeshellarg($query));
    
    if (($data = json_decode($output, true)) !== null) {
        if (isset($data['error'])) {
            echo "ERROR: ".$data['error'];
        } elseif (!empty($data)) {
            foreach ($data as $i => $result) {
                echo "\nResult ".($i+1).":\n";
                echo "Score: ".round($result['score'], 3)."\n";
                echo "Source: ".($result['metadata']['source'] ?? 'unknown')."\n";
                echo substr($result['content'], 0, 200).(strlen($result['content']) > 200 ? '...' : '')."\n";
            }
        } else {
            echo "No results found\n";
        }
    } else {
        echo "Invalid response\n";
    }
}