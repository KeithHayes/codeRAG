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
    
    private function ensure_model_loaded() {
        if (!$this->is_ollama_running()) {
            throw new Exception("Ollama service is not running");
        }
        
        $ch = curl_init($this->ollama_url . '/api/ps');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 5);
        $response = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        $current_model = null;
        if ($http_code === 200 && $response) {
            $data = json_decode($response, true);
            if (isset($data['models']) && !empty($data['models'])) {
                $current_model = $data['models'][0]['name'];
            }
        }
        
        if ($current_model === $this->current_model) {
            return;
        }
        
        if ($current_model) {
            $ch = curl_init($this->ollama_url . '/api/generate');
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['model' => $current_model, 'keep_alive' => 0]));
            curl_setopt($ch, CURLOPT_TIMEOUT, 5);
            curl_exec($ch);
            curl_close($ch);
            usleep(500000);
        }
        
        $ch = curl_init($this->ollama_url . '/api/generate');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
            'model' => $this->current_model,
            'prompt' => '',
            'keep_alive' => 86400
        ]));
        curl_setopt($ch, CURLOPT_TIMEOUT, 5);
        curl_exec($ch);
        curl_close($ch);
        
        $loaded = false;
        for ($i = 0; $i < 30; $i++) {
            sleep(1);
            $ch = curl_init($this->ollama_url . '/api/ps');
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 5);
            $resp = curl_exec($ch);
            curl_close($ch);
            if ($resp) {
                $data = json_decode($resp, true);
                if (isset($data['models']) && !empty($data['models']) && $data['models'][0]['name'] === $this->current_model) {
                    $loaded = true;
                    break;
                }
            }
        }
        
        if (!$loaded) {
            throw new Exception("Failed to load model: {$this->current_model}");
        }
    }
    
    public function get_gpu_power() {
        $cmd = 'nvidia-smi --query-gpu=name,power.draw --format=csv,noheader,nounits';
        $output = shell_exec($cmd);
        if ($output === null || trim($output) === '') {
            return ['power' => 'Err', 'gpu_name' => 'GPU', 'timestamp' => date('H:i:s')];
        }
        $lines = explode("\n", trim($output));
        $firstLine = $lines[0];
        $parts = str_getcsv($firstLine, ',');
        if (count($parts) < 2) {
            return ['power' => 'Err', 'gpu_name' => 'GPU', 'timestamp' => date('H:i:s')];
        }
        $gpuName = trim($parts[0]);
        $power = trim($parts[1]);
        if (!is_numeric($power)) {
            return ['power' => 'Err', 'gpu_name' => $gpuName, 'timestamp' => date('H:i:s')];
        }
        return [
            'power' => $power . ' W',
            'gpu_name' => $gpuName,
            'timestamp' => date('H:i:s')
        ];
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
        
        usort($js_results, function($a, $b) { return $b['score'] <=> $a['score']; });
        usort($php_results, function($a, $b) { return $b['score'] <=> $a['score']; });
        usort($py_results, function($a, $b) { return $b['score'] <=> $a['score']; });
        usort($css_results, function($a, $b) { return $b['score'] <=> $a['score']; });
        usort($other_results, function($a, $b) { return $b['score'] <=> $a['score']; });
        
        $merged = array_merge($js_results, $php_results, $py_results, $css_results, $other_results);
        
        return array_slice($merged, 0, $k);
    }
    
    public function build_rag_context($vector_results, $query) {
        if (empty($vector_results)) {
            return "No relevant documents found.\n\n";
        }
        
        $query_terms = explode(' ', strtolower($query));
        $relevant_results = [];
        
        foreach ($vector_results as $doc) {
            $content = strtolower($doc['content']);
            $source = $doc['metadata']['source'] ?? '';
            $score = $doc['score'];
            
            $term_matches = 0;
            foreach ($query_terms as $term) {
                if (strpos($content, $term) !== false) {
                    $term_matches++;
                }
            }
            
            $relevance = $score + ($term_matches * 0.05);
            
            if (strpos($source, '.js') !== false) {
                $relevance += 0.2;
            }
            
            $relevant_results[] = [
                'doc' => $doc,
                'relevance' => $relevance
            ];
        }
        
        usort($relevant_results, function($a, $b) {
            return $b['relevance'] <=> $a['relevance'];
        });
        
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
        $this->ensure_model_loaded();
        
        $data = [
            'model' => $this->current_model,
            'messages' => [
                ['role' => 'system', 'content' => $this->system_prompt],
                ['role' => 'user', 'content' => $prompt]
            ],
            'stream' => false,
            'options' => [
                'temperature' => 0.3,
                'num_predict' => 4096
            ]
        ];
        
        $ch = curl_init($this->ollama_url . '/api/chat');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_TIMEOUT, 180);
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
        $searchResults = $this->search_vector_store($message, 15);
        $context = $this->build_rag_context($searchResults, $message);
        $prompt = $this->build_prompt($message, $context);
        $response_text = $this->query_ollama($prompt);
        return [
            'response' => $response_text,
            'model' => $this->get_current_model(),
            'profile' => $this->get_current_profile(),
            'timestamp' => time()
        ];
    }
    
    public function mainpagetask($message) {
        $searchResults = $this->search_vector_store($message, 15);
        $context = $this->build_rag_context($searchResults, $message);
        $prompt = $this->build_prompt($message, $context);
        $response_text = $this->query_ollama($prompt);
        return [
            'response' => $response_text,
            'model' => $this->get_current_model(),
            'profile' => $this->get_current_profile(),
            'timestamp' => time()
        ];
    }
    
    public function ragdocstask($message) {
        $searchResults = $this->search_vector_store($message, 15);
        $context = $this->build_rag_context($searchResults, $message);
        $prompt = $this->build_prompt($message, $context);
        $response_text = $this->query_ollama($prompt);
        return [
            'response' => $response_text,
            'model' => $this->get_current_model(),
            'profile' => $this->get_current_profile(),
            'timestamp' => time()
        ];
    }
    
    public function transcripttask($message) {
        $transcript_file = __DIR__ . '/../data/transcripts/sansdisfluencies.txt';
        
        if (!file_exists($transcript_file)) {
            return [
                'response' => 'No transcript found. Please run the pipeline first (Sailboat button) to clean the transcript.',
                'model' => $this->get_current_model(),
                'profile' => $this->get_current_profile(),
                'timestamp' => time()
            ];
        }
        
        $transcript = file_get_contents($transcript_file);
        
        if (empty(trim($transcript))) {
            return [
                'response' => 'Transcript file is empty. Please run the pipeline first.',
                'model' => $this->get_current_model(),
                'profile' => $this->get_current_profile(),
                'timestamp' => time()
            ];
        }
        
        $yaml_file = __DIR__ . "/../yaml/{$this->current_profile}.yaml";
        $pipeline_stages = $this->load_pipeline_config($yaml_file);
        
        $current_output = $transcript;
        $stage_results = [];
        
        foreach ($pipeline_stages as $stage_name => $stage_config) {
            if (!$stage_config['enabled']) {
                error_log("Stage {$stage_name} is disabled, skipping");
                continue;
            }
            
            error_log("Running stage: {$stage_name} using model: {$stage_config['model']}");
            
            $stage_prompt = str_replace('{input}', $current_output, $stage_config['user_prompt_template']);
            
            $original_model = $this->current_model;
            if ($stage_config['model'] !== $this->current_model) {
                $this->current_model = $stage_config['model'];
                error_log("Switched model from {$original_model} to {$this->current_model}");
            }
            
            try {
                $stage_result = $this->query_ollama_with_prompts($stage_config['system_prompt'], $stage_prompt);
                $stage_results[$stage_name] = $stage_result;
                $current_output = $stage_result;
                error_log("Stage {$stage_name} completed successfully");
            } catch (Exception $e) {
                error_log("Stage {$stage_name} failed: " . $e->getMessage());
                $stage_results[$stage_name] = "ERROR: " . $e->getMessage();
            }
            
            $this->current_model = $original_model;
        }
        
        $final_output = "# Transcript Analysis Pipeline Results\n\n";
        foreach ($stage_results as $stage_name => $result) {
            $final_output .= "## " . strtoupper(str_replace('_', ' ', $stage_name)) . "\n\n";
            $final_output .= $result . "\n\n";
            $final_output .= "---\n\n";
        }
        
        $output_file = __DIR__ . '/../data/transcripts/transcriptoutput.txt';
        file_put_contents($output_file, $final_output);
        
        return [
            'response' => $final_output,
            'model' => $this->get_current_model(),
            'profile' => $this->get_current_profile(),
            'timestamp' => time()
        ];
    }
    
    private function load_pipeline_config($yaml_file) {
        $content = file_get_contents($yaml_file);
        $stages = [];
        
        $lines = explode("\n", $content);
        $in_pipeline = false;
        $in_stages = false;
        $current_stage = null;
        $stage_indent = 0;
        
        for ($i = 0; $i < count($lines); $i++) {
            $line = $lines[$i];
            $trimmed = trim($line);
            
            if ($trimmed === 'pipeline:') {
                $in_pipeline = true;
                continue;
            }
            
            if ($in_pipeline && preg_match('/^\s{2}stages:/', $line)) {
                $in_stages = true;
                continue;
            }
            
            if ($in_stages && preg_match('/^\s{4}(\w+):/', $line, $matches)) {
                $current_stage = $matches[1];
                $stages[$current_stage] = [
                    'enabled' => false,
                    'model' => '',
                    'system_prompt' => '',
                    'user_prompt_template' => ''
                ];
                $stage_indent = 4;
                continue;
            }
            
            if ($current_stage && $line && strlen($line) > $stage_indent && substr($line, 0, $stage_indent) === str_repeat(' ', $stage_indent)) {
                if (preg_match('/enabled:\s*(true|false)/', $line, $e_match)) {
                    $stages[$current_stage]['enabled'] = ($e_match[1] === 'true');
                }
                if (preg_match('/model:\s*"([^"]+)"/', $line, $m_match)) {
                    $stages[$current_stage]['model'] = $m_match[1];
                }
                if (preg_match('/system_prompt:\s*"([^"]*)"/', $line, $s_match)) {
                    $stages[$current_stage]['system_prompt'] = str_replace('\\n', "\n", $s_match[1]);
                }
                if (preg_match('/user_prompt_template:\s*"([^"]*)"/', $line, $u_match)) {
                    $stages[$current_stage]['user_prompt_template'] = str_replace('\\n', "\n", $u_match[1]);
                }
            }
            
            if ($current_stage && $line && strlen($line) < $stage_indent && trim($line) !== '') {
                $current_stage = null;
            }
        }
        
        error_log("Loaded pipeline stages: " . json_encode(array_keys($stages)));
        foreach ($stages as $name => $config) {
            error_log("Stage {$name}: enabled=" . ($config['enabled'] ? 'true' : 'false') . ", model={$config['model']}");
        }
        
        return $stages;
    }
    
    private function query_ollama_with_prompts($system_prompt, $user_prompt) {
        $this->ensure_model_loaded();
        
        $data = [
            'model' => $this->current_model,
            'messages' => [
                ['role' => 'system', 'content' => $system_prompt],
                ['role' => 'user', 'content' => $user_prompt]
            ],
            'stream' => false,
            'options' => [
                'temperature' => 0.1,
                'num_predict' => 4096
            ]
        ];
        
        $ch = curl_init($this->ollama_url . '/api/chat');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_TIMEOUT, 180);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
        
        $response = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curl_error = curl_error($ch);
        curl_close($ch);
        
        if ($curl_error) {
            throw new Exception("Curl error: " . $curl_error);
        }
        
        if ($http_code !== 200) {
            throw new Exception("Ollama API returned HTTP code: $http_code");
        }
        
        $result = json_decode($response, true);
        
        if (!isset($result['message']['content'])) {
            throw new Exception("Missing message.content in Ollama response");
        }
        
        return $result['message']['content'];
    }
    
    public function plantdiseasestask($message) {
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
    
    public function socialismtask($message) {
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
        case 'gpu_power':
            $response = $rag->get_gpu_power();
            break;
            
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
                case 'socialism':
                    $response = $rag->socialismtask($message);
                    break;
                default:
                    throw new Exception('Unknown profile: ' . $profile);
            }
            break;
        case 'get_model_name':
            $config_file = __DIR__ . '/../data/config.json';
            $profile = 'ragcode';
            
            if (file_exists($config_file)) {
                $config_content = file_get_contents($config_file);
                $config_data = json_decode($config_content, true);
                $profile = $config_data['filesetconfig'] ?? 'ragcode';
            }
            
            $yaml_file = __DIR__ . "/../yaml/{$profile}.yaml";
            $model_name = 'unknown';
            
            if (file_exists($yaml_file)) {
                $yaml_content = file_get_contents($yaml_file);
                if (preg_match('/ollama_model:\s*["\']?([^"\'\n]+)["\']?/', $yaml_content, $matches)) {
                    $model_name = trim($matches[1]);
                }
            }
            
            $response = [
                'success' => true, 
                'model_name' => $model_name, 
                'profile' => $profile
            ];
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