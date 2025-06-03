markdown

# 🔁 Algorithm: Model-Initiated Vector Store Re-query in RAG

## **Objective**
Allow a local LLM in a **Retrieval-Augmented Generation (RAG)** system to indirectly trigger additional vector store searches by emitting structured commands (e.g., `🔍 SEARCH:`). The Python backend detects these commands and handles them in a feedback loop.

---

## **Actors & Layers**
| Layer           | Role                                                                 |
|-----------------|----------------------------------------------------------------------|
| **Frontend** (JavaScript) | User interaction UI. Sends AJAX requests to PHP.                     |
| **Backend** (PHP)        | Bridges frontend and Python RAG engine.                              |
| **Python RAG System**    | Handles document chunking, vector search, LLM queries, and response. |

---

## **Inputs**
- `user_query`: Natural language question from the user.
- `vectorstore`: FAISS, Chroma, or similar vector index.
- `llm`: Local language model (via `generate()` or API).

---

## **🧠 Algorithm Steps**

### **Step 1: Initial Vector Store Search**
```python
context_chunks = vectorstore.similarity_search(user_query, k=K)

    Perform vector search using user_query.

    K = number of top results (e.g., 4 or 8).

    Returns top-matching document chunks (context_chunks).

Step 2: Generate Initial LLM Response
python

context_text = combine_chunks(context_chunks)
prompt = build_prompt(context_text, user_query)
initial_response = llm.generate(prompt)

    Insert context_chunks into a system prompt.

    Ask the model to answer user_query based on the context.

    Store initial_response.

Step 3: Check for Model Command (e.g., 🔍 SEARCH)
python

def extract_search_command(text):
    match = re.search(r"🔍 SEARCH:\s*(.+)", text)
    return match.group(1).strip() if match else None

command = extract_search_command(initial_response)

    Scan LLM response for structured commands.

    If found, extract the search term (e.g., info_center).

Step 4: Re-query Vector Store (If Needed)
python

if command:
    secondary_chunks = vectorstore.similarity_search(command, k=K)
    refined_context = combine_chunks(secondary_chunks)
    refined_prompt = build_prompt(refined_context, user_query)
    final_response = llm.generate(refined_prompt)
else:
    final_response = initial_response

    Use command to re-search the vector store.

    Rebuild context with new chunks.

    Re-run the model with updated evidence.

    If no command, return initial_response.

Step 5: Return Final Output
python

return {
    "answer": final_response,
    "was_recursive": bool(command),
    "search_term": command or None,
    "chunks_used": secondary_chunks if command else context_chunks,
}

Key	Description
answer	Final LLM response.
was_recursive	Whether a re-query occurred.
search_term	Term used in re-query (if any).
chunks_used	Chunks that contributed to the answer.
🔒 Optional Enhancements

    Loop Prevention: Limit to 1 recursion cycle per query.

    Command Types: Support additional commands:

        📄 READ_FILE: index.php

        🧾 LIST_FILES

    Logging: Write to log.txt for debugging.

    Caching: Avoid duplicate searches for the same term.

💡 Summary

This approach enables the model to:

    Detect missing information.

    Request additional context.

    Trigger backend logic transparently (no UX changes).

    Improve answer quality without modifying JavaScript/PHP.

The algorithm is implemented purely in Python behind existing request/response pipelines.

✅ Ready to integrate into your RAG system!
Would you like a version embedded in script.py for direct use?


### Key Features:
- **Structured headings** for readability.
- **Code blocks** for algorithm steps.
- **Tables** for structured data (actors, outputs).
- **Emoji icons** for visual clarity.
- **Bullet points** for optional enhancements.

Let me know if you'd like adjustments (e.g., condensed format, additional details)! 🚀

New chat
AI-generated, for reference only

TODO

Add source highlighting
Include which document, file, or chunk produced that response.

Enable markdown formatting
Allow the model to return markdown which your JS renders for richer responses.

Add RAG context display
Below each answer, show the document snippet that was retrieved to support the generation.

Improve prompt template
Customize the system prompt for your use case. Currently it may be too generic.

Integrate full query logging
Capture full query → context → response logs for inspection and fine-tuning.