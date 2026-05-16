<?php
// assets/php/run_ragdocs.php - RAG Docs backend for RAM compatibility

header('Content-Type: application/json');
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('max_execution_time', 300);
ini_set('memory_limit', '512M');

$data = json_decode(file_get_contents('php://input'), true);
$action = $data['action'] ?? '';
$profile = $data['profile'] ?? 'ragdocs';

$ragdocs_dir = __DIR__ . '/../data/ragdocs';
$index_dir = $ragdocs_dir . '/vector_index';
$metadata_file = $index_dir . '/metadata.json';
$chunks_file = $index_dir . '/chunks.json';

if (!is_dir($ragdocs_dir)) {
    mkdir($ragdocs_dir, 0755, true);
}

function get_yaml_config($profile) {
    $yaml_file = __DIR__ . "/../yaml/{$profile}.yaml";
    if (!file_exists($yaml_file)) {
        return null;
    }
    
    $content = file_get_contents($yaml_file);
    $config = [];
    
    if (preg_match('/chunk_size:\s*(\d+)/', $content, $matches)) {
        $config['chunk_size'] = (int)$matches[1];
    }
    if (preg_match('/chunk_overlap:\s*(\d+)/', $content, $matches)) {
        $config['chunk_overlap'] = (int)$matches[1];
    }
    if (preg_match('/system_prompt:\s*"([^"]+)"/', $content, $matches)) {
        $config['system_prompt'] = str_replace('\\n', "\n", $matches[1]);
    }
    if (preg_match('/user_prompt_template:\s*"([^"]+)"/', $content, $matches)) {
        $config['user_prompt_template'] = str_replace('\\n', "\n", $matches[1]);
    }
    if (preg_match('/ollama_model:\s*"([^"]+)"/', $content, $matches)) {
        $config['ollama_model'] = $matches[1];
    }
    
    return $config;
}

function ensure_ollama_running() {
    $ch = curl_init('http://localhost:11434/api/tags');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 3);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 2);
    curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ($http_code === 200);
}

function query_ollama($system_prompt, $user_prompt, $model) {
    if (!ensure_ollama_running()) {
        throw new Exception("Ollama service is not running");
    }
    
    $data = [
        'model' => $model,
        'messages' => [
            ['role' => 'system', 'content' => $system_prompt],
            ['role' => 'user', 'content' => $user_prompt]
        ],
        'stream' => false,
        'options' => [
            'temperature' => 0.3,
            'num_predict' => 4096
        ]
    ];
    
    $ch = curl_init('http://localhost:11434/api/chat');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 180);
    
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

function simple_similarity_search($question, $chunks) {
    $results = [];
    $question_lower = strtolower($question);
    $question_terms = explode(' ', $question_lower);
    
    foreach ($chunks as $index => $chunk) {
        $chunk_lower = strtolower($chunk['text']);
        $score = 0;
        
        foreach ($question_terms as $term) {
            if (strlen($term) < 3) continue;
            if (strpos($chunk_lower, $term) !== false) {
                $score += substr_count($chunk_lower, $term);
            }
        }
        
        if (isset($chunk['metadata']['speeds'])) {
            foreach ($chunk['metadata']['speeds'] as $speed) {
                if (strpos($question, (string)$speed) !== false) {
                    $score += 5;
                }
            }
        }
        
        if (isset($chunk['metadata']['suppliers'])) {
            foreach ($chunk['metadata']['suppliers'] as $supplier) {
                if (stripos($question, $supplier) !== false) {
                    $score += 3;
                }
            }
        }
        
        if ($score > 0) {
            $results[] = [
                'index' => $index,
                'score' => $score,
                'text' => $chunk['text'],
                'metadata' => $chunk['metadata']
            ];
        }
    }
    
    usort($results, function($a, $b) {
        return $b['score'] <=> $a['score'];
    });
    
    return array_slice($results, 0, 5);
}

function build_context($results) {
    if (empty($results)) {
        return "No relevant RAM modules found for your query.\n\n";
    }
    
    $context = "=== RAM COMPATIBILITY DATABASE ===\n\n";
    $context .= "Here are the most relevant RAM modules based on your query:\n\n";
    
    foreach ($results as $result) {
        $context .= $result['text'] . "\n\n---\n\n";
    }
    
    return $context;
}

switch ($action) {
    case 'build_index':
        $chunks = $data['chunks'] ?? [];
        if (empty($chunks)) {
            echo json_encode(['success' => false, 'error' => 'No chunks provided']);
            exit;
        }
        
        if (!is_dir($index_dir)) {
            mkdir($index_dir, 0755, true);
        }
        
        file_put_contents($chunks_file, json_encode($chunks, JSON_PRETTY_PRINT));
        
        $metadata = [
            'created' => time(),
            'chunk_count' => count($chunks),
            'profile' => $profile,
            'module_count' => array_sum(array_column($chunks, 'metadata')) ?? 0
        ];
        file_put_contents($metadata_file, json_encode($metadata, JSON_PRETTY_PRINT));
        
        echo json_encode([
            'success' => true,
            'message' => 'Index built successfully',
            'chunk_count' => count($chunks)
        ]);
        break;
        
    case 'query':
        $question = $data['question'] ?? '';
        if (empty($question)) {
            echo json_encode(['success' => false, 'error' => 'No question provided']);
            exit;
        }
        
        if (!file_exists($chunks_file)) {
            echo json_encode([
                'success' => false,
                'error' => 'No index found. Please rebuild the index first.',
                'requires_rebuild' => true
            ]);
            exit;
        }
        
        $chunks = json_decode(file_get_contents($chunks_file), true);
        $config = get_yaml_config($profile);
        
        if (!$config) {
            echo json_encode(['success' => false, 'error' => 'Config not found']);
            exit;
        }
        
        $search_results = simple_similarity_search($question, $chunks);
        $context = build_context($search_results);
        
        $user_prompt = str_replace(
            ['{context}', '{question}'],
            [$context, $question],
            $config['user_prompt_template'] ?? "Context:\n{context}\n\nQuestion: {question}\n\nAnswer:"
        );
        
        try {
            $response = query_ollama(
                $config['system_prompt'] ?? "You are a hardware compatibility specialist focusing on DDR5 RAM modules. Answer based on the provided compatibility database.",
                $user_prompt,
                $config['ollama_model'] ?? "qwen2.5:7b"
            );
            
            echo json_encode([
                'success' => true,
                'response' => $response,
                'context_used' => count($search_results),
                'model' => $config['ollama_model'] ?? "qwen2.5:7b"
            ]);
        } catch (Exception $e) {
            echo json_encode([
                'success' => false,
                'error' => $e->getMessage()
            ]);
        }
        break;
        
    case 'status':
        $exists = file_exists($chunks_file);
        $metadata = [];
        if ($exists) {
            $metadata = json_decode(file_get_contents($metadata_file), true);
        }
        
        echo json_encode([
            'success' => true,
            'exists' => $exists,
            'metadata' => $metadata
        ]);
        break;
        
    default:
        echo json_encode(['success' => false, 'error' => 'Invalid action: ' . $action]);
        break;
}
?>