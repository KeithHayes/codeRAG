document.addEventListener("DOMContentLoaded", function () {
    // Elements
    const sendBtn = document.getElementById("sendButton")
    const promptInput = document.getElementById("userInput")
    const chatbox = document.getElementById("chatbox")

    // Formatting functions
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

    // Message display
    function addMessage(text, sender = "user") {
        const msg = document.createElement("div")
        msg.className = `message ${sender}`
        
        if (sender === "user") {
            msg.innerHTML = `<strong>You:</strong> ${formatMessage(text)}`
        } else {
            const separatorIdx = text.indexOf(':')
            const prefix = separatorIdx > 0 
                ? `<strong>${text.substring(0, separatorIdx)}:</strong> `
                : ''
            const content = separatorIdx > 0 
                ? text.substring(separatorIdx + 1) 
                : text
                
            msg.innerHTML = prefix + `<p>${formatMessage(content)}</p>`
        }
        
        chatbox.appendChild(msg)
        chatbox.scrollTop = chatbox.scrollHeight
    }

    // API communication
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
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({ message: prompt }),
                signal: AbortSignal.timeout(360000) // 360 second timeout
            })
            
            const data = await res.json()
            if (data.response) {
                addMessage(`locaLLM: ${data.response}`, "bot")
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

    // Model status check
    async function updateModelStatus() {
        try {
            const res = await fetch("assets/php/rag.php", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: "message=status_check"
            })
            
            let data = await res.json()

            if (data.status === "loading") {
                window.updatestatus('Server for model not found.  Load server.')
            }
            
            if (data.status === "ready") {
                promptInput.disabled = false
                sendBtn.disabled = false
                promptInput.focus()
                
                const response = await fetch(`assets/php/model_api.php?action=check`)
                data = await response.json()
                if (data.success) {
                    if (data.model === 'None') {
                        window.updatestatus('The server does not have a model loaded.')
                    } else {
                        console.log(`${data.model} (Status: ${data.status}, Loader: ${data.loader})`)
                        const choplength = 30
                        if (data.model.length > choplength) {
                            data.model = data.model.substring(0, choplength) + '...'
                        }
                        window.updatestatus(`Using model: ${data.model}`)
                    }
                }
            } else {
                setTimeout(updateModelStatus, 3000)
            }
        } catch (err) {
            window.updatestatus("Model: Offline (retrying...)")
            setTimeout(updateModelStatus, 5000)
        }
    }

    window.updateModelStatus = updateModelStatus

    // Event listeners
    sendBtn.addEventListener("click", sendPrompt)
    promptInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") sendPrompt()
    })
    
    // Initialize
    promptInput.disabled = true
    sendBtn.disabled = true
    updateModelStatus()
})