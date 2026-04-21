// assets/php/rag.php
<?php
// assets/php/rag.php — Doomstead RAG Backend with FAISS + Ollama (Docker fixed)

// Disable error output to prevent breaking JSON
error_reporting(0);
ini_set('display_errors', 0);

class RAGSystem {
    private $ollama_url = "http://localhost:11434";
    private $current_model = "deepseek-coder:6.7b";
    private $model_ready = true;
    private $python_path = '/var/www/html/doomsteadRAG/assets/py/venv/bin/python3';
    private $current_profile = 'ragcode';
    
    public function __construct() {
        $this->load_current_profile();
    }
    
    private function load_current_profile() {
        $config_file = __DIR__ . '/../data/config.json';
        if (file_exists($config_file)) {
            $config = json_decode(file_get_contents($config_file), true);
            $this->current_profile = $config['filesetconfig'] ?? 'ragcode';
        }
        
        // Load model from profile config
        $this->load_model_from_profile();
    }
    
    private function load_model_from_profile() {
        $yaml_file = __DIR__ . "/../py/{$this->current_profile}.yaml";
        if (file_exists($yaml_file)) {
            $content = file_get_contents($yaml_file);
            if (preg_match('/ollama_model:\s*["\']?([^"\'\n]+)["\']?/', $content, $matches)) {
                $this->current_model = trim($matches[1]);
            }
        }
    }
    
    public function errorlog($message) {
        $logfile = __DIR__ . '/../logs/php_error.log';
        $timestamp = date('Y-m-d H:i:s');
        @file_put_contents($logfile, "[$timestamp] $message\n", FILE_APPEND | LOCK_EX);
    }
    
    public function search_vector_store($query, $k = 5) {
        $python_script = realpath(__DIR__ . '/../py/faiss_query.py');
        
        $cmd = escapeshellcmd($this->python_path) . ' ' . escapeshellarg($python_script) .
               ' --profile ' . escapeshellarg($this->current_profile) .
               ' --query ' . escapeshellarg($query) .
               ' --k ' . (int)$k;
        
        $output = shell_exec($cmd . ' 2>&1');
        
        if (!$output) {
            throw new Exception("FAISS search returned no output");
        }
        
        $results = json_decode($output, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception("Failed to decode search results: " . json_last_error_msg());
        }
        
        if (isset($results['error'])) {
            throw new Exception("Search error: " . $results['error']);
        }
        
        return $results ?: [];
    }
    
    public function build_rag_context($vector_results) {
        if (empty($vector_results)) {
            return "No relevant documents found.\n\n";
        }
        
        $context = "Relevant code context:\n\n";
        
        foreach ($vector_results as $i => $doc) {
            $source = basename($doc['metadata']['source'] ?? 'unknown');
            $content = $doc['content'] ?? '';
            $score = $doc['score'] ?? 0;
            
            if (strlen($content) > 800) {
                $content = substr($content, 0, 800) . "...";
            }
            
            $context .= sprintf(
                "[%d] File: %s (relevance: %.2f)\n%s\n\n",
                $i + 1,
                $source,
                $score,
                $content
            );
        }
        
        return $context;
    }
    
    public function query_ollama($prompt) {
        $data = [
            'model' => $this->current_model,
            'messages' => [
                ['role' => 'system', 'content' => 'You are a helpful coding assistant. Answer based on the provided context. Be concise.'],
                ['role' => 'user', 'content' => $prompt]
            ],
            'stream' => false,
            'options' => ['temperature' => 0.3, 'num_predict' => 500]
        ];
        
        $ch = curl_init($this->ollama_url . '/api/chat');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_TIMEOUT, 120);
        
        $response = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        
        if (curl_errno($ch)) {
            $error = curl_error($ch);
            curl_close($ch);
            throw new Exception("Ollama API error: " . $error);
        }
        
        curl_close($ch);
        
        if ($http_code !== 200) {
            throw new Exception("Ollama API returned error code $http_code");
        }
        
        $result = json_decode($response, true);
        
        if (!isset($result['message']['content'])) {
            throw new Exception("Invalid response from Ollama");
        }
        
        return $result['message']['content'];
    }
    
    public function is_model_ready() {
        $ps_output = shell_exec("docker exec ollama ollama ps 2>/dev/null");
        $this->model_ready = ($ps_output && strpos($ps_output, $this->current_model) !== false);
        return ['ready' => $this->model_ready, 'model' => $this->current_model];
    }
    
    public function get_current_model() {
        return $this->current_model;
    }
    
    public function save_transcript($transcript) {
        $transcript_dir = __DIR__ . '/../data/transcripts';
        if (!is_dir($transcript_dir)) {
            if (!mkdir($transcript_dir, 0755, true)) {
                throw new Exception("Failed to create transcripts directory");
            }
        }
        
        $file_path = $transcript_dir . '/rawtranscript.txt';
        $result = file_put_contents($file_path, $transcript);
        
        if ($result === false) {
            throw new Exception("Failed to save transcript file");
        }
        
        return ['success' => true, 'path' => $file_path, 'size' => $result];
    }
}

// Clear any output buffers to prevent corruption
if (ob_get_level()) ob_end_clean();
ob_start();

// Handle requests with switch statement
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json');
    header('Cache-Control: no-cache, must-revalidate');
    
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    // If JSON parsing failed, try form data
    if ($input === null && json_last_error() !== JSON_ERROR_NONE) {
        $action = $_POST['action'] ?? '';
        $message = $_POST['message'] ?? '';
        $transcript = $_POST['transcript'] ?? '';
        $input = ['action' => $action, 'message' => $message, 'transcript' => $transcript];
    }
    
    $action = $input['action'] ?? '';
    $rag = new RAGSystem();
    
    switch ($action) {
        case 'save_transcript':
            $transcript = $input['transcript'] ?? '';
            
            if (empty($transcript)) {
                echo json_encode(['success' => false, 'error' => 'No transcript content provided']);
                break;
            }
            
            try {
                $result = $rag->save_transcript($transcript);
                echo json_encode($result);
            } catch (Exception $e) {
                $rag->errorlog("TRANSCRIPT ERROR: " . $e->getMessage());
                echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            }
            break;
            
        case 'chat':
            $message = $input['message'] ?? '';
            
            if (empty($message)) {
                echo json_encode(['error' => 'No message provided']);
                break;
            }
            
            try {
                $searchResults = $rag->search_vector_store($message);
                $context = $rag->build_rag_context($searchResults);
                $prompt = "Context:\n{$context}\n\nQuestion: {$message}\n\nAnswer based on the code context above:";
                $response = $rag->query_ollama($prompt);
                
                echo json_encode([
                    'response' => $response,
                    'model' => $rag->get_current_model(),
                    'timestamp' => time()
                ]);
            } catch (Exception $e) {
                $rag->errorlog("RAG ERROR: " . $e->getMessage());
                echo json_encode([
                    'response' => 'Error: ' . $e->getMessage(),
                    'model' => 'Error',
                    'timestamp' => time()
                ]);
            }
            break;
            
        case 'status_check':
            $status = $rag->is_model_ready();
            echo json_encode([
                'status' => $status['ready'] ? 'ready' : 'loading',
                'model' => $status['model'],
                'timestamp' => time()
            ]);
            break;
            
        default:
            // Legacy support - if no action specified, treat as chat message
            $message = $input['message'] ?? $_POST['message'] ?? '';
            
            if (!empty($message)) {
                try {
                    $searchResults = $rag->search_vector_store($message);
                    $context = $rag->build_rag_context($searchResults);
                    $prompt = "Context:\n{$context}\n\nQuestion: {$message}\n\nAnswer based on the code context above:";
                    $response = $rag->query_ollama($prompt);
                    
                    echo json_encode([
                        'response' => $response,
                        'model' => $rag->get_current_model(),
                        'timestamp' => time()
                    ]);
                } catch (Exception $e) {
                    $rag->errorlog("RAG ERROR: " . $e->getMessage());
                    echo json_encode([
                        'response' => 'Error: ' . $e->getMessage(),
                        'model' => 'Error',
                        'timestamp' => time()
                    ]);
                }
            } else {
                echo json_encode(['error' => 'Invalid request - missing action or message']);
            }
            break;
    }
    
    ob_end_flush();
    exit;
}

header('HTTP/1.1 400 Bad Request');
echo json_encode(['error' => 'Invalid request method']);
ob_end_flush();
?>