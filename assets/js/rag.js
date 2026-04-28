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
        if (window.transitionTo) {
            window.transitionTo('model_auto_loading')
        }
        
        try {
            const res = await fetch("assets/php/auto_load_model.php")
            const data = await res.json()
            
            if (data.success && data.status === "loaded") {
                if (window.transitionTo) {
                    window.transitionTo('model_ready', { modelName: data.model })
                }
                promptInput.disabled = false
                sendBtn.disabled = false
                promptInput.focus()
                return true
            } else {
                if (window.transitionTo) {
                    const errorMsg = data.message || 'Failed to load model'
                    window.transitionTo('model_failed', { modelName: data.model || 'unknown', error: errorMsg })
                }
                return false
            }
        } catch (err) {
            console.error("Auto-load failed:", err)
            if (window.transitionTo) {
                window.transitionTo('error', { errorMsg: 'Click Load Model button' })
            }
            return false
        }
    }
    
    // GPU Power Monitoring – fixed to ensure widget updates properly
    async function fetchGPUPower() {
        const powerElement = document.getElementById('gpuPower')
        const timestampElement = document.getElementById('gpuTimestamp')
        const gpuLabelSpan = document.querySelector('.gpu-label')
        const gpuWidget = document.getElementById('gpuWidget')
        
        // If widget doesn't exist in DOM, exit silently
        if (!gpuWidget) return
        
        try {
            const response = await fetch("assets/php/rag.php", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "gpu_power" })
            })
            if (!response.ok) throw new Error('HTTP ' + response.status)
            const data = await response.json()
            
            // Update GPU name if available
            if (gpuLabelSpan && data.gpu_name && data.gpu_name !== 'GPU') {
                gpuLabelSpan.innerHTML = `🎮 ${data.gpu_name}`
            }
            
            // Extract numeric power value
            let powerValue = data.power
            if (typeof powerValue === 'string') {
                powerValue = powerValue.replace(' W', '')
            }
            const watts = parseFloat(powerValue)
            
            if (powerElement) {
                if (isNaN(watts)) {
                    powerElement.textContent = '--'
                    powerElement.style.color = '#888'
                } else {
                    powerElement.textContent = Math.round(watts)
                    if (watts > 150) {
                        powerElement.style.color = '#ff6b6b'
                    } else if (watts > 100) {
                        powerElement.style.color = '#ffd93d'
                    } else {
                        powerElement.style.color = '#6bcb77'
                    }
                }
            }
            
            if (timestampElement && data.timestamp) {
                timestampElement.textContent = data.timestamp
            }
        } catch (error) {
            console.error('GPU Monitor Error:', error)
            if (powerElement) {
                powerElement.textContent = 'Err'
                powerElement.style.color = '#ff6b6b'
            }
            if (timestampElement) {
                timestampElement.textContent = '--:--:--'
            }
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
    
    // Start GPU monitoring if widget exists – with error recovery
    if (document.getElementById('gpuWidget')) {
        // Initial fetch
        fetchGPUPower()
        // Set up interval (every 2 seconds)
        const intervalId = setInterval(fetchGPUPower, 2000)
        // Optional: clear interval on page unload
        window.addEventListener('beforeunload', function() {
            clearInterval(intervalId)
        })
    }
})

window.updatestatus = window.updatestatus || function(text) {
    const statusDiv = document.getElementById('status')
    if (statusDiv) statusDiv.textContent = text
}