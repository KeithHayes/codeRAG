<?php
// assets/php/force_reload_model.php - Optimized fast model loading
header('Content-Type: application/json');

function ollama_docker($cmd) {
    return shell_exec("docker exec ollama ollama " . $cmd . " 2>&1");
}

function is_ollama_container_running() {
    $output = shell_exec('docker ps --filter "name=ollama" --format "{{.Status}}" 2>&1');
    return ($output && strpos($output, 'Up') !== false);
}

// Get current profile
$config_file = __DIR__ . '/../data/config.json';
$profile = 'ragcode';
if (file_exists($config_file)) {
    $config = json_decode(file_get_contents($config_file), true);
    $profile = $config['filesetconfig'] ?? 'ragcode';
}

// Read model from YAML
$yaml_file = __DIR__ . "/../py/{$profile}.yaml";
$model = 'deepseek-coder:6.7b';
if (file_exists($yaml_file)) {
    $content = file_get_contents($yaml_file);
    if (preg_match('/ollama_model:\s*["\']?([^"\'\n]+)["\']?/', $content, $matches)) {
        $model = trim($matches[1]);
    }
}

// Quick check - if Ollama not running, return fast
if (!is_ollama_container_running()) {
    echo json_encode([
        'success' => false,
        'message' => 'Stack not running',
        'profile' => $profile,
        'new_model' => $model
    ]);
    exit;
}

// Get currently running model
$ps_output = ollama_docker("ps");
$current_model = null;
if ($ps_output && trim($ps_output) !== '' && trim($ps_output) !== 'NAME') {
    $lines = explode("\n", trim($ps_output));
    foreach ($lines as $line) {
        if (strpos($line, 'NAME') === false && !empty(trim($line))) {
            $parts = preg_split('/\s+/', $line);
            $current_model = $parts[0];
            break;
        }
    }
}

// If target already running, return success immediately
$ps_output = ollama_docker("ps");
if ($ps_output && strpos($ps_output, $model) !== false && strpos($ps_output, 'Stopping') === false) {
    echo json_encode([
        'success' => true,
        'profile' => $profile,
        'old_model' => $current_model,
        'new_model' => $model,
        'status' => 'already_running'
    ]);
    exit;
}

// Stop current model if different
if ($current_model && $current_model !== $model) {
    ollama_docker("stop " . escapeshellarg($current_model));
    usleep(500000);
}

// Check if model exists
$check_model = ollama_docker("list | grep " . escapeshellarg($model));
if (!$check_model || trim($check_model) === '') {
    ollama_docker("pull " . escapeshellarg($model));
    sleep(1);
}

// Load the model
ollama_docker("run " . escapeshellarg($model) . " > /dev/null 2>&1 &");

// Quick wait for model to load
$loaded = false;
for ($i = 0; $i < 15; $i++) {
    usleep(500000);
    $ps_output = ollama_docker("ps");
    if ($ps_output && strpos($ps_output, $model) !== false && strpos($ps_output, 'Stopping') === false) {
        $loaded = true;
        break;
    }
}

echo json_encode([
    'success' => $loaded,
    'profile' => $profile,
    'old_model' => $current_model,
    'new_model' => $model,
    'status' => $loaded ? 'loaded' : 'timeout',
    'message' => $loaded ? "Model loaded" : "Loading may take longer"
]);
?>