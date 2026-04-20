<?php
// assets/php/ollama_api.php - Manage Ollama models and service
// MODIFIED: Uses start.sh and stop.sh scripts per specification
header('Content-Type: application/json');

$action = $_GET['action'] ?? '';
$model = $_GET['model'] ?? '';

// Paths to the required scripts
$START_SCRIPT = '/home/kdog/openwebui/start.sh';
$STOP_SCRIPT = '/home/kdog/openwebui/stop.sh';

try {
    switch ($action) {
        case 'status':
            // Check if Ollama service is running via API
            $output = shell_exec('curl -s http://localhost:11434/api/tags 2>/dev/null');
            if ($output && $output !== '') {
                echo json_encode([
                    'success' => true,
                    'running' => true
                ]);
            } else {
                echo json_encode([
                    'success' => true,
                    'running' => false
                ]);
            }
            break;
            
        case 'start':
            // Start Ollama service using start.sh script
            if (!file_exists($START_SCRIPT)) {
                echo json_encode([
                    'success' => false,
                    'error' => 'start.sh script not found at ' . $START_SCRIPT
                ]);
                break;
            }
            
            // Make sure script is executable
            chmod($START_SCRIPT, 0755);
            
            // Execute the start script (runs in background to avoid timeout)
            $output = [];
            $returnCode = 0;
            exec($START_SCRIPT . ' 2>&1', $output, $returnCode);
            
            if ($returnCode === 0) {
                // Wait a moment for services to initialize
                sleep(2);
                echo json_encode([
                    'success' => true,
                    'message' => 'Open WebUI stack started successfully (Ollama, SearXNG, Open WebUI)'
                ]);
            } else {
                echo json_encode([
                    'success' => false,
                    'error' => 'Failed to start stack',
                    'output' => implode("\n", $output)
                ]);
            }
            break;
            
        case 'stop':
            // Stop Ollama service using stop.sh script
            if (!file_exists($STOP_SCRIPT)) {
                echo json_encode([
                    'success' => false,
                    'error' => 'stop.sh script not found at ' . $STOP_SCRIPT
                ]);
                break;
            }
            
            // Make sure script is executable
            chmod($STOP_SCRIPT, 0755);
            
            // Execute the stop script
            $output = [];
            $returnCode = 0;
            exec($STOP_SCRIPT . ' 2>&1', $output, $returnCode);
            
            if ($returnCode === 0) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Open WebUI stack stopped successfully'
                ]);
            } else {
                echo json_encode([
                    'success' => false,
                    'error' => 'Failed to stop stack',
                    'output' => implode("\n", $output)
                ]);
            }
            break;
            
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
            throw new Exception('Invalid action. Use: status, start, stop, list, check, pull, ps');
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>