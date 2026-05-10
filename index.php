<!DOCTYPE html>
<html>
<head>
    <title>LLM code RAG</title>
    <link rel="stylesheet" href="assets/css/rag.css">
    <link rel="stylesheet" href="./assets/css/toolbar.css">
    <link rel="stylesheet" href="./assets/css/toolbarbuttons.css">
    <link rel="stylesheet" href="./assets/css/w3.css">
    <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
<div class="w3-row">
    <div id="main_content" class="w3-threequarter w3-panel">
        <h1 id="tooltitle">Retrieval Argumentation Generation for Code</h1>
        <div id="coderagtoolbar"></div>
        <div id="chatbox"></div>
        <div id="inputContainer">
            <input type="text" id="userInput" placeholder="Type your question..." autocomplete="off" disabled>
            <button id="sendButton" onclick="sendMessage()" disabled>Send</button>
        </div>
    </div>
    <div id="sidebar" class="w3-quarter w3-panel">
        <!-- GPU Power Monitor Widget -->
        <div class="gpu-widget" id="gpuWidget">
            <span class="gpu-label">🎮 RTX 3060</span>
            <div class="gpu-power-container">
                <span class="gpu-power" id="gpuPower">--</span>
                <span class="gpu-unit">Watts</span>
            </div>
            <span class="gpu-timestamp" id="gpuTimestamp">--:--:--</span>
        </div>
    </div>
</div>
<script src="assets/js/rag.js"></script>
<script src="assets/js/build_modal.js"></script>
<script src="assets/js/clipboard_modal.js"></script>
<script src="assets/js/model_modal.js"></script>
<script src="assets/js/processtranscript.js"></script>
<script src="assets/js/processinterview.js"></script>
<script src="assets/js/toolbar.js"></script>
</body>
</html>