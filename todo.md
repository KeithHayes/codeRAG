You: where is the doomstead info center

LLM (gpt-3.5-turbo): The doomstead info center is located at /var/www/html/homedog/doomstead/. This is the main directory for the doomstead forum. It contains the Sources, Packages, and tasks directories, as well as the Settings.php and Settings_bak.php files. The Sources directory contains the main code for the forum. The Packages directory contains any additional packages or modules that have been installed. The tasks directory contains any custom tasks that have been created. The Settings.php file contains the current settings for the forum, such as the board directory, source directory, package directory, task directory, and cache directory. The Settings_bak.php file is a backup of the Settings.php file. In summary, the doomstead info center is located at /var/www/html/homedog/doomstead/ and contains the main code, packages, tasks, and settings for the doomstead forum.

The only issue to be solved at this time is to achieve end to end RAG operation.  Changes in files must have achievment of correct RAGoperation as top priority.  No changes shall result in loss of RAG functionality and improvements augmenting basic operation will have low priority.

Code will be provided in fully formed files without ommissions that will be drop in replacements for existing code files.  The below code is the current code base.


=== doomstead rag web page ===

=== CSS assets/css/rag.css ===
body {
    font-family: Arial, sans-serif;
    margin: 30px;
    background-color: #ffdba9;
}

h1 {
    font-size: 1.8em;
}

#status {
    margin-bottom: 10px;
    font-weight: bold;
    color: #964b00;
}

#dynamo_menu_buttons {
	background: #ffedd4;
	border: 8px solid #523A28;
	border-bottom: 4px;
	border-radius: 8px 8px 0 0;
}

#chatbox {
    width: 100%;
    height: 410px;
    background-color: #ffedd4;
    border: 8px solid #523A28;
	border-radius: 0 0 8px 8px;
    overflow-y: auto;
    padding: 10px;
    margin-bottom: 10px;
    box-shadow: inset 0 0 5px #ddd;
}

.message {
    margin: 5px 0;
    padding: 8px 12px;
    border-radius: 10px;
    max-width: 100%;
    line-height: 1.4;
}

.message.user {
    background-color: #e0f0ff;
    align-self: flex-end;
    text-align: left;
}

.message.bot {
    background-color: #e0ffe0;
    align-self: flex-start;
    text-align: left;
}

#inputContainer {
    display: flex;
    width: 100%;
    gap: 0.75em;
    margin-bottom: 1em;
}

#userInput {
    width: 80%;
    padding: 10px;
    background-color: #ffedd4;
    border: 8px solid #523A28;
	border-radius: 8px 8px 8px 8px;
    font-size: 1em;
    flex: 1;
    box-sizing: border-box;
}

#userInput:focus,
#userInput:focus-visible {
    outline: none;
    box-shadow: none;
    border-color: #523A28; /* reset to match your default border */
}

#sendButton {
    outline: none;
	color: #ffedd4;
	background-color: #523A28;
	border: 0.0625em solid #523A28;
    border-radius: 8px 8px 8px 8px;
	font-size: 1.25em;
	font-weight: 500;
	font-family: "lucida grande",verdana,arial,geneva,helvetica,sans-serif;
    padding: 9px 21px 9px 21px;
	margin-left: 0.5em;;
    cursor: pointer;
    flex-shrink: 0;
}

#sendButton:hover {
    background-color: #ffdba9;
    border: 0.0625em solid #ffdba9;
    color: #523A28;
}

.status {
    display: inline-block;
    font-size: 14px;
    color: #888;
}


=== LOGS assets/logs/php_error.log ===


=== LOGS assets/logs/php_status.log ===
[2025-05-18 13:14:46] Executing vector search command: /var/www/html/doomsteadRAG/assets/py/venv/bin/python3 '/var/www/html/doomsteadRAG/assets/py/query_doomstead.py' --query 'where is the doomstead info center' --k 5 2>/dev/null
[2025-05-18 13:14:54] API Response Code: 200
[2025-05-18 13:14:54] Sending LLM prompt: Context:
Relevant information:
From file: /var/www/html/homedog/globeonly.php
Content:
<meta property="og:site_name" content="My Community">
	<meta property="og:title" content="My Community - Index">
...
[2025-05-18 13:15:08] API Response Code: 200


=== JS assets/js/rag.js ===
document.addEventListener("DOMContentLoaded", function () {
    const statusEl = document.getElementById("status")
    const sendBtn = document.getElementById("sendButton")
    const promptInput = document.getElementById("userInput")
    const chatbox = document.getElementById("chatbox")

    function addMessage(text, sender = "user") {
        const msg = document.createElement("div")
        msg.className = "message " + sender
        msg.textContent = text
        chatbox.appendChild(msg)
        chatbox.scrollTop = chatbox.scrollHeight
    }

    function sendPrompt() {
        const prompt = promptInput.value.trim()
        if (!prompt) return

        addMessage("You: " + prompt, "user")
        promptInput.value = ""
        promptInput.disabled = true
        sendBtn.disabled = true

        fetch("assets/php/rag.php", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ message: prompt })
        })
        .then(res => res.json())
        .then(data => {
            if (data.response) {
                addMessage("LLM (" + data.model + "): " + data.response, "bot")
            } else if (data.error) {
                addMessage("Error: " + data.error, "bot")
            }
        })
        .catch(err => {
            addMessage("Request error: " + err.message, "bot")
        })
        .finally(() => {
            promptInput.disabled = false
            sendBtn.disabled = false
            promptInput.focus()
        })
    }

    function updateModelStatus() {
        fetch("assets/php/rag.php", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: "message=status_check"
        })
        .then(res => res.json())
        .then(data => {
            const model = data.model || "Unknown"
            const status = data.status === "ready" ? "ready" : "loading"
            statusEl.textContent = `Model Status: ${status} (${model})`

            if (status === "ready") {
                promptInput.disabled = false
                sendBtn.disabled = false
                promptInput.focus()
            } else {
                statusEl.textContent += " — retrying..."
                setTimeout(updateModelStatus, 3000)
            }
        })
        .catch(err => {
            statusEl.textContent = "Model Status: error (check server)"
            console.error("Status check failed", err)
            setTimeout(updateModelStatus, 5000)
        })
    }

    sendBtn.addEventListener("click", sendPrompt)
    promptInput.addEventListener("keypress", function(e) {
        if (e.key === "Enter") {
            sendPrompt()
        }
    })
    
    promptInput.disabled = true
    sendBtn.disabled = true
    updateModelStatus()
})

=== PHP assets/php/rag.php ===
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
            ' --k ' . (int)$k .
            ' 2>/dev/null';

        $this->statuslog("Executing vector search command: " . $cmd);
        $output = shell_exec($cmd);
        
        if (!$output) {
            throw new Exception("Vector store search returned no output");
        }

        $results = json_decode($output, true);
        
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
        $context = "Relevant information:\n";
        foreach ($vector_results as $doc) {
            $context .= "From file: {$doc['metadata']['file_path']}\n";
            $context .= "Content:\n{$doc['data']}\n\n";
        }
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
            $this->errorlog("CURL Error #$errno: $error");
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
        $rag->clear_logs();
        
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

=== PHP assets/php/test_query.php ===
<?php
$python = '/var/www/html/doomsteadRAG/assets/py/venv/bin/python3';
$script = realpath(__DIR__ . '/../py/query_doomstead.py');

if (!file_exists($python)) {
    die("Error: Python interpreter not found at $python\n");
}
if (!file_exists($script)) {
    die("Error: Python script not found at $script\n");
}

$query = "where is the doomstead info center";
$k = 5;

$cmd = escapeshellcmd($python) . ' ' . escapeshellarg($script) .
       ' --query ' . escapeshellarg($query) .
       ' --k ' . (int)$k .
       ' 2>/dev/null';

echo "Running command:\n$cmd\n\n";
$output = shell_exec($cmd);

if (!$output) {
    die("Error: Vector store search returned no output.\n");
}

echo "Raw JSON Output:\n$output\n\n";

$results = json_decode($output, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    die("Error decoding JSON: " . json_last_error_msg() . "\n");
}

echo "Decoded Results:\n";
print_r($results);

// Test full RAG pipeline
require_once __DIR__.'/rag.php';
$rag = new RAGSystem();

try {
    $context = $rag->build_rag_context($results);
    $prompt = "Context:\n{$context}\n\nQuestion: {$query}\n\nAnswer:";
    
    echo "\nTesting LLM query with prompt:\n" . substr($prompt, 0, 500) . "...\n";
    
    $response = $rag->query_llm($prompt);
    
    if ($response === false) {
        echo "\nLLM query failed\n";
    } else {
        echo "\nLLM Response:\n$response\n";
    }
} catch (Exception $e) {
    echo "\nError: " . $e->getMessage() . "\n";
}

=== PY assets/py/chunker.py ===
from langchain.text_splitter import RecursiveCharacterTextSplitter

def split_documents(docs, chunk_size=1000, chunk_overlap=200):
    splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    return splitter.split_documents(docs)


=== PY assets/py/document_loader.py ===
import os
from langchain_community.document_loaders import TextLoader

def load_code_documents(root_dir):
    docs = []
    for dirpath, _, filenames in os.walk(root_dir):
        for file in filenames:
            if file.endswith(('.py', '.js', '.php', '.css', '.html')):
                path = os.path.join(dirpath, file)
                try:
                    loader = TextLoader(path)
                    docs.extend(loader.load())
                except Exception as e:
                    print(f"Error loading {path}: {e}")
    return docs


=== PY assets/py/listfiles.py ===
import os

def list_files_to_common_file(input_directory, output_directory, output_file):
    """
    Lists all target files (.py, requirements.txt, config.yaml/.yml) in the specified directory
    and writes their contents to an output file, separated by filename metadata.
    
    Args:
        directory (str): Path to the directory to search for files
        output_file (str): Path to the output file to be created/overwritten
    """
    target_files = []
    
    with open(output_file, 'w', encoding='utf-8') as out_f:
        # Get all files in the directory that match our targets
        for f in os.listdir(input_directory):
            lower_f = f.lower()
            if (lower_f.endswith('.py') or 
                lower_f == 'requirements.txt' or 
                lower_f in ('config.yaml', 'config.yml')):
                target_files.append(f)
        
        if not target_files:
            out_f.write("No target files found in the directory.\n")
            return
        
        for file in sorted(target_files):
            # Write separator and filename metadata
            out_f.write(f"\n{'=' * 25} {file} {'=' * 25}\n\n")
            
            # Write the content of the file
            file_path = os.path.join(output_directory, file)
            try:
                with open(file_path, 'r', encoding='utf-8') as in_f:
                    out_f.write(in_f.read())
                    out_f.write('\n')  # Add a newline after each file's content
            except Exception as e:
                out_f.write(f"Error reading {file}: {str(e)}\n")

if __name__ == "__main__":
    # Example usage - change these paths as needed
    # input_directory = '.'  # Current directory
    input_directory = '/home/kdog/text-generation-webui/extensions/simplerag'
    output_directory = '.'  # Current directory
    output_filename = 'combined_files.txt'
    
    list_files_to_common_file(input_directory, input_directory, output_filename)
    print(f"All target files in '{input_directory}' have been combined into '{output_filename}'")

=== PY assets/py/query_doomstead.py ===
#!/usr/bin/env python3
import os
import sys
import json
import argparse
import hashlib
import yaml
from warnings import simplefilter

# Redirect warnings to stderr and suppress them from stdout
simplefilter(action='ignore')
import warnings
warnings.filterwarnings("ignore", category=DeprecationWarning)

from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings

def load_config(config_file="config.yaml"):
    """Load configuration from YAML file"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    config_path = os.path.join(script_dir, config_file)
    with open(config_path, "r") as file:
        return yaml.safe_load(file)

def initialize_embeddings(config):
    """Initialize HuggingFace embeddings"""
    return HuggingFaceEmbeddings(
        model_name=config['rag_doomstead']['embedding_model'],
        model_kwargs={'device': 'cpu'},
        encode_kwargs={'normalize_embeddings': True}
    )

def load_vector_store(vector_db_path, embeddings):
    """Load existing Chroma vector store"""
    if os.path.exists(vector_db_path):
        return Chroma(
            persist_directory=vector_db_path,
            embedding_function=embeddings
        )
    return None

def format_search_results(results):
    """Format search results into standardized output"""
    output = []
    for result in results:
        output.append({
            'metadata': {
                'source': result.metadata.get('source', ''),
                'document_id': hashlib.md5(result.page_content.encode()).hexdigest(),
                'file_path': result.metadata.get('source', ''),
                'language': result.metadata.get('language', ''),
                'filename': result.metadata.get('filename', '')
            },
            'data': result.page_content,
            'score': getattr(result, 'score', 0.0)
        })
    return output

def main():
    # Load configuration
    config = load_config()
    
    # Initialize components
    embeddings = initialize_embeddings(config)
    vector_store = load_vector_store(config['rag_doomstead']['vector_db_path'], embeddings)
    
    # Set up argument parser
    parser = argparse.ArgumentParser(
        description='Query Doomstead RAG Vector Store',
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    parser.add_argument('--query', type=str, required=True, help='Search query')
    parser.add_argument('--k', type=int, default=5, help='Number of results to return')
    args = parser.parse_args()

    try:
        # Validate vector store
        if vector_store is None:
            raise ValueError("Vector store not initialized")
            
        # Execute search
        search_results = vector_store.similarity_search(args.query, k=args.k)
        output = format_search_results(search_results)
        
        # Output pure JSON to stdout (no other output)
        sys.stdout.write(json.dumps(output))
        
    except Exception as e:
        # Error handling with clean JSON output to stdout
        error_output = {
            'error': f'Search failed: {str(e)}',
            'type': type(e).__name__
        }
        sys.stdout.write(json.dumps(error_output))
        sys.exit(1)

if __name__ == "__main__":
    # Ensure clean JSON output by redirecting stderr
    sys.stderr = open(os.devnull, 'w')
    main()

=== PY assets/py/vectorstore_builder.py ===
#!/usr/bin/env python3
import os
import time
import logging
from pathlib import Path
from typing import Dict, List
import yaml
from tqdm import tqdm
import torch
from langchain.schema import Document
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter

LOG_FILE = "assets/py/vector_build.log"

class DoomsteadRAG:
    def __init__(self, config: Dict):
        self.config = config
        self._setup_logging()
        self.gpu_available = self._verify_gpu()
        self.embeddings = self._init_embeddings()
        self.splitter = self._init_splitter()
        self.vector_db = None
        self._verify_directories()  # Fixed method name
        self.logger.info("=== System Initialized ===")
        self.logger.info(f"Using {'GPU' if self.gpu_available else 'CPU'} for embeddings")

    def _setup_logging(self):
        """Configure logging system"""
        log_dir = Path("assets/py")
        log_dir.mkdir(parents=True, exist_ok=True)
        
        self.logger = logging.getLogger("DoomsteadRAG")
        self.logger.setLevel(logging.INFO)
        
        # File handler
        file_handler = logging.FileHandler(LOG_FILE)
        file_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
        
        # Console handler
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(logging.Formatter('%(message)s'))
        
        self.logger.addHandler(file_handler)
        self.logger.addHandler(console_handler)

    def _verify_gpu(self) -> bool:
        """Check GPU availability"""
        try:
            if torch.cuda.is_available():
                self.logger.info(f"GPU: {torch.cuda.get_device_name(0)}")
                self.logger.info(f"CUDA: {torch.version.cuda}")
                self.logger.info(f"Memory: {torch.cuda.get_device_properties(0).total_memory/1e9:.2f}GB")
                return True
            return False
        except Exception as e:
            self.logger.warning(f"GPU check failed: {str(e)}")
            return False

    def _verify_directories(self):  # Corrected method name
        """Verify all required directories exist"""
        self.logger.info("Verifying directories...")
        for dir_type, paths in self.config['code_dirs'].items():
            for path in paths:
                if not os.path.exists(path):
                    raise FileNotFoundError(f"Missing directory: {path} ({dir_type})")
        Path(self.config['vector_db_path']).mkdir(parents=True, exist_ok=True)

    def _init_embeddings(self):
        """Initialize embeddings model"""
        device = "cuda" if self.gpu_available else "cpu"
        return HuggingFaceEmbeddings(
            model_name=self.config['embedding_model'],
            model_kwargs={
                'device': device,
                'trust_remote_code': True
            },
            encode_kwargs={
                'batch_size': 64,
                'normalize_embeddings': True
            }
        )

    def _init_splitter(self):
        """Initialize text splitter"""
        return RecursiveCharacterTextSplitter(
            chunk_size=self.config['chunk_size'],
            chunk_overlap=self.config['chunk_overlap'],
            separators=['\n\nfunction ', '\n\nclass ', '\n\n', '\n', ' ', '']
        )

    def _get_extensions(self, file_type: str) -> List[str]:
        """Get file extensions for each language"""
        return {
            'php': ['.php', '.php3', '.php4', '.php5', '.phtml'],
            'js': ['.js', '.jsx', '.mjs', '.cjs'],
            'css': ['.css', '.scss', '.less'],
            'html': ['.html', '.htm', '.xhtml']
        }.get(file_type, [])

    def _load_documents(self) -> List[Document]:
        """Load all source documents"""
        documents = []
        self.logger.info("\nLoading documents:")
        
        for file_type, dirs in self.config['code_dirs'].items():
            self.logger.info(f"Processing {file_type.upper()} files...")
            for path in tqdm(dirs, desc=f"Scanning {file_type} dirs", leave=False):
                for ext in self._get_extensions(file_type):
                    for file in Path(path).rglob(f"*{ext}"):
                        try:
                            with open(file, 'r', encoding='utf-8') as f:
                                text = f.read()
                            metadata = {
                                'source': str(file),
                                'type': ext[1:],
                                'language': file_type,
                                'filename': file.name
                            }
                            documents.append(Document(page_content=text, metadata=metadata))
                        except Exception as e:
                            self.logger.error(f"Error reading {file}: {str(e)}")
        return documents

    def _process_embeddings(self, chunks: List[Document]) -> List[List[float]]:
        """Process document embeddings"""
        embeddings = []
        total_chunks = len(chunks)
        
        with tqdm(total=total_chunks, 
                 desc="Embedding Progress",
                 unit="chunk",
                 bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}]") as pbar:
            
            batch_size = 64
            for i in range(0, total_chunks, batch_size):
                batch = chunks[i:i + batch_size]
                batch_embeds = self.embeddings.embed_documents(
                    [doc.page_content for doc in batch]
                )
                embeddings.extend(batch_embeds)
                pbar.update(len(batch))
        
        return embeddings

    def initialize_vectorstore(self, force: bool = False):
        """Main vectorstore building method"""
        path = Path(self.config['vector_db_path'])
        
        if force or not path.exists():
            self.logger.info("\nBuilding vector store...")
            
            # Document loading
            docs = self._load_documents()
            self.logger.info(f"Loaded {len(docs)} files")
            
            # Chunking
            chunks = []
            with tqdm(total=len(docs), desc="Splitting documents") as pbar:
                for doc in docs:
                    chunks.extend(self.splitter.split_documents([doc]))
                    pbar.update(1)
            self.logger.info(f"Created {len(chunks)} chunks")
            
            # Embedding
            embeddings = self._process_embeddings(chunks)
            
            # Create collection
            self.vector_db = Chroma.from_texts(
                texts=[doc.page_content for doc in chunks],
                embedding=self.embeddings,
                metadatas=[doc.metadata for doc in chunks],
                persist_directory=str(path)
            )
            self.vector_db.persist()
            self.logger.info("Vector store created successfully!")
        else:
            self.logger.info("\nLoading existing vector store...")
            self.vector_db = Chroma(
                persist_directory=str(path),
                embedding_function=self.embeddings
            )
            self.logger.info("Vector store loaded.")

def load_config(path: str) -> Dict:
    """Load configuration file"""
    with open(path, 'r') as f:
        return yaml.safe_load(f).get("rag_doomstead", {})

def main():
    """Main execution function"""
    try:
        config = load_config("config.yaml")
        rag = DoomsteadRAG(config)
        rag.initialize_vectorstore(force=True)
        rag.logger.info("\nOperation completed successfully!")
    except Exception as e:
        logging.error(f"\nFatal error: {str(e)}")
        logging.error("Build failed. Please check the log file for details.")
        raise

if __name__ == "__main__":
    main()

=== PY assets/py/logger.py ===
import os
import datetime
from pathlib import Path

class Logger:
    def __init__(self, log_dir="assets/logs"):
        self.verbose = True
        self.log_dir = log_dir
        self._ensure_log_directory_exists()
        
    def _ensure_log_directory_exists(self):
        """Create log directory if it doesn't exist"""
        path = Path(self.log_dir)
        try:
            path.mkdir(parents=True, exist_ok=True)
        except PermissionError as e:
            print(f"Logger error: Cannot create log directory '{self.log_dir}': {e}")
            raise
        except Exception as e:
            print(f"Logger error: Unexpected error creating '{self.log_dir}': {e}")
            raise
        
    def _write_log(self, level, message, log_file):
        timestamp = datetime.datetime.now().strftime("[%Y-%m-%d %H:%M:%S.%f]")
        log_line = f"{timestamp} {level}: {message}\n"
        log_path = os.path.join(self.log_dir, log_file)
        
        try:
            with open(log_path, 'a', encoding='utf-8') as f:
                f.write(log_line)
        except IOError as e:
            print(f"Logger error: Failed to write to log file '{log_path}': {e}")

    def event(self, message):
        self._write_log("EVENT", message, "event.log")
        
    def debug(self, message):
        if self.verbose:
            self._write_log("DEBUG", message, "debug.log")
            
    def error(self, message):
        self._write_log("ERROR", message, "error.log")
        
    def debug_php(self, message):
        """Special method for PHP debug logs"""
        if self.verbose:
            self._write_log("DEBUG_PHP", message, "debug_php.log")

# Initialize logger
logger = Logger()


=== PY assets/py/config.yaml ===
# config.yaml
rag_doomstead:
  embedding_model: "sentence-transformers/all-mpnet-base-v2"
  chunk_size: 800
  chunk_overlap: 150
  code_dirs:
    php:
      - "/var/www/html/homedog/doomstead"
      - "/var/www/html/homedog/doomstead/Themes"
      - "/var/www/html/homedog/doomstead/Themes/doomstead"
      - "/var/www/html/homedog/doomstead/Sources"
      - "/var/www/html/homedog"
      - "/var/www/html/homedog/assets/php"
    js:
      - "/var/www/html/homedog/doomstead/Themes/doomstead/scripts"
      - "/var/www/html/homedog/assets/js"
    css:
      - "/var/www/html/homedog/doomstead/Themes/doomstead/css"
      - "/var/www/html/homedog/assets/css"
  vector_db_path: "/media/external_drive1/ai/textdata/extension_files/doomstead/vector_db"


