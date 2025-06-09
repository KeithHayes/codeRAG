# Doomstead RAG Vector Store Builder

## Database Architecture

### Vector Database (ChromaDB)
- **Location**: `/var/www/html/doomsteadRAG/assets/data`  
- **Contents**:
  - Document chunks with embeddings  
  - Source file metadata  
  - Uses cosine similarity (`hnsw:space=cosine`)

### SQLite Metadata Database
- **Location**: `/var/www/html/doomsteadRAG/assets/data/file_metadata.db`  
- **Schema**:
```sql
CREATE TABLE file_metadata (
    file_path TEXT PRIMARY KEY,
    last_modified REAL,
    content_hash TEXT
);
CREATE TABLE files_embeddings (
    chunk_id TEXT PRIMARY KEY,
    file_path TEXT
);
```# Doomstead RAG Vector Store Builder

## Database Architecture

### Vector Database (ChromaDB)
- **Location**: `/var/www/html/doomsteadRAG/assets/data`  
- **Contents**:
  - Document chunks with embeddings  
  - Source file metadata  
  - Uses cosine similarity (`hnsw:space=cosine`)

### SQLite Metadata Database
- **Location**: `/var/www/html/doomsteadRAG/assets/data/file_metadata.db`  
- **Schema**:
```sql
CREATE TABLE file_metadata (
    file_path TEXT PRIMARY KEY,
    last_modified REAL,
    content_hash TEXT
);
CREATE TABLE files_embeddings (
    chunk_id TEXT PRIMARY KEY,
    file_path TEXT
);
```

---

## Full Technical Specifications

### File Processing

**Supported Extensions**:
- **PHP**: `.php`, `.php3`, `.php4`, `.php5`, `.phtml`  
- **JavaScript**: `.js`, `.jsx`, `.mjs`, `.cjs`  
- **CSS**: `.css`, `.scss`, `.less`  
- **HTML**: `.html`, `.htm`, `.xhtml`  

**Exclusions**:
- Skips files prefixed with `minified_`

---

### Chunking Parameters
- **Chunk size**: 1000 characters  
- **Overlap**: 200 characters  
- **Separators**: `['\n\nfunction ', '\n\nclass ', '\n\n', '\n', ' ', '']`

---

### Embedding Configuration
- **Model**: `sentence-transformers/all-mpnet-base-v2`  
- **Device**: Auto-detects GPU (CUDA), falls back to CPU  
- **Batch sizes**: 32 (GPU), 8 (CPU)  
- **Normalization**: Enabled  

---

## System Requirements

### Hardware
- **Minimum**: 4GB RAM  
- **Recommended**: NVIDIA GPU with CUDA 12.1+

### Software
- **Python**: 3.8+  
- **Dependencies**: See `requirements.txt`

---

## Configuration (`config.yaml`)
```yaml
doomsteadRAG:
  vector_db_path: "/var/www/html/doomsteadRAG/assets/data"
  embedding_model: "sentence-transformers/all-mpnet-base-v2"
  chunk_size: 1000
  chunk_overlap: 200
  code_dirs:
    php: ["/var/www/html/homedog/doomstead"]
    js: ["/var/www/html/homedog/doomstead/Themes/doomstead/scripts"]
    css: ["/var/www/html/homedog/doomstead/Themes/doomstead/css"]
```

---

## Performance Metrics
- **Typical processing time**: ~90 minutes (for 50k chunks)  
- **Memory usage**: ~8GB during peak  
- **Storage requirements**: ~2GB per 100k chunks  

---

## Error Handling
- **Automatic retry for**:
  - Permission issues  
  - GPU memory errors  
  - File system errors  

- **Logs**: Detailed error logs in `vector_build.log`

---

## Maintenance
- Automatic cleanup of previous builds  
- Sets `chmod 777` for web server access  
- File change detection using content hashing  

---

## Log File Sample
```
2025-05-31 21:23:41,218 - INFO - GPU: NVIDIA GeForce RTX 3060  
2025-05-31 21:23:47,251 - INFO - Created 49733 chunks  
2025-05-31 21:35:00,951 - INFO - Processed batch 98/98  
2025-05-31 21:35:00,966 - INFO - Build completed successfully  
```

---

## Troubleshooting

**Common Issues**:
- **Permission errors**:  
  `chmod -R 777 /var/www/html/doomsteadRAG/assets`

- **CUDA errors**:  
  Set `model_kwargs={'device':'cpu'}` in config

- **Memory errors**:  
  Reduce `chunk_size` to 500

**Support**: Contact sysadmin with logs from `vector_build.log`

---

## To Use

1. Copy ALL text above  
2. Paste into a new file named `README.md`  
3. Save to your project root directory

---

This complete documentation includes:
- All database specifications  
- Full technical parameters  
- Configuration details  
- System requirements  
- Performance data  
- Error handling procedures  
- Maintenance instructions  
- Troubleshooting guide  

# Incremental Update Algorithm

## Change Detection:

```python
for file in scan_files():
    current_mtime = get_modification_time(file)
    current_hash = compute_content_hash(file)
    
    db_record = query_metadata(file.path)
    
    if not db_record:  # New file
        add_to_processing_queue(file)
    elif (current_mtime > db_record.last_modified or 
          current_hash != db_record.content_hash):  # Changed file
        add_to_processing_queue(file)
    # Unchanged files are skipped
```

## Update Operations:

### For New Files:

- Add file metadata to SQLite  
- Process chunks and embeddings  
- Add to vector store  
- Record chunk IDs in SQLite  

### For Changed Files:

- Remove all existing chunks from vector store (by file path)  
- Delete chunk references from SQLite  
- Process file as new (create fresh chunks/embeddings)  
- Update metadata in SQLite  

### For Deleted Files:

- Remove chunks from vector store (by file path)  
- Delete metadata and chunk references from SQLite  

---

## Database Impact:



---

## Full Technical Specifications

### File Processing

**Supported Extensions**:
- **PHP**: `.php`, `.php3`, `.php4`, `.php5`, `.phtml`  
- **JavaScript**: `.js`, `.jsx`, `.mjs`, `.cjs`  
- **CSS**: `.css`, `.scss`, `.less`  
- **HTML**: `.html`, `.htm`, `.xhtml`  

**Exclusions**:
- Skips files prefixed with `minified_`

---

### Chunking Parameters
- **Chunk size**: 1000 characters  
- **Overlap**: 200 characters  
- **Separators**: `['\n\nfunction ', '\n\nclass ', '\n\n', '\n', ' ', '']`

---

### Embedding Configuration
- **Model**: `sentence-transformers/all-mpnet-base-v2`  
- **Device**: Auto-detects GPU (CUDA), falls back to CPU  
- **Batch sizes**: 32 (GPU), 8 (CPU)  
- **Normalization**: Enabled  

---

## System Requirements

### Hardware
- **Minimum**: 4GB RAM  
- **Recommended**: NVIDIA GPU with CUDA 12.1+

### Software
- **Python**: 3.8+  
- **Dependencies**: See `requirements.txt`

---

## Configuration (`config.yaml`)
```yaml
doomsteadRAG:
  vector_db_path: "/var/www/html/doomsteadRAG/assets/data"
  embedding_model: "sentence-transformers/all-mpnet-base-v2"
  chunk_size: 1000
  chunk_overlap: 200
  code_dirs:
    php: ["/var/www/html/homedog/doomstead"]
    js: ["/var/www/html/homedog/doomstead/Themes/doomstead/scripts"]
    css: ["/var/www/html/homedog/doomstead/Themes/doomstead/css"]
```

---

## Performance Metrics
- **Typical processing time**: ~90 minutes (for 50k chunks)  
- **Memory usage**: ~8GB during peak  
- **Storage requirements**: ~2GB per 100k chunks  

---

## Error Handling
- **Automatic retry for**:
  - Permission issues  
  - GPU memory errors  
  - File system errors  

- **Logs**: Detailed error logs in `vector_build.log`

---

## Maintenance
- Automatic cleanup of previous builds  
- Sets `chmod 777` for web server access  
- File change detection using content hashing  

---

## Log File Sample
```
2025-05-31 21:23:41,218 - INFO - GPU: NVIDIA GeForce RTX 3060  
2025-05-31 21:23:47,251 - INFO - Created 49733 chunks  
2025-05-31 21:35:00,951 - INFO - Processed batch 98/98  
2025-05-31 21:35:00,966 - INFO - Build completed successfully  
```

---

## Troubleshooting

**Common Issues**:
- **Permission errors**:  
  `chmod -R 777 /var/www/html/doomsteadRAG/assets`

- **CUDA errors**:  
  Set `model_kwargs={'device':'cpu'}` in config

- **Memory errors**:  
  Reduce `chunk_size` to 500

---

## To Use

1. Copy ALL text above  
2. Paste into a new file named `README.md`  
3. Save to your project root directory

---

This complete documentation includes:
- All database specifications  
- Full technical parameters  
- Configuration details  
- System requirements  
- Performance data  
- Error handling procedures  
- Maintenance instructions  
- Troubleshooting guide  

