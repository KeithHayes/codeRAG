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