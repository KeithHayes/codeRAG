<?php
// assets/php/rag.php — Doomstead RAG Backend

class RAGSystem {
    private $api_url = "http://localhost:5000/v1";
    private $current_model = 'Unknown';
    private $model_ready = false;
    private $model_check_attempts = 0;
    private $max_model_check_attempts = 10;
    private $model_check_delay = 5;
    private $last_raw_results = null;
    private $python_path = '/var/www/html/doomsteadRAG/assets/py/venv/bin/python3';

    public function errorlog($message) {
        $logfile = __DIR__ . '/../logs/php_error.log';
        $timestamp = date('Y-m-d H:i:s');
        $entry = "[$timestamp] $message\n";
        file_put_contents($logfile, $entry, FILE_APPEND | LOCK_EX);
    }

    public function statuslog($message) {
        $logfile = __DIR__ . '/../logs/php_status.log';
        $timestamp = date('Y-m-d H:i:s');
        $entry = "[$timestamp] $message\n";
        file_put_contents($logfile, $entry, FILE_APPEND | LOCK_EX);
    }

    public function clear_logs() {
        $paths = [
            __DIR__ . '/../logs/php_error.log',
            __DIR__ . '/../logs/php_status.log'
        ];
        foreach ($paths as $logfile) {
            file_put_contents($logfile, '', LOCK_EX);
        }
    }

    public function is_model_ready() {
        if ($this->model_ready) {
            return ['ready' => true, 'model' => $this->current_model];
        }

        try {
            $response = $this->make_api_call('/models', 'GET');
            if (!empty($response['data'][0]['id'])) {
                $this->model_ready = true;
                $this->current_model = $response['data'][0]['id'];
                return ['ready' => true, 'model' => $this->current_model];
            }
            return ['ready' => false, 'model' => 'No model loaded'];
        } catch (Exception $e) {
            $this->errorlog("MODEL CHECK ERROR: " . $e->getMessage());
            return ['ready' => false, 'model' => 'Error checking'];
        }
    }

    public function wait_for_model_ready() {
        while ($this->model_check_attempts < $this->max_model_check_attempts) {
            $status = $this->is_model_ready();
            if ($status['ready']) {
                return true;
            }
            $this->model_check_attempts++;
            sleep($this->model_check_delay);
        }
        return false;
    }

    public function search_vector_store($query, $k = 5) {
        $python_script = realpath(__DIR__ . '/../py/query_doomstead.py');
        
        if (!file_exists($this->python_path)) {
            throw new Exception("Python interpreter not found at {$this->python_path}");
        }
        
        if (!file_exists($python_script)) {
            throw new Exception("Python script not found at {$python_script}");
        }

        $cmd = escapeshellcmd($this->python_path) . ' ' . escapeshellarg($python_script) .
            ' --query ' . escapeshellarg($query) .
            ' --k ' . (int)$k;

        $this->statuslog("Executing vector search command: " . $cmd);
        $output = shell_exec($cmd);
        
        if (!$output) {
            throw new Exception("Vector store search returned no output");
        }

        // Extract JSON from output (handles logging mixed with JSON)
        $json_start = strpos($output, '[');
        $json_end = strrpos($output, ']');
        
        if ($json_start !== false && $json_end !== false) {
            $clean_output = substr($output, $json_start, $json_end - $json_start + 1);
            $results = json_decode($clean_output, true);
        } else {
            $results = json_decode($output, true);
        }
        
        if (json_last_error() !== JSON_ERROR_NONE || !$results) {
            $this->errorlog("Raw vector store output: " . substr($output, 0, 500));
            throw new Exception("Failed to decode search results: " . json_last_error_msg());
        }
        
        if (isset($results['error'])) {
            throw new Exception("Search error: " . $results['error']);
        }
        
        $this->last_raw_results = $results;
        return $results;
    }

    public function build_rag_context($vector_results) {
        $context = "📄 Retrieved Context:\n" . str_repeat("-", 40) . "\n";
        foreach ($vector_results as $i => $doc) {
            $source = $doc['metadata']['source'] ?? 'unknown';
            $chunk = $doc['metadata']['chunk'] ?? 'N/A';
            $content = $doc['content'] ?? $doc['page_content'] ?? '';
            $snippet = wordwrap(trim($content), 100); // wrap long lines

            $context .= sprintf(
                "%d. [Source: %s | Chunk: %s]\n\"%s\"\n\n",
                $i + 1,
                basename($source),
                $chunk,
                $snippet
            );
        }
        $context .= str_repeat("-", 40) . "\n";
        return $context;
    }

    public function query_llm($prompt) {
        if (!$this->wait_for_model_ready()) {
            throw new Exception("Model failed to load after multiple attempts");
        }

        $data = [
            'model' => $this->current_model,
            'messages' => [
                ['role' => 'system', 'content' => 'You are a helpful assistant. Answer questions based on the provided context.'],
                ['role' => 'user', 'content' => $prompt]
            ],
            'temperature' => 0.3,
            'max_tokens' => 1000,
            'stop' => ["\nFunction:"]
        ];

        try {
            $this->statuslog("Sending LLM prompt: " . substr($prompt, 0, 200) . "...");
            $response = $this->make_api_call('/chat/completions', 'POST', $data);
            
            if (!isset($response['choices'][0]['message']['content'])) {
                $this->errorlog("Malformed LLM response: " . json_encode($response));
                return false;
            }
            
            return $response['choices'][0]['message']['content'];
        } catch (Exception $e) {
            $this->errorlog("API ERROR: " . $e->getMessage());
            return false;
        }
    }

    private function make_api_call($endpoint, $method, $data = null) {
        $url = $this->api_url . $endpoint;
        $ch = curl_init($url);

        $options = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Accept: application/json'
            ],
            CURLOPT_TIMEOUT => 120,
            CURLOPT_CONNECTTIMEOUT => 10
        ];

        if ($method === 'POST' && $data !== null) {
            $options[CURLOPT_POSTFIELDS] = json_encode($data);
        }

        curl_setopt_array($ch, $options);
        $response = curl_exec($ch);

        if (curl_errno($ch)) {
            $error = curl_error($ch);
            $errno = curl_errno($ch);
            curl_close($ch);
            throw new Exception("API connection failed: $error");
        }

        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $this->statuslog("API Response Code: $http_code");

        if ($http_code >= 400) {
            $this->errorlog("API Error Response: " . substr($response, 0, 500));
            throw new Exception("API returned HTTP $http_code");
        }

        $decoded = json_decode($response, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            $this->errorlog("Invalid JSON Response: " . substr($response, 0, 500));
            throw new Exception("Invalid JSON response: " . json_last_error_msg());
        }

        return $decoded;
    }

    public function get_current_model() {
        return $this->current_model;
    }
}

// Handle status check
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['message'])) {
    header('Content-Type: application/json');
    
    try {
        $rag = new RAGSystem();
        
        if ($_POST['message'] === 'status_check') {
            $status = $rag->is_model_ready();
            echo json_encode([
                'status' => $status['ready'] ? 'ready' : 'loading',
                'model' => $status['model'],
                'timestamp' => time()
            ]);
            exit;
        }

        // Process all queries through RAG pipeline
        $query = $_POST['message'];
        
        // 1. Search vector store
        $searchResults = $rag->search_vector_store($query);
        
        // 2. Build context
        $context = $rag->build_rag_context($searchResults);
        $prompt = "Context:\n{$context}\n\nQuestion: {$query}\n\nAnswer:";
        
        // 3. Query LLM
        $response = $rag->query_llm($prompt);
        
        if ($response === false) {
            throw new Exception("LLM query failed");
        }

        echo json_encode([
            'response' => $response,
            'model' => $rag->get_current_model(),
            'timestamp' => time()
        ]);

    } catch (Exception $e) {
        $rag->errorlog("RAG ERROR: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'response' => 'System Error: ' . $e->getMessage(),
            'model' => 'Error',
            'timestamp' => time()
        ]);
    }

    exit;
}

// Default response for unsupported requests
header('HTTP/1.1 400 Bad Request');
echo json_encode(['error' => 'Invalid request']);
