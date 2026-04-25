// JS assets/js/rag.js
document.addEventListener("DOMContentLoaded", function () {
    const sendBtn = document.getElementById("sendButton")
    const promptInput = document.getElementById("userInput")
    const chatbox = document.getElementById("chatbox")

    function escapeHTML(str) {
        const div = document.createElement('div')
        div.textContent = str
        return div.innerHTML
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
    }

    function formatMessage(text) {
        return escapeHTML(text)
            .replace(/\n\n+/g, '</p><p>')
            .replace(/\n/g, '<br>')
    }

    function addMessage(text, sender = "user") {
        const msg = document.createElement("div")
        msg.className = `message ${sender}`
        
        if (sender === "user") {
            msg.innerHTML = `<strong>You:</strong> ${formatMessage(text)}`
        } else {
            const prefix = '<strong>Assistant:</strong> '
            msg.innerHTML = prefix + `<p>${formatMessage(text)}</p>`
        }
        
        chatbox.appendChild(msg)
        chatbox.scrollTop = chatbox.scrollHeight
    }

    async function sendPrompt() {
        const prompt = promptInput.value.trim()
        if (!prompt) return
        
        addMessage(prompt, "user")
        promptInput.value = ""
        promptInput.disabled = true
        sendBtn.disabled = true

        try {
            const res = await fetch("assets/php/rag.php", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    action: "sendtask",
                    message: prompt 
                }),
                signal: AbortSignal.timeout(120000)
            })
            
            const data = await res.json()
            if (data.response) {
                addMessage(data.response, "bot")
            } else if (data.error) {
                addMessage(`Error: ${data.error}`, "bot")
            }
        } catch (err) {
            addMessage(`Request failed: ${err.message}`, "bot")
        } finally {
            promptInput.disabled = false
            sendBtn.disabled = false
            promptInput.focus()
        }
    }

    async function loadModelFromConfig() {
        if (window.updatestatus) {
            window.updatestatus("Loading model from config...")
        }
        
        try {
            const res = await fetch("assets/php/auto_load_model.php")
            const data = await res.json()
            
            if (data.success && data.status === "loaded") {
                if (window.updatestatus) {
                    window.updatestatus(`Model ready: ${data.model}`)
                }
                promptInput.disabled = false
                sendBtn.disabled = false
                promptInput.focus()
                return true
            } else {
                if (window.updatestatus) {
                    window.updatestatus(`Failed to load model. Check Ollama.`)
                }
                return false
            }
        } catch (err) {
            console.error("Auto-load failed:", err)
            if (window.updatestatus) {
                window.updatestatus("Click 'Load Model' button")
            }
            return false
        }
    }
    
    if (sendBtn) sendBtn.addEventListener("click", sendPrompt)
    if (promptInput) {
        promptInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") sendPrompt()
        })
        promptInput.disabled = true
        sendBtn.disabled = true
    }
    
    loadModelFromConfig()
})

window.updatestatus = window.updatestatus || function(text) {
    const statusDiv = document.getElementById('status');
    if (statusDiv) statusDiv.textContent = text;
}