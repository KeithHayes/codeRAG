<?php
header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);
$profile = $data['profile'] ?? 'ragcode';
$model = $data['model'] ?? '';

if (empty($model)) {
    echo json_encode(['success' => false, 'error' => 'No model specified']);
    exit;
}

$yaml_file = __DIR__ . "/../yaml/{$profile}.yaml";

if (!file_exists($yaml_file)) {
    echo json_encode(['success' => false, 'error' => "Config file not found: {$yaml_file}"]);
    exit;
}

// Read YAML file
$content = file_get_contents($yaml_file);

// Update ollama_model line
if (preg_match('/ollama_model:\s*["\']?[^"\'\n]+["\']?/', $content)) {
    $new_content = preg_replace('/ollama_model:\s*["\']?[^"\'\n]+["\']?/', 'ollama_model: "' . $model . '"', $content);
} else {
    // Add it if not exists
    $new_content = $content . "\n  ollama_model: \"{$model}\"\n";
}

file_put_contents($yaml_file, $new_content);

echo json_encode(['success' => true, 'model' => $model, 'profile' => $profile]);