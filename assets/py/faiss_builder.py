import os
import sys
import json
import yaml
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
import argparse

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_community.document_loaders import PyPDFLoader, DirectoryLoader

PROJECT_ROOT = Path("/var/www/html/doomsteadRAG")
DATA_DIR = PROJECT_ROOT / "assets/data"

def setup_logging(profile: str):
    LOG_DIR = PROJECT_ROOT / "assets/logs"
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    LOG_FILE = LOG_DIR / f"faiss_build_{profile}.log"
    if LOG_FILE.exists():
        LOG_FILE.unlink()
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[logging.FileHandler(LOG_FILE), logging.StreamHandler()]
    )
    return logging.getLogger("DoomsteadFAISS")

class FAISSBuilder:
    def __init__(self, profile: str):
        self.profile = profile
        self.logger = setup_logging(profile)
        self.config = self._load_config()
        self.profile_dir = DATA_DIR / profile
        self.code_index_dir = self.profile_dir / "faiss_code_index"
        self.text_index_dir = self.profile_dir / "faiss_text_index"
        
        # Get embedding models from config
        self.code_model_name = self.config.get('embedding_model', 'sentence-transformers/all-mpnet-base-v2')
        self.text_model_name = self.config.get('text_embedding_model', 'sentence-transformers/all-MiniLM-L6-v2')
        
        self.logger.info(f"Using code embedding model: {self.code_model_name}")
        self.logger.info(f"Using text embedding model: {self.text_model_name}")
        
        # Initialize both embedding models
        self.code_embeddings = HuggingFaceEmbeddings(
            model_name=self.code_model_name,
            model_kwargs={'device': 'cpu'},
            encode_kwargs={'normalize_embeddings': True}
        )
        
        self.text_embeddings = HuggingFaceEmbeddings(
            model_name=self.text_model_name,
            model_kwargs={'device': 'cpu'},
            encode_kwargs={'normalize_embeddings': True}
        )
        
        chunk_size = self.config.get('chunk_size', 800)
        chunk_overlap = self.config.get('chunk_overlap', 150)
        
        separators = self.config.get('separators', ["\n\n", "\n", ". ", "! ", "? ", " "])
        
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=separators
        )
        
        self.profile_dir.mkdir(parents=True, exist_ok=True)
        self.code_index_dir.mkdir(parents=True, exist_ok=True)
        self.text_index_dir.mkdir(parents=True, exist_ok=True)
        self.logger.info(f"=== FAISS Builder for profile: {profile} ===")
    
    def _load_config(self) -> Dict:
        config_path = PROJECT_ROOT / "assets" / "yaml" / f"{self.profile}.yaml"
        if not config_path.exists():
            raise FileNotFoundError(f"Config not found: {config_path}")
        with open(config_path, 'r') as f:
            config = yaml.safe_load(f)
        return config.get('doomsteadRAG', {})
    
    def _resolve_path(self, path_str: str) -> Path:
        path = Path(path_str)
        if path.is_absolute():
            self.logger.warning(f"Absolute path found in config: {path_str}. Converting to relative.")
            path_str_clean = str(path_str).replace('/var/www/html/doomsteadRAG/', '')
            path_str_clean = path_str_clean.replace('/var/www/html/homedog/', '')
            return PROJECT_ROOT / path_str_clean
        return PROJECT_ROOT / path_str
    
    def _get_file_extensions(self, file_type: str) -> List[str]:
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
        skip_patterns = ['venv', '__pycache__', '.venv', 'minified_']
        return any(pattern in str(file_path) for pattern in skip_patterns)
    
    def _load_code_documents_by_type(self) -> tuple[List[Document], List[Document]]:
        """Load documents, return (code_docs, text_docs)"""
        code_documents = []
        text_documents = []
        code_dirs = self.config.get('code_dirs', {})
        
        if not code_dirs:
            self.logger.info("No code_dirs configured in YAML")
            return code_documents, text_documents
        
        code_file_types = ['py', 'php', 'js', 'css', 'html']
        
        for file_type, dirs in code_dirs.items():
            extensions = self._get_file_extensions(file_type)
            if not extensions:
                self.logger.warning(f"No extensions defined for file type: {file_type}")
                continue
            
            uses_code_embedding = file_type.lower() in code_file_types
            embedding_type = 'code' if uses_code_embedding else 'text'
            
            self.logger.info(f"File type '{file_type}' -> embedding_type: {embedding_type}")
            
            for dir_path_str in dirs:
                path = self._resolve_path(dir_path_str)
                if not path.exists():
                    self.logger.warning(f"Path not found: {path}")
                    continue
                
                if path.is_file():
                    self.logger.info(f"Loading single file: {path}")
                    try:
                        with open(path, 'r', encoding='utf-8') as f:
                            content = f.read()
                        doc = Document(
                            page_content=content,
                            metadata={
                                'source': str(path),
                                'file_type': file_type,
                                'embedding_type': embedding_type
                            }
                        )
                        if embedding_type == 'code':
                            code_documents.append(doc)
                        else:
                            text_documents.append(doc)
                        self.logger.debug(f"  Loaded: {path.name}")
                    except Exception as e:
                        self.logger.error(f"Error reading {path}: {e}")
                else:
                    self.logger.info(f"Loading {file_type.upper()} files from {path}")
                    for ext in extensions:
                        for file_path in path.rglob(f"*{ext}"):
                            if self._should_skip_file(str(file_path)):
                                continue
                            try:
                                with open(file_path, 'r', encoding='utf-8') as f:
                                    content = f.read()
                                doc = Document(
                                    page_content=content,
                                    metadata={
                                        'source': str(file_path),
                                        'file_type': file_type,
                                        'embedding_type': embedding_type
                                    }
                                )
                                if embedding_type == 'code':
                                    code_documents.append(doc)
                                else:
                                    text_documents.append(doc)
                                self.logger.debug(f"  Loaded: {file_path.name}")
                            except UnicodeDecodeError:
                                try:
                                    with open(file_path, 'r', encoding='latin-1') as f:
                                        content = f.read()
                                    doc = Document(
                                        page_content=content,
                                        metadata={
                                            'source': str(file_path),
                                            'file_type': file_type,
                                            'embedding_type': embedding_type
                                        }
                                    )
                                    if embedding_type == 'code':
                                        code_documents.append(doc)
                                    else:
                                        text_documents.append(doc)
                                    self.logger.debug(f"  Loaded (latin-1): {file_path.name}")
                                except Exception as e:
                                    self.logger.error(f"Error reading {file_path}: {e}")
                            except Exception as e:
                                self.logger.error(f"Error reading {file_path}: {e}")
        
        return code_documents, text_documents
    
    def _load_pdf_documents(self) -> List[Document]:
        documents = []
        pdf_dirs = self.config.get('pdf', [])
        
        if not pdf_dirs:
            return documents
        
        for pdf_dir_str in pdf_dirs:
            path = self._resolve_path(pdf_dir_str)
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
                    doc.metadata['embedding_type'] = 'text'
                documents.extend(pdf_docs)
                self.logger.info(f"Loaded {len(pdf_docs)} PDF documents")
            except Exception as e:
                self.logger.error(f"Error loading PDFs from {path}: {e}")
        
        return documents
    
    def _load_specification_documents(self) -> List[Document]:
        documents = []
        spec_files = self.config.get('specification_files', [])
        
        if not spec_files:
            return documents
        
        for spec_path_str in spec_files:
            spec_path = self._resolve_path(spec_path_str)
            if not spec_path.exists():
                self.logger.warning(f"Specification file not found: {spec_path}")
                continue
            
            self.logger.info(f"Loading specification document: {spec_path}")
            try:
                with open(spec_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                doc = Document(
                    page_content=content,
                    metadata={
                        'source': str(spec_path),
                        'file_type': 'specification',
                        'embedding_type': 'text'
                    }
                )
                documents.append(doc)
                self.logger.info(f"Loaded specification document from {spec_path}")
            except Exception as e:
                self.logger.error(f"Error loading specification {spec_path}: {e}")
        
        return documents
    
    def build_index(self):
        try:
            code_documents = []
            text_documents = []
            
            # Load specification documents (always text)
            spec_docs = self._load_specification_documents()
            if spec_docs:
                text_documents.extend(spec_docs)
                self.logger.info(f"Loaded {len(spec_docs)} specification documents")
            
            # Load documents from code_dirs
            if self.config.get('code_dirs'):
                code_docs, text_docs = self._load_code_documents_by_type()
                code_documents.extend(code_docs)
                text_documents.extend(text_docs)
                self.logger.info(f"Loaded {len(code_documents)} code documents and {len(text_documents)} text documents from code_dirs")
            
            # Load PDF documents (always text)
            if self.config.get('pdf'):
                pdf_docs = self._load_pdf_documents()
                text_documents.extend(pdf_docs)
                self.logger.info(f"Loaded {len(pdf_docs)} PDF documents")
            
            # Build separate indexes for code and text
            code_success = self._build_code_index(code_documents)
            text_success = self._build_text_index(text_documents)
            
            if not code_success and not text_success:
                self.logger.error("No indexes were built successfully")
                return False
            
            self.logger.info("Build completed successfully!")
            return True
            
        except Exception as e:
            self.logger.error(f"Build failed: {e}", exc_info=True)
            return False
    
    def _build_code_index(self, documents: List[Document]) -> bool:
        if not documents:
            self.logger.info("No code documents to index")
            return False
        
        self.logger.info(f"Splitting {len(documents)} code documents into chunks...")
        chunks = self.splitter.split_documents(documents)
        self.logger.info(f"Created {len(chunks)} code chunks")
        
        if not chunks:
            return False
        
        self.logger.info(f"Building FAISS code index using {self.code_model_name}...")
        vectorstore = FAISS.from_documents(chunks, self.code_embeddings)
        
        self.logger.info(f"Saving code index to {self.code_index_dir}")
        vectorstore.save_local(str(self.code_index_dir))
        
        return True
    
    def _build_text_index(self, documents: List[Document]) -> bool:
        if not documents:
            self.logger.info("No text documents to index")
            return False
        
        self.logger.info(f"Splitting {len(documents)} text documents into chunks...")
        chunks = self.splitter.split_documents(documents)
        self.logger.info(f"Created {len(chunks)} text chunks")
        
        if not chunks:
            return False
        
        self.logger.info(f"Building FAISS text index using {self.text_model_name}...")
        vectorstore = FAISS.from_documents(chunks, self.text_embeddings)
        
        self.logger.info(f"Saving text index to {self.text_index_dir}")
        vectorstore.save_local(str(self.text_index_dir))
        
        # Save metadata
        metadata = {
            'profile': self.profile,
            'embedding_model': self.text_model_name,
            'total_chunks': len(chunks),
            'chunk_size': self.config.get('chunk_size', 800),
            'chunk_overlap': self.config.get('chunk_overlap', 150)
        }
        with open(self.text_index_dir / 'build_info.json', 'w') as f:
            json.dump(metadata, f, indent=2)
        
        return True

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--profile', required=True)
    args = parser.parse_args()
    builder = FAISSBuilder(args.profile)
    success = builder.build_index()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()