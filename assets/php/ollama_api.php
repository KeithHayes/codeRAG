<?php
// assets/php/ollama_api.php - Ollama REST API handler
header('Content-Type: application/json');

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
    return ($http_code === 200);
}

function pull_model($model) {
    error_log("Pulling model: $model");
    $ch = curl_init('http://localhost:11434/api/pull');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['model' => $model]));
    curl_setopt($ch, CURLOPT_TIMEOUT, 600);
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    error_log("Pull model response: HTTP $http_code");
    return ($http_code === 200);
}

function load_model($model) {
    error_log("Loading model: $model");
    $ch = curl_init('http://localhost:11434/api/generate');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        'model' => $model,
        'prompt' => 'Hello',
        'stream' => false,
        'keep_alive' => 3600
    ]));
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($http_code === 200) {
        error_log("Model loaded successfully: $model");
        return true;
    }
    error_log("Failed to load model: $model, HTTP $http_code");
    return false;
}

$action = $_GET['action'] ?? '';

if ($action === 'status') {
    $running = is_ollama_running();
    echo json_encode(['success' => true, 'running' => $running, 'timestamp' => time()]);
    exit;
}

if ($action === 'start') {
    exec('/home/kdog/openwebui/start.sh > /dev/null 2>&1 &');
    echo json_encode(['success' => true, 'message' => 'Stack start initiated']);
    exit;
}

if ($action === 'stop') {
    exec('/home/kdog/openwebui/stop.sh > /dev/null 2>&1 &');
    echo json_encode(['success' => true, 'message' => 'Stack stop initiated']);
    exit;
}

if ($action === 'list') {
    if (!is_ollama_running()) {
        echo json_encode(['success' => false, 'error' => 'Ollama service not running']);
        exit;
    }
    
    $data = ollama_api_request('tags');
    if ($data && isset($data['models'])) {
        $models = [];
        foreach ($data['models'] as $m) {
            $models[] = ['name' => $m['name'], 'size' => $m['size']];
        }
        echo json_encode(['success' => true, 'models' => $models]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Failed to fetch models']);
    }
    exit;
}

if ($action === 'running_model') {
    if (!is_ollama_running()) {
        echo json_encode(['success' => false, 'running' => false]);
        exit;
    }
    
    $ps_data = ollama_api_request('ps');
    if ($ps_data && isset($ps_data['models']) && !empty($ps_data['models'])) {
        echo json_encode(['success' => true, 'model' => $ps_data['models'][0]['name']]);
    } else {
        echo json_encode(['success' => true, 'model' => null]);
    }
    exit;
}

echo json_encode(['success' => false, 'error' => 'Invalid action: ' . $action]);
?>