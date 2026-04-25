<?php
// assets/php/rag.php — Doomstead RAG Backend with FAISS + Ollama
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../logs/php_errors.log');
ini_set('max_execution_time', 300);
ini_set('memory_limit', '512M');

while (ob_get_level()) {
    ob_end_clean();
}

class RAGSystem {
    private $ollama_url = "http://localhost:11434";
    private $current_model = "";
    private $python_path = '/var/www/html/doomsteadRAG/venv_rag/bin/python3';
    private $current_profile = "";
    private $system_prompt = '';
    private $user_prompt_template = '';
    
    public function __construct() {
        $this->load_current_profile();
    }
    
    private function load_current_profile() {
        $config_file = __DIR__ . '/../data/config.json';
        if (file_exists($config_file)) {
            $config = json_decode(file_get_contents($config_file), true);
            $this->current_profile = $config['filesetconfig'] ?? '';
        }
        
        if (empty($this->current_profile)) {
            throw new Exception("No active profile found in config.json");
        }
        
        $this->load_model_from_profile();
        $this->load_prompts_from_profile();
    }
    
    private function load_model_from_profile() {
        $yaml_file = __DIR__ . "/../yaml/{$this->current_profile}.yaml";
        if (!file_exists($yaml_file)) {
            throw new Exception("YAML config file not found: {$yaml_file}");
        }
        
        $content = file_get_contents($yaml_file);
        if (preg_match('/ollama_model:\s*["\']?([^"\'\n]+)["\']?/', $content, $matches)) {
            $this->current_model = trim($matches[1]);
        } else {
            throw new Exception("ollama_model not found in {$yaml_file}");
        }
    }
    
    private function load_prompts_from_profile() {
        $yaml_file = __DIR__ . "/../yaml/{$this->current_profile}.yaml";
        if (!file_exists($yaml_file)) {
            throw new Exception("YAML config file not found: {$yaml_file}");
        }
        
        $content = file_get_contents($yaml_file);
        
        if (preg_match('/system_prompt:\s*"([^"]+)"/', $content, $matches)) {
            $this->system_prompt = $matches[1];
        } else {
            throw new Exception("system_prompt not found in {$yaml_file}");
        }
        
        if (preg_match('/user_prompt_template:\s*"([^"]+)"/', $content, $matches)) {
            $this->user_prompt_template = $matches[1];
        } else {
            throw new Exception("user_prompt_template not found in {$yaml_file}");
        }
    }
    
    private function is_ollama_running() {
        $ch = curl_init($this->ollama_url . '/api/tags');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 3);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 2);
        curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return ($http_code === 200);
    }
    
    public function search_vector_store($query, $k = 15) {
        if (!file_exists($this->python_path)) {
            $this->python_path = trim(shell_exec('which python3'));
            if (empty($this->python_path)) {
                throw new Exception("Python3 not found");
            }
        }
        
        $python_script = realpath(__DIR__ . '/../py/faiss_query.py');
        
        if (!$python_script || !file_exists($python_script)) {
            throw new Exception("FAISS query script not found");
        }
        
        $cmd = escapeshellcmd($this->python_path) . ' ' . escapeshellarg($python_script) .
               ' --profile ' . escapeshellarg($this->current_profile) .
               ' --query ' . escapeshellarg($query) .
               ' --k ' . (int)$k . ' 2>&1';
        
        $output = shell_exec($cmd);
        
        if ($output === null) {
            return [];
        }
        
        preg_match('/\[\s*\{.*?\}\s*\]/s', $output, $matches);
        
        if (empty($matches)) {
            return [];
        }
        
        $results = json_decode($matches[0], true);
        
        if (json_last_error() !== JSON_ERROR_NONE || !is_array($results)) {
            return [];
        }
        
        // Separate and boost JavaScript results
        $js_results = [];
        $php_results = [];
        $py_results = [];
        $css_results = [];
        $other_results = [];
        
        foreach ($results as $item) {
            $source = $item['metadata']['source'] ?? '';
            $score = $item['score'] ?? 0;
            
            if (strpos($source, '.js') !== false) {
                $item['score'] = min($score * 2.0, 0.99);
                $js_results[] = $item;
            } elseif (strpos($source, '.php') !== false) {
                $item['score'] = min($score * 1.5, 0.99);
                $php_results[] = $item;
            } elseif (strpos($source, '.py') !== false) {
                $item['score'] = min($score * 1.3, 0.99);
                $py_results[] = $item;
            } elseif (strpos($source, '.css') !== false) {
                $item['score'] = $score * 0.5;
                $css_results[] = $item;
            } else {
                $other_results[] = $item;
            }
        }
        
        // Sort each group by score
        usort($js_results, function($a, $b) { return $b['score'] <=> $a['score']; });
        usort($php_results, function($a, $b) { return $b['score'] <=> $a['score']; });
        usort($py_results, function($a, $b) { return $b['score'] <=> $a['score']; });
        usort($css_results, function($a, $b) { return $b['score'] <=> $a['score']; });
        usort($other_results, function($a, $b) { return $b['score'] <=> $a['score']; });
        
        // Merge with priority: JS first, then PHP, then PY, then CSS, then others
        $merged = array_merge($js_results, $php_results, $py_results, $css_results, $other_results);
        
        return array_slice($merged, 0, $k);
    }
    
    public function build_rag_context($vector_results, $query) {
        if (empty($vector_results)) {
            return "No relevant documents found.\n\n";
        }
        
        // Filter and score relevance based on query terms
        $query_terms = explode(' ', strtolower($query));
        $relevant_results = [];
        
        foreach ($vector_results as $doc) {
            $content = strtolower($doc['content']);
            $source = $doc['metadata']['source'] ?? '';
            $score = $doc['score'];
            
            // Calculate term relevance
            $term_matches = 0;
            foreach ($query_terms as $term) {
                if (strpos($content, $term) !== false) {
                    $term_matches++;
                }
            }
            
            $relevance = $score + ($term_matches * 0.05);
            
            // Boost JavaScript files
            if (strpos($source, '.js') !== false) {
                $relevance += 0.2;
            }
            
            $relevant_results[] = [
                'doc' => $doc,
                'relevance' => $relevance
            ];
        }
        
        // Sort by our calculated relevance
        usort($relevant_results, function($a, $b) {
            return $b['relevance'] <=> $a['relevance'];
        });
        
        // Take top 5 most relevant
        $relevant_results = array_slice($relevant_results, 0, 5);
        
        $context = "=== CODE CONTEXT ===\n\n";
        
        foreach ($relevant_results as $item) {
            $doc = $item['doc'];
            $source = basename($doc['metadata']['source'] ?? 'unknown');
            $content = $doc['content'];
            $score = $doc['score'];
            
            if (strlen($content) > 1000) {
                $content = substr($content, 0, 1000) . "...";
            }
            
            $context .= sprintf(
                "[%s] (score: %.2f)\n%s\n\n---\n\n",
                $source,
                $score,
                $content
            );
        }
        
        return $context;
    }
    
    public function build_prompt($question, $context) {
        return str_replace(
            ['{context}', '{question}'],
            [$context, $question],
            $this->user_prompt_template
        );
    }
    
    public function query_ollama($prompt) {
        if (!$this->is_ollama_running()) {
            throw new Exception("Ollama service is not running");
        }
        
        $data = [
            'model' => $this->current_model,
            'messages' => [
                ['role' => 'system', 'content' => $this->system_prompt],
                ['role' => 'user', 'content' => $prompt]
            ],
            'stream' => false,
            'options' => [
                'temperature' => 0.3,
                'num_predict' => 1000
            ]
        ];
        
        $ch = curl_init($this->ollama_url . '/api/chat');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_TIMEOUT, 120);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
        
        $response = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curl_error = curl_error($ch);
        curl_close($ch);
        
        if ($curl_error) {
            error_log("Curl error in query_ollama: " . $curl_error);
            throw new Exception("Curl error: " . $curl_error);
        }
        
        if ($http_code !== 200) {
            error_log("Ollama API returned HTTP code: $http_code, response: " . substr($response, 0, 500));
            throw new Exception("Ollama API returned HTTP code: $http_code");
        }
        
        if (empty($response)) {
            error_log("Empty response from Ollama API");
            throw new Exception("Empty response from Ollama API");
        }
        
        $result = json_decode($response, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            error_log("JSON decode error: " . json_last_error_msg() . ", response: " . substr($response, 0, 500));
            throw new Exception("JSON decode error: " . json_last_error_msg());
        }
        
        if (!isset($result['message']['content'])) {
            error_log("Missing message.content in Ollama response: " . json_encode($result));
            throw new Exception("Missing message.content in Ollama response");
        }
        
        return $result['message']['content'];
    }
    
    public function get_current_model() {
        return $this->current_model;
    }
    
    public function get_current_profile() {
        return $this->current_profile;
    }

    public function ragcodetask($message) {
        // Independent code path for RAGcode configuration
        $searchResults = $this->search_vector_store($message, 15);
        $context = $this->build_rag_context($searchResults, $message);
        $prompt = $this->build_prompt($message, $context);
        $response_text = $this->query_ollama($prompt);
        $response = [
            'response' => $response_text,
            'model' => $this->get_current_model(),
            'profile' => $this->get_current_profile(),
            'timestamp' => time()
        ];
        return $response;
    }
    
    public function doomsteadtask($message) {
        // Independent code path for Doomstead configuration (placeholder)
        return [
            'response' => "Doomstead task not yet implemented",
            'model' => $this->get_current_model(),
            'profile' => $this->get_current_profile(),
            'timestamp' => time()
        ];
    }
    
    public function mainpagetask($message) {
        // Independent code path for Mainpage configuration (placeholder)
        return [
            'response' => "Mainpage task not yet implemented",
            'model' => $this->get_current_model(),
            'profile' => $this->get_current_profile(),
            'timestamp' => time()
        ];
    }
    
    public function ragdocstask($message) {
        // Independent code path for RAGdocs configuration (placeholder)
        return [
            'response' => "RAGdocs task not yet implemented",
            'model' => $this->get_current_model(),
            'profile' => $this->get_current_profile(),
            'timestamp' => time()
        ];
    }
    
    public function transcripttask($message) {
        // Independent code path for Transcript configuration (placeholder)
        return [
            'response' => "Transcript task not yet implemented",
            'model' => $this->get_current_model(),
            'profile' => $this->get_current_profile(),
            'timestamp' => time()
        ];
    }
    
    public function plantdiseasestask($message) {
        // Independent code path for PlantDiseases configuration
        $searchResults = $this->search_vector_store($message, 15);
        $context = $this->build_rag_context($searchResults, $message);
        $prompt = $this->build_prompt($message, $context);
        $response_text = $this->query_ollama($prompt);
        $response = [
            'response' => $response_text,
            'model' => $this->get_current_model(),
            'profile' => $this->get_current_profile(),
            'timestamp' => time()
        ];
        return $response;
    }
}

while (ob_get_level()) {
    ob_end_clean();
}

header('Content-Type: application/json');
header('Cache-Control: no-cache');

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Invalid request method');
    }
    
    $raw_input = file_get_contents('php://input');
    if ($raw_input === false) {
        throw new Exception('Failed to read input');
    }
    
    $input = json_decode($raw_input, true);
    if ($input === null) {
        throw new Exception('Invalid JSON input');
    }
    
    $action = $input['action'] ?? '';
    $rag = new RAGSystem();
    $response = null;
    
    switch ($action) {
        case 'save_transcript':
            $transcript = $input['transcript'] ?? '';
            if (empty($transcript)) {
                throw new Exception('No transcript content provided');
            }
            
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
            
            $response = ['success' => true, 'path' => $file_path, 'size' => $result];
            break;
            
        case 'sendtask':
            $message = $input['message'] ?? '';
            if (empty($message)) {
                throw new Exception('No message provided');
            }
            $configFile = __DIR__ . '/../data/config.json';
            $json = @file_get_contents($configFile);
            $data = json_decode($json, true);
            $profile = $data['filesetconfig'] ?? '';
            
            switch ($profile) {
                case 'ragcode':
                    $response = $rag->ragcodetask($message);
                    break;
                case 'doomstead':
                    $response = $rag->doomsteadtask($message);
                    break;
                case 'mainpage':
                    $response = $rag->mainpagetask($message);
                    break;
                case 'ragdocs':
                    $response = $rag->ragdocstask($message);
                    break;
                case 'transcript':
                    $response = $rag->transcripttask($message);
                    break;
                case 'plantdiseases':
                    $response = $rag->plantdiseasestask($message);
                    break;
                default:
                    throw new Exception('Unknown profile: ' . $profile);
            }
            break;
            
        default:
            throw new Exception('Invalid action: ' . $action);
    }
    
    echo json_encode($response);
    
} catch (Exception $e) {
    error_log("RAG Error: " . $e->getMessage());
    echo json_encode([
        'error' => $e->getMessage(),
        'timestamp' => time()
    ]);
}

exit;
?>