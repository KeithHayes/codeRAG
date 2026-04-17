<?php
// auto_load_model.php - Load model from config on page refresh
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

// Check if model is actually running (not stopping)
$ps_output = shell_exec("ollama ps 2>/dev/null");
$is_running = false;

if (!empty($ps_output)) {
    $lines = explode("\n", $ps_output);
    foreach ($lines as $line) {
        // Look for model name and ensure it's not "Stopping..."
        if (strpos($line, $model) !== false && strpos($line, 'Stopping') === false) {
            $is_running = true;
            break;
        }
    }
}

if (!$is_running) {
    // Force stop any existing instance
    shell_exec("ollama stop {$model} 2>/dev/null");
    sleep(1);
    
    // Load the model
    shell_exec("ollama run {$model} > /dev/null 2>&1 &");
    
    // Wait for model to actually start running
    $loaded = false;
    for ($i = 0; $i < 30; $i++) {
        sleep(2);
        $ps_output = shell_exec("ollama ps 2>/dev/null");
        if (!empty($ps_output) && strpos($ps_output, $model) !== false && strpos($ps_output, 'Stopping') === false) {
            $loaded = true;
            break;
        }
    }
    
    if (!$loaded) {
        echo json_encode([
            'success' => false,
            'model' => $model,
            'status' => 'timeout',
            'profile' => $profile
        ]);
        exit;
    }
}

echo json_encode([
    'success' => true,
    'model' => $model,
    'status' => 'loaded',
    'profile' => $profile
]);
