cat > /var/www/html/doomsteadRAG/README.txt << 'EOF'
================================================================================
                            DOOMSTEAD RAG SYSTEM
================================================================================

A code-aware Retrieval-Augmented Generation (RAG) assistant for querying your 
codebase. The assistant provides context-aware answers based on your actual 
source code.

================================================================================
                                OVERVIEW
================================================================================

Doomstead RAG allows you to ask natural language questions about your codebase 
and receive intelligent answers based on semantic search of your actual source 
code. The system combines:

- FAISS vector store for efficient similarity search
- Ollama for local LLM inference
- LangChain for document processing and embeddings
- PHP/JavaScript web interface for easy interaction

================================================================================
                                OPERATION
================================================================================

Web Interface Controls:

| Button        | Icon              | Function                                      |
|---------------|-------------------|-----------------------------------------------|
| File Load     | Floppy disk       | Select configuration profile                  |
| Full Build    | Database upload   | Rebuild FAISS vector store from source code   |
| Load Model    | Leaping dog       | Load the model specified in current profile   |
| Check Model   | Sailboat          | List available Ollama models                  |
| Home Server   | House             | Check Ollama service status                   |
| FastAPI       | Eye               | Open Ollama API documentation                 |

Workflow:

1. Select a profile from the File Load dropdown
2. Click the Run button (leaping dog) to load the model from the profile config
3. Type your question in the chat input
4. Receive context-aware answers based on your codebase

================================================================================
                                ARCHITECTURE
================================================================================

System Components:

┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│   PHP       │────▶│   Python    │
│   (JS/HTML) │◀────│   Backend   │◀────│   Scripts   │
└─────────────┘     └─────────────┘     └─────────────┘
                           │                    │
                           ▼                    ▼
                    ┌─────────────┐     ┌─────────────┐
                    │   Ollama    │     │   FAISS     │
                    │   LLM API   │     │  Vector DB  │
                    └─────────────┘     └─────────────┘

Data Flow:

1. User query → JavaScript → PHP backend
2. Vector search → Python FAISS query → Relevant code chunks
3. Context building → PHP formats chunks with source attribution
4. LLM generation → Ollama API generates answer
5. Response → Displayed in chat interface

================================================================================
                              FILE STRUCTURE
================================================================================

doomsteadRAG/
├── index.php                 # Main web interface
├── assets/
│   ├── css/                  # Stylesheets
│   ├── js/
│   │   ├── rag.js           # Chat interface
│   │   ├── toolbar.js       # Toolbar controls
│   │   └── build_modal.js   # Build progress modal
│   ├── php/
│   │   ├── rag.php          # Main RAG handler
│   │   ├── force_reload_model.php  # Model loader
│   │   ├── ollama_api.php   # Ollama management
│   │   └── full_builder.php # FAISS builder trigger
│   ├── py/
│   │   ├── faiss_builder.py # FAISS index builder
│   │   ├── faiss_query.py   # FAISS search
│   │   ├── *.yaml           # Profile configurations
│   │   └── venv/            # Python virtual environment
│   ├── data/                # Vector stores and metadata
│   └── logs/                # Application logs

================================================================================
                          CONFIGURATION PROFILES
================================================================================

Each profile (ragcode, doomstead, mainpage, ragdocs) has a corresponding YAML 
file defining:

- embedding_model: Model used for generating embeddings
- chunk_size: Size of text chunks for vector storage
- chunk_overlap: Overlap between chunks
- code_dirs: Directories containing source code
- text_dirs: Directories containing text documents
- pdf: Directories containing PDF files
- ollama_model: LLM model to load for this profile

================================================================================
                            BUILDING VECTOR STORES
================================================================================

Click the Full Build button (database upload icon) to:
- Scan all directories specified in the current profile
- Load code, PDF, and text documents
- Split documents into chunks (800 chars, 150 overlap)
- Generate embeddings using sentence-transformers
- Create FAISS index for similarity search

A modal dialog displays build progress in real-time.

================================================================================
                            TECHNOLOGY STACK
================================================================================

| Component          | Technology                                      |
|--------------------|-------------------------------------------------|
| Vector Database    | FAISS                                           |
| LLM Server         | Ollama                                          |
| Embeddings         | sentence-transformers/all-mpnet-base-v2        |
| Document Processing| LangChain                                       |
| Backend            | PHP                                             |
| Frontend           | HTML5/CSS3/JavaScript                           |

================================================================================
                                  LOGS
================================================================================

- PHP errors:     assets/logs/php_error.log
- PHP status:     assets/logs/php_status.log
- Build logs:     assets/logs/faiss_build_[profile].log

================================================================================
EOF

echo "Documentation saved to: /var/www/html/doomsteadRAG/README.txt"