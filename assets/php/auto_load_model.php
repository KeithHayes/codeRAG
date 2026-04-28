<?php
// auto_load_model.php - Load model with 24h keep_alive on page load
header('Content-Type: application/json');

function is_ollama_running() {
    $ch = curl_init('http://localhost:11434/api/tags');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 3);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 2);
    curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ($http_code === 200);
}

function get_running_model() {
    $ch = curl_init('http://localhost:11434/api/ps');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($http_code !== 200 || !$response) {
        return null;
    }
    
    $data = json_decode($response, true);
    if (isset($data['models']) && !empty($data['models'])) {
        return $data['models'][0]['name'];
    }
    return null;
}

// Get current profile
$config_file = __DIR__ . '/../data/config.json';
$profile = 'ragcode';

if (file_exists($config_file)) {
    $config = json_decode(file_get_contents($config_file), true);
    $profile = $config['filesetconfig'] ?? 'ragcode';
}

// Read model from YAML config
$yaml_file = __DIR__ . "/../yaml/{$profile}.yaml";
$model = 'deepseek-coder:6.7b';

if (file_exists($yaml_file)) {
    $content = file_get_contents($yaml_file);
    if (preg_match('/ollama_model:\s*["\']?([^"\'\n]+)["\']?/', $content, $matches)) {
        $model = trim($matches[1]);
    }
}

if (!is_ollama_running()) {
    echo json_encode([
        'success' => false,
        'model' => $model,
        'status' => 'ollama_not_running',
        'profile' => $profile
    ]);
    exit;
}

// Check if model is actually running
$running_model = get_running_model();
$is_running = ($running_model === $model);

if (!$is_running) {
    // Load the model with 24h keep_alive
    $ch = curl_init('http://localhost:11434/api/generate');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        'model' => $model,
        'prompt' => '',
        'stream' => false,
        'keep_alive' => 86400
    ]));
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_exec($ch);
    curl_close($ch);
    
    // Wait for model to actually start running
    $loaded = false;
    for ($i = 0; $i < 30; $i++) {
        sleep(1);
        $current = get_running_model();
        if ($current === $model) {
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
?>