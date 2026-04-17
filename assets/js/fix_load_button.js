// Run this in browser console to test
// Or add to toolbar.js

async function fixLoadModelButton() {
    // Find the load model button and override its behavior
    const loadBtn = document.querySelector('#button_dogrunBTN a');
    if (loadBtn) {
        loadBtn.onclick = async function(e) {
            e.preventDefault();
            const statusDiv = document.getElementById('status');
            statusDiv.textContent = "Loading model from config...";
            
            const res = await fetch('assets/php/auto_load_model.php');
            const data = await res.json();
            
            if (data.success) {
                statusDiv.textContent = `Model ready: ${data.model}`;
                document.getElementById('userInput').disabled = false;
                document.getElementById('sendButton').disabled = false;
                console.log("Model loaded successfully!");
            } else {
                statusDiv.textContent = "Failed to load model";
            }
        };
        console.log("Load model button fixed!");
    }
}

fixLoadModelButton();
