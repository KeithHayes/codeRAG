<?php
// assets/php/force_reload_model.php - Load model with 24h keep_alive
header('Content-Type: application/json');
error_log("=== force_reload_model.php called ===");

function ollama_api_request($endpoint, $method = 'GET', $data = null) {
    $url = "http://localhost:11434/api/" . $endpoint;
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
    
    if ($data !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    }
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    
    if ($http_code !== 200) {
        error_log("Ollama API error: HTTP $http_code - $error");
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
    error_log("is_ollama_running() returned: " . ($http_code === 200 ? "true" : "false"));
    return ($http_code === 200);
}

function get_running_model() {
    $ps_data = ollama_api_request('ps');
    if ($ps_data && isset($ps_data['models']) && !empty($ps_data['models'])) {
        $model_name = $ps_data['models'][0]['name'];
        error_log("get_running_model() found: " . $model_name);
        return $model_name;
    }
    error_log("get_running_model() found no running model");
    return null;
}

function model_exists($model) {
    $tags_data = ollama_api_request('tags');
    if ($tags_data && isset($tags_data['models'])) {
        foreach ($tags_data['models'] as $m) {
            if ($m['name'] === $model) {
                error_log("model_exists() found: " . $model);
                return true;
            }
        }
    }
    error_log("model_exists() not found: " . $model);
    return false;
}

function pull_model($model) {
    error_log("Pulling model: " . $model);
    $ch = curl_init('http://localhost:11434/api/pull');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['model' => $model]));
    curl_setopt($ch, CURLOPT_TIMEOUT, 600);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    error_log("Pull model HTTP code: " . $http_code);
    return ($http_code === 200);
}

function load_model($model) {
    error_log("Loading model: " . $model);
    $ch = curl_init('http://localhost:11434/api/generate');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        'model' => $model,
        'prompt' => 'Hello',
        'stream' => false,
        'keep_alive' => 86400
    ]));
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    
    if ($http_code === 200) {
        error_log("Load model request successful for: " . $model);
        return true;
    }
    error_log("Load model failed for: $model, HTTP $http_code, error: $error");
    return false;
}

// Get current profile
$config_file = __DIR__ . '/../data/config.json';
$profile = 'ragcode';

if (file_exists($config_file)) {
    $config = json_decode(file_get_contents($config_file), true);
    $profile = $config['filesetconfig'] ?? 'ragcode';
    error_log("Profile loaded: " . $profile);
}

// Read model from YAML
$yaml_file = __DIR__ . "/../yaml/{$profile}.yaml";
$model = 'deepseek-coder:6.7b';

if (file_exists($yaml_file)) {
    $content = file_get_contents($yaml_file);
    if (preg_match('/ollama_model:\s*["\']?([^"\'\n]+)["\']?/', $content, $matches)) {
        $model = trim($matches[1]);
        error_log("Model from YAML: " . $model);
    }
}

if (!is_ollama_running()) {
    error_log("Ollama not running");
    echo json_encode([
        'success' => false,
        'message' => 'Ollama service not running',
        'profile' => $profile,
        'new_model' => $model
    ]);
    exit;
}

// Get currently running model
$current_model = get_running_model();
error_log("Current running model: " . ($current_model ?? 'none'));

// If target already running, return success immediately
if ($current_model === $model) {
    error_log("Model already running: " . $model);
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
    error_log("Stopping current model: " . $current_model);
    $ch = curl_init('http://localhost:11434/api/generate');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['model' => $current_model, 'keep_alive' => 0]));
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    curl_exec($ch);
    curl_close($ch);
    sleep(1);
}

// Check if model exists
if (!model_exists($model)) {
    error_log("Model not found, pulling: " . $model);
    if (!pull_model($model)) {
        error_log("Failed to pull model: " . $model);
        echo json_encode([
            'success' => false,
            'message' => "Failed to pull model $model",
            'profile' => $profile
        ]);
        exit;
    }
    sleep(2);
}

// Load model with 24h keep_alive
if (!load_model($model)) {
    error_log("Failed to load model: " . $model);
    echo json_encode([
        'success' => false,
        'message' => "Failed to load model $model",
        'profile' => $profile,
        'new_model' => $model
    ]);
    exit;
}

// Wait for model to actually be running
$loaded = false;
$max_attempts = 60;

for ($i = 0; $i < $max_attempts; $i++) {
    sleep(1);
    $running = get_running_model();
    error_log("Check $i: running model = " . ($running ?? 'none'));
    if ($running === $model) {
        $loaded = true;
        error_log("Model confirmed loaded after " . ($i + 1) . " seconds");
        break;
    }
}

if ($loaded) {
    echo json_encode([
        'success' => true,
        'profile' => $profile,
        'old_model' => $current_model,
        'new_model' => $model,
        'status' => 'loaded',
        'message' => "Model loaded successfully"
    ]);
} else {
    echo json_encode([
        'success' => false,
        'profile' => $profile,
        'old_model' => $current_model,
        'new_model' => $model,
        'status' => 'timeout',
        'message' => "Model load timed out after 60 seconds"
    ]);
}
?>