<?php
// assets/php/force_reload_model.php - Load model using Ollama REST API
header('Content-Type: application/json');

function ollama_api_request($endpoint, $method = 'GET', $data = null) {
    $url = "http://localhost:11434/api/" . $endpoint;
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3);
    
    if ($data !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    }
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($http_code !== 200) {
        return null;
    }
    return json_decode($response, true);
}

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
if (!is_ollama_running()) {
    echo json_encode([
        'success' => false,
        'message' => 'Stack not running',
        'profile' => $profile,
        'new_model' => $model
    ]);
    exit;
}

// Get currently running model
$ps_data = ollama_api_request('ps');
$current_model = null;
if ($ps_data && isset($ps_data['models']) && !empty($ps_data['models'])) {
    $current_model = $ps_data['models'][0]['name'];
}

// If target already running, return success immediately
if ($current_model === $model) {
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
    $ch = curl_init('http://localhost:11434/api/generate');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['model' => $current_model, 'keep_alive' => 0]));
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    curl_exec($ch);
    curl_close($ch);
    usleep(500000);
}

// Check if model exists
$tags_data = ollama_api_request('tags');
$model_exists = false;
if ($tags_data && isset($tags_data['models'])) {
    foreach ($tags_data['models'] as $m) {
        if ($m['name'] === $model) {
            $model_exists = true;
            break;
        }
    }
}

if (!$model_exists) {
    $ch = curl_init('http://localhost:11434/api/pull');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['model' => $model]));
    curl_setopt($ch, CURLOPT_TIMEOUT, 300);
    curl_exec($ch);
    curl_close($ch);
    sleep(2);
}

// Load the model by sending a keep_alive request
$ch = curl_init('http://localhost:11434/api/generate');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['model' => $model, 'prompt' => '', 'keep_alive' => 3600]));
curl_setopt($ch, CURLOPT_TIMEOUT, 5);
curl_exec($ch);
curl_close($ch);

// Wait for model to load
$loaded = false;
$max_attempts = 60;

for ($i = 0; $i < $max_attempts; $i++) {
    usleep(500000);
    $ps_check = ollama_api_request('ps');
    if ($ps_check && isset($ps_check['models']) && !empty($ps_check['models'])) {
        if ($ps_check['models'][0]['name'] === $model) {
            $loaded = true;
            break;
        }
    }
}

echo json_encode([
    'success' => $loaded,
    'profile' => $profile,
    'old_model' => $current_model,
    'new_model' => $model,
    'status' => $loaded ? 'loaded' : 'loading',
    'message' => $loaded ? "Model loaded" : "Loading model, please wait..."
]);
?>