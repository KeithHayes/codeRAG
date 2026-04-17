<?php
// force_reload_model.php - Stop current model and load from config
header('Content-Type: application/json');

// Get current profile
$config_file = __DIR__ . '/../data/config.json';
$profile = 'ragcode';

if (file_exists($config_file)) {
    $config = json_decode(file_get_contents($config_file), true);
    $profile = $config['filesetconfig'] ?? 'ragcode';
}

// Read model from YAML config
$yaml_file = __DIR__ . "/../py/{$profile}.yaml";
$model = 'deepseek-coder:6.7b'; // default

if (file_exists($yaml_file)) {
    $content = file_get_contents($yaml_file);
    if (preg_match('/ollama_model:\s*["\']?([^"\'\n]+)["\']?/', $content, $matches)) {
        $model = trim($matches[1]);
    }
}

// Get currently running model
$ps_output = shell_exec("ollama ps 2>/dev/null");
$current_model = null;

if (!empty($ps_output)) {
    $lines = explode("\n", $ps_output);
    foreach ($lines as $line) {
        if (strpos($line, 'NAME') === false && !empty(trim($line))) {
            $parts = preg_split('/\s+/', $line);
            if (!empty($parts[0])) {
                $current_model = $parts[0];
                break;
            }
        }
    }
}

// Stop current model if running
if ($current_model) {
    shell_exec("ollama stop {$current_model} 2>/dev/null");
    sleep(2);
}

// Load the new model
shell_exec("ollama run {$model} > /dev/null 2>&1 &");

// Wait for model to load
$loaded = false;
for ($i = 0; $i < 30; $i++) {
    sleep(1);
    $ps_output = shell_exec("ollama ps 2>/dev/null");
    if (!empty($ps_output) && strpos($ps_output, $model) !== false && strpos($ps_output, 'Stopping') === false) {
        $loaded = true;
        break;
    }
}

echo json_encode([
    'success' => $loaded,
    'profile' => $profile,
    'old_model' => $current_model,
    'new_model' => $model,
    'status' => $loaded ? 'loaded' : 'timeout'
]);
