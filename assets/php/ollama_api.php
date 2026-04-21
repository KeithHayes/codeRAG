<?php
// assets/php/ollama_api.php - Optimized fast responses with running_model action
header('Content-Type: application/json');
header('Cache-Control: no-cache, must-revalidate');

$action = $_GET['action'] ?? '';

$START_SCRIPT = '/home/kdog/openwebui/start.sh';
$STOP_SCRIPT = '/home/kdog/openwebui/stop.sh';

function is_stack_running() {
    static $cache = null;
    static $cache_time = 0;
    
    $now = time();
    if ($cache !== null && ($now - $cache_time) < 2) {
        return $cache;
    }
    
    $output = shell_exec('docker ps --filter "name=open-webui" --format "{{.Status}}" 2>&1');
    $result = ($output && strpos($output, 'Up') !== false);
    
    $cache = $result;
    $cache_time = $now;
    return $result;
}

function is_ollama_running() {
    $output = shell_exec('docker ps --filter "name=ollama" --format "{{.Status}}" 2>&1');
    return ($output && strpos($output, 'Up') !== false);
}

function get_available_models() {
    $output = shell_exec('docker exec ollama ollama list 2>&1');
    $models = [];
    if ($output) {
        $lines = explode("\n", trim($output));
        foreach ($lines as $line) {
            if (strpos($line, 'NAME') === false && !empty(trim($line))) {
                $parts = preg_split('/\s+/', $line);
                $models[] = ['name' => $parts[0], 'size' => isset($parts[1]) ? $parts[1] : 'unknown'];
            }
        }
    }
    return $models;
}

function get_running_model() {
    $output = shell_exec('docker exec ollama ollama ps 2>&1');
    if ($output && trim($output) !== '' && trim($output) !== 'NAME') {
        $lines = explode("\n", trim($output));
        foreach ($lines as $line) {
            if (strpos($line, 'NAME') === false && !empty(trim($line))) {
                $parts = preg_split('/\s+/', $line);
                return $parts[0];
            }
        }
    }
    return null;
}

try {
    switch ($action) {
        case 'status':
            echo json_encode([
                'success' => true,
                'running' => is_stack_running(),
                'timestamp' => time()
            ]);
            break;
            
        case 'running_model':
            if (!is_ollama_running()) {
                echo json_encode(['success' => false, 'model' => null]);
                break;
            }
            $model = get_running_model();
            echo json_encode(['success' => true, 'model' => $model]);
            break;
            
        case 'start':
            if (!file_exists($START_SCRIPT)) {
                echo json_encode(['success' => false, 'error' => 'start.sh not found']);
                break;
            }
            chmod($START_SCRIPT, 0755);
            exec($START_SCRIPT . ' > /dev/null 2>&1 &');
            
            echo json_encode([
                'success' => true,
                'running' => false,
                'message' => 'Starting stack...'
            ]);
            break;
            
        case 'stop':
            if (!file_exists($STOP_SCRIPT)) {
                echo json_encode(['success' => false, 'error' => 'stop.sh not found']);
                break;
            }
            chmod($STOP_SCRIPT, 0755);
            exec($STOP_SCRIPT . ' > /dev/null 2>&1 &');
            
            echo json_encode([
                'success' => true,
                'running' => false,
                'message' => 'Stopping stack...'
            ]);
            break;
            
        case 'list':
            if (!is_ollama_running()) {
                echo json_encode(['success' => false, 'error' => 'Ollama not running', 'models' => []]);
                break;
            }
            $models = get_available_models();
            echo json_encode(['success' => true, 'models' => $models]);
            break;
            
        default:
            echo json_encode(['success' => false, 'error' => 'Invalid action']);
    }
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>