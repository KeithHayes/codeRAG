<?php
// assets/php/ollama_api.php - Manage Ollama models
header('Content-Type: application/json');

$action = $_GET['action'] ?? '';
$model = $_GET['model'] ?? '';

try {
    switch ($action) {
        case 'list':
            // List all installed models
            $output = shell_exec('curl -s http://localhost:11434/api/tags 2>/dev/null');
            if (!$output) {
                throw new Exception('Ollama service not running');
            }
            
            $data = json_decode($output, true);
            $models = array_map(function($m) {
                return [
                    'name' => $m['name'],
                    'size' => $m['size'],
                    'modified' => $m['modified_at']
                ];
            }, $data['models'] ?? []);
            
            echo json_encode([
                'success' => true,
                'models' => $models
            ]);
            break;
            
        case 'check':
            // Check if specific model is available
            $output = shell_exec('curl -s http://localhost:11434/api/tags 2>/dev/null');
            if (!$output) {
                throw new Exception('Ollama service not running');
            }
            
            $data = json_decode($output, true);
            $model_exists = false;
            $model_info = null;
            
            foreach ($data['models'] ?? [] as $m) {
                if ($m['name'] === $model || strpos($m['name'], $model) === 0) {
                    $model_exists = true;
                    $model_info = $m;
                    break;
                }
            }
            
            echo json_encode([
                'success' => true,
                'available' => $model_exists,
                'model' => $model,
                'info' => $model_info
            ]);
            break;
            
        case 'pull':
            // Pull a model from Ollama registry
            if (empty($model)) {
                throw new Exception('Model name required');
            }
            
            // Run in background
            exec("nohup ollama pull {$model} > /tmp/ollama_pull.log 2>&1 &");
            
            echo json_encode([
                'success' => true,
                'message' => "Pulling model {$model} in background",
                'model' => $model
            ]);
            break;
            
        case 'ps':
            // Show running models
            $output = shell_exec('curl -s http://localhost:11434/api/ps 2>/dev/null');
            if (!$output) {
                throw new Exception('Ollama service not running');
            }
            
            $data = json_decode($output, true);
            echo json_encode([
                'success' => true,
                'running' => $data['models'] ?? []
            ]);
            break;
            
        default:
            throw new Exception('Invalid action. Use: list, check, pull, ps');
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>