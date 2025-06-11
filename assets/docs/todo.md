# TODO

## Model definition

### Define the model to be loaded in the yaml

Each codebase has a vector store db and a sqlite db for file tracking.  Write the update function.

Loggin of errors should not be done when polling.

Does the process that loads the server end when it completes?  if not the process must die when the UI is closed.


Use a Language-Specific Text Splitter: Leverage Langchain's RecursiveCharacterTextSplitter.from_language for better code chunking.

from langchain.text_splitter import RecursiveCharacterTextSplitter, Language

# In _init_splitter method:
def _init_splitter(self):
    # Determine language dynamically if possible, or configure per source
    # For a mixed codebase, you might need different splitters or process by language.
    # For example, to handle Python:
    return RecursiveCharacterTextSplitter.from_language(
        language=Language.PYTHON, # Or Language.JAVASCRIPT, Language.HTML, etc.
        chunk_size=self.config['chunk_size'],
        chunk_overlap=self.config['chunk_overlap']
    )

See: Abstract Syntax Tree (AST)

Enrich Code Metadata: Extract and store more semantic metadata (function/class names, imports, docstrings) to enable richer filtering and more relevant retrieval.



Verify Code-Specific Embedding Model: Ensure your embedding_model is genuinely designed for code understanding.




In full_builder.py

Monitoring last line should not skip lines.  Initialize a counter, and process lines from the last line processed to 
the end of lines in every poll.