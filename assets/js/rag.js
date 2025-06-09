document.addEventListener("DOMContentLoaded", function () {
    // Elements
    const statusEl = document.getElementById("status");
    const sendBtn = document.getElementById("sendButton");
    const promptInput = document.getElementById("userInput");
    const chatbox = document.getElementById("chatbox");

    // Formatting functions
    function escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
    }

    function formatMessage(text) {
        return escapeHTML(text)
            .replace(/\n\n+/g, '</p><p>')
            .replace(/\n/g, '<br>');
    }

    // Message display
    function addMessage(text, sender = "user") {
        const msg = document.createElement("div");
        msg.className = `message ${sender}`;
        
        if (sender === "user") {
            msg.innerHTML = `<strong>You:</strong> ${formatMessage(text)}`;
        } else {
            // Parse LLM response (assumes "ModelName: Response" format)
            const separatorIdx = text.indexOf(':');
            const prefix = separatorIdx > 0 
                ? `<strong>${text.substring(0, separatorIdx)}:</strong> `
                : '';
            const content = separatorIdx > 0 
                ? text.substring(separatorIdx + 1) 
                : text;
                
            msg.innerHTML = prefix + `<p>${formatMessage(content)}</p>`;
        }
        
        chatbox.appendChild(msg);
        chatbox.scrollTop = chatbox.scrollHeight;
    }

    // API communication
    async function sendPrompt() {
        const prompt = promptInput.value.trim();
        if (!prompt) return;
        
        addMessage(prompt, "user");
        promptInput.value = "";
        promptInput.disabled = true;
        sendBtn.disabled = true;

        try {
            const res = await fetch("assets/php/rag.php", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({ message: prompt })
            });
            
            const data = await res.json();
            if (data.response) {
                addMessage(`${data.model || "LLM"}: ${data.response}`, "bot");
            } else if (data.error) {
                addMessage(`Error: ${data.error}`, "bot");
            }
        } catch (err) {
            addMessage(`Request failed: ${err.message}`, "bot");
        } finally {
            promptInput.disabled = false;
            sendBtn.disabled = false;
            promptInput.focus();
        }
    }

    // Model status check
    async function updateModelStatus() {
        try {
            const res = await fetch("assets/php/rag.php", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: "message=status_check"
            });
            
            const data = await res.json();
            statusEl.textContent = `Model: ${data.model || "Unknown"} (${data.status || "unknown"})`;
            
            if (data.status === "ready") {
                promptInput.disabled = false;
                sendBtn.disabled = false;
                promptInput.focus();
            } else {
                setTimeout(updateModelStatus, 3000);
            }
        } catch (err) {
            statusEl.textContent = "Model: Offline (retrying...)";
            setTimeout(updateModelStatus, 5000);
        }
    }

    // Event listeners
    sendBtn.addEventListener("click", sendPrompt);
    promptInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") sendPrompt();
    });
    
    // Initialize
    promptInput.disabled = true;
    sendBtn.disabled = true;
    updateModelStatus();
});