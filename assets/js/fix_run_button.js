// This will replace the loadmodel function
window.loadmodel = async function() {
    const statusDiv = document.getElementById('status');
    const promptInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendButton');
    
    statusDiv.textContent = "Stopping current model and loading from config...";
    
    try {
        const response = await fetch('assets/php/force_reload_model.php');
        const data = await response.json();
        
        if (data.success) {
            statusDiv.textContent = `Model ready: ${data.new_model} (Profile: ${data.profile})`;
            if (promptInput) promptInput.disabled = false;
            if (sendBtn) sendBtn.disabled = false;
            console.log(`Model loaded: ${data.new_model} from profile ${data.profile}`);
            if (data.old_model) {
                console.log(`Stopped previous model: ${data.old_model}`);
            }
        } else {
            statusDiv.textContent = "Failed to load model";
            alert("Failed to load model. Check Ollama service.");
        }
    } catch (error) {
        console.error("Load model error:", error);
        statusDiv.textContent = "Error loading model";
        alert("Error: " + error.message);
    }
};

// Override the existing handler
const runBtn = document.querySelector('#button_dogrunBTN a');
if (runBtn) {
    runBtn.onclick = (e) => {
        e.preventDefault();
        window.loadmodel();
    };
    console.log("Run button fixed!");
}
