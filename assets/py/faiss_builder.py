#!/usr/bin/env python3
"""
FAISS Vector Store Builder for Doomstead RAG
Replaces ChromaDB full_builder.py
"""

import os
import sys
import json
import yaml
import logging
import hashlib
import sqlite3
from pathlib import Path
from typing import List, Dict, Any
import argparse

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_community.document_loaders import (
    TextLoader, PyPDFLoader, DirectoryLoader
)

# Project paths
PROJECT_ROOT = Path("/var/www/html/doomsteadRAG")
SCRIPT_DIR = Path(__file__).parent.resolve()
LOG_DIR = PROJECT_ROOT / "assets/logs"
DATA_DIR = PROJECT_ROOT / "assets/data"

def setup_logging(profile: str):
    """Setup logging for build process"""
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    LOG_FILE = LOG_DIR / f"faiss_build_{profile}.log"
    
    # Clear previous log
    if LOG_FILE.exists():
        LOG_FILE.unlink()
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(LOG_FILE),
            logging.StreamHandler()
        ]
    )
    return logging.getLogger("DoomsteadFAISS")

class FAISSBuilder:
    def __init__(self, profile: str):
        self.profile = profile
        self.config = self._load_config()
        self.logger = setup_logging(profile)
        self.gpu_available = self._check_gpu()
        
        # Setup paths
        self.profile_dir = DATA_DIR / profile
        self.faiss_dir = self.profile_dir / "faiss_index"
        self.db_file = self.profile_dir / "file_metadata.db"
        
        # Initialize components
        self.embeddings = self._init_embeddings()
        self.splitter = self._init_splitter()
        
        # Ensure directories exist
        self.profile_dir.mkdir(parents=True, exist_ok=True)
        self.faiss_dir.mkdir(parents=True, exist_ok=True)
        
        self.logger.info(f"=== FAISS Builder for profile: {profile} ===")
        self.logger.info(f"Using {'GPU' if self.gpu_available else 'CPU'} for embeddings")
    
    def _load_config(self) -> Dict:
        """Load configuration from YAML file"""
        config_path = PROJECT_ROOT / "assets" / "py" / f"{self.profile}.yaml"
        
        if not config_path.exists():
            raise FileNotFoundError(f"Config file not found: {config_path}")
        
        with open(config_path, 'r') as f:
            config = yaml.safe_load(f)
        
        if not config or 'doomsteadRAG' not in config:
            raise ValueError(f"Invalid config file: {config_path}")
        
        return config['doomsteadRAG']
    
    def _check_gpu(self) -> bool:
        """Check if GPU is available for embeddings"""
        try:
            import torch
            if torch.cuda.is_available():
                self.logger.info(f"GPU available: {torch.cuda.get_device_name(0)}")
                return True
        except ImportError:
            pass
        self.logger.info("Using CPU for embeddings")
        return False
    
    def _init_embeddings(self) -> HuggingFaceEmbeddings:
        """Initialize embedding model"""
        model_name = self.config.get('embedding_model', 'sentence-transformers/all-mpnet-base-v2')
        device = "cuda" if self.gpu_available else "cpu"
        
        self.logger.info(f"Loading embedding model: {model_name} on {device}")
        
        return HuggingFaceEmbeddings(
            model_name=model_name,
            model_kwargs={'device': device, 'trust_remote_code': True},
            encode_kwargs={'batch_size': 32 if device == 'cuda' else 8, 
                          'normalize_embeddings': True}
        )
    
    def _init_splitter(self) -> RecursiveCharacterTextSplitter:
        """Initialize text splitter"""
        chunk_size = self.config.get('chunk_size', 800)
        chunk_overlap = self.config.get('chunk_overlap', 150)
        
        return RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=['\n\nfunction ', '\nfunction ', '\n\nclass ', 
                       '\nclass ', '\n\n', '\n', ' ', '']
        )
    
    def _get_file_extensions(self, file_type: str) -> List[str]:
        """Get file extensions for a given file type"""
        extension_map = {
            'py': ['.py'],
            'php': ['.php', '.php3', '.php4', '.php5', '.phtml'],
            'js': ['.js', '.jsx', '.mjs', '.cjs'],
            'css': ['.css', '.scss', '.less'],
            'html': ['.html', '.htm', '.xhtml'],
            'txt': ['.txt', '.md', '.rst'],
            'pdf': ['.pdf']
        }
        return extension_map.get(file_type.lower(), [])
    
    def _should_skip_file(self, file_path: str) -> bool:
        """Check if file should be skipped"""
        filename = os.path.basename(file_path)
        skip_patterns = ['venv', '__pycache__', '.venv', 'minified_']
        return any(pattern in filename or pattern in str(file_path) for pattern in skip_patterns)
    
    def _update_metadata_db(self, file_path: str, content_hash: str):
        """Update file metadata in SQLite database"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        # Create table if not exists
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS file_metadata (
                file_path TEXT PRIMARY KEY,
                last_modified REAL,
                content_hash TEXT,
                last_indexed TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        last_modified = os.path.getmtime(file_path)
        
        cursor.execute('''
            INSERT OR REPLACE INTO file_metadata 
            (file_path, last_modified, content_hash)
            VALUES (?, ?, ?)
        ''', (file_path, last_modified, content_hash))
        
        conn.commit()
        conn.close()
    
    def _load_code_documents(self) -> List[Document]:
        """Load code documents from configured directories"""
        documents = []
        code_dirs = self.config.get('code_dirs', {})
        
        if not code_dirs:
            self.logger.info("No code directories configured")
            return documents
        
        for file_type, dirs in code_dirs.items():
            extensions = self._get_file_extensions(file_type)
            if not extensions:
                continue
                
            for dir_path in dirs:
                path = Path(dir_path) if Path(dir_path).is_absolute() else PROJECT_ROOT / dir_path
                if not path.exists():
                    self.logger.warning(f"Directory not found: {path}")
                    continue
                
                self.logger.info(f"Loading {file_type.upper()} files from {path}")
                
                for ext in extensions:
                    for file_path in path.rglob(f"*{ext}"):
                        if self._should_skip_file(str(file_path)):
                            continue
                        
                        try:
                            # Read file content
                            with open(file_path, 'r', encoding='utf-8') as f:
                                content = f.read()
                            
                            # Calculate hash
                            content_hash = hashlib.md5(content.encode()).hexdigest()
                            
                            # Update metadata
                            self._update_metadata_db(str(file_path), content_hash)
                            
                            # Create document
                            doc = Document(
                                page_content=content,
                                metadata={
                                    'source': str(file_path),
                                    'file_type': file_type,
                                    'chunk_id': 0
                                }
                            )
                            documents.append(doc)
                            
                        except UnicodeDecodeError:
                            try:
                                with open(file_path, 'r', encoding='latin-1') as f:
                                    content = f.read()
                                content_hash = hashlib.md5(content.encode()).hexdigest()
                                self._update_metadata_db(str(file_path), content_hash)
                                documents.append(Document(
                                    page_content=content,
                                    metadata={'source': str(file_path), 'file_type': file_type}
                                ))
                            except Exception as e:
                                self.logger.error(f"Failed to read {file_path}: {e}")
                        except Exception as e:
                            self.logger.error(f"Error reading {file_path}: {e}")
        
        return documents
    
    def _load_pdf_documents(self) -> List[Document]:
        """Load PDF documents from configured directories"""
        documents = []
        pdf_dirs = self.config.get('pdf', [])
        
        if not pdf_dirs:
            return documents
        
        for pdf_dir in pdf_dirs:
            path = Path(pdf_dir) if Path(pdf_dir).is_absolute() else PROJECT_ROOT / pdf_dir
            if not path.exists():
                self.logger.warning(f"PDF directory not found: {path}")
                continue
            
            self.logger.info(f"Loading PDF files from {path}")
            
            try:
                loader = DirectoryLoader(
                    str(path),
                    glob="**/*.pdf",
                    loader_cls=PyPDFLoader,
                    show_progress=True
                )
                pdf_docs = loader.load()
                
                for doc in pdf_docs:
                    content_hash = hashlib.md5(doc.page_content.encode()).hexdigest()
                    self._update_metadata_db(doc.metadata['source'], content_hash)
                    documents.append(doc)
                
                self.logger.info(f"Loaded {len(pdf_docs)} PDF documents")
                
            except Exception as e:
                self.logger.error(f"Error loading PDFs from {path}: {e}")
        
        return documents
    
    def _load_text_documents(self) -> List[Document]:
        """Load text documents from configured directories"""
        documents = []
        text_dirs = self.config.get('text_dirs', [])
        
        if not text_dirs:
            return documents
        
        for text_dir in text_dirs:
            path = Path(text_dir) if Path(text_dir).is_absolute() else PROJECT_ROOT / text_dir
            if not path.exists():
                self.logger.warning(f"Text directory not found: {path}")
                continue
            
            self.logger.info(f"Loading text files from {path}")
            
            for file_path in path.rglob("*.txt"):
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    content_hash = hashlib.md5(content.encode()).hexdigest()
                    self._update_metadata_db(str(file_path), content_hash)
                    
                    doc = Document(
                        page_content=content,
                        metadata={
                            'source': str(file_path),
                            'file_type': 'text'
                        }
                    )
                    documents.append(doc)
                    
                except UnicodeDecodeError:
                    try:
                        with open(file_path, 'r', encoding='latin-1') as f:
                            content = f.read()
                        content_hash = hashlib.md5(content.encode()).hexdigest()
                        self._update_metadata_db(str(file_path), content_hash)
                        documents.append(Document(
                            page_content=content,
                            metadata={'source': str(file_path), 'file_type': 'text'}
                        ))
                    except Exception as e:
                        self.logger.error(f"Failed to read {file_path}: {e}")
                except Exception as e:
                    self.logger.error(f"Error reading {file_path}: {e}")
        
        return documents
    
    def _load_all_documents(self) -> List[Document]:
        """Load all documents based on configuration"""
        documents = []
        
        self.logger.info("Loading documents...")
        
        # Load code documents
        code_docs = self._load_code_documents()
        documents.extend(code_docs)
        self.logger.info(f"Loaded {len(code_docs)} code documents")
        
        # Load PDF documents
        pdf_docs = self._load_pdf_documents()
        documents.extend(pdf_docs)
        self.logger.info(f"Loaded {len(pdf_docs)} PDF documents")
        
        # Load text documents
        text_docs = self._load_text_documents()
        documents.extend(text_docs)
        self.logger.info(f"Loaded {len(text_docs)} text documents")
        
        return documents
    
    def _split_documents(self, documents: List[Document]) -> List[Document]:
        """Split documents into chunks"""
        self.logger.info("Splitting documents into chunks...")
        chunks = self.splitter.split_documents(documents)
        
        # Add chunk metadata
        for idx, chunk in enumerate(chunks):
            chunk.metadata['chunk'] = idx
            if 'chunk_id' not in chunk.metadata:
                chunk.metadata['chunk_id'] = idx
        
        self.logger.info(f"Created {len(chunks)} chunks")
        return chunks
    
    def build_index(self):
        """Build FAISS index from documents"""
        try:
            # Load documents
            documents = self._load_all_documents()
            if not documents:
                self.logger.warning("No documents found to process")
                return False
            
            # Split into chunks
            chunks = self._split_documents(documents)
            if not chunks:
                self.logger.warning("No chunks created")
                return False
            
            # Build FAISS index
            self.logger.info("Building FAISS index...")
            total_chunks = len(chunks)
            
            # Process in batches for memory efficiency
            batch_size = 100
            vectorstore = None
            
            for i in range(0, total_chunks, batch_size):
                batch = chunks[i:i+batch_size]
                batch_num = i // batch_size + 1
                total_batches = (total_chunks + batch_size - 1) // batch_size
                
                self.logger.info(f"Processed batch {batch_num}/{total_batches}")
                
                if vectorstore is None:
                    vectorstore = FAISS.from_documents(batch, self.embeddings)
                else:
                    vectorstore.add_documents(batch)
            
            # Save FAISS index
            self.logger.info(f"Saving FAISS index to {self.faiss_dir}")
            vectorstore.save_local(str(self.faiss_dir))
            
            # Save build metadata
            metadata = {
                'profile': self.profile,
                'total_chunks': total_chunks,
                'total_documents': len(documents),
                'embedding_model': self.config.get('embedding_model'),
                'chunk_size': self.config.get('chunk_size', 800),
                'chunk_overlap': self.config.get('chunk_overlap', 150),
                'gpu_used': self.gpu_available,
                'timestamp': str(Path(self.faiss_dir / 'index.faiss').stat().st_mtime)
            }
            
            with open(self.faiss_dir / 'build_info.json', 'w') as f:
                json.dump(metadata, f, indent=2)
            
            self.logger.info(f"Build completed successfully! Total chunks: {total_chunks}")
            return True
            
        except Exception as e:
            self.logger.error(f"Build failed: {str(e)}", exc_info=True)
            return False

def main():
    parser = argparse.ArgumentParser(description='FAISS Vector Store Builder')
    parser.add_argument('--profile', required=True, 
                       choices=['ragcode', 'doomstead', 'mainpage', 'ragdocs', 'transcript'],
                       help='Configuration profile to build')
    
    args = parser.parse_args()
    
    builder = FAISSBuilder(args.profile)
    success = builder.build_index()
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()