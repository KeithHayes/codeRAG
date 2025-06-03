<!DOCTYPE html>
<html>
<head>
    <title>LLM code RAG</title>
    <link rel="stylesheet" href="assets/css/rag.css">
    <link rel="stylesheet" href="./assets/css/toolbar.css">
    <link rel="stylesheet" href="./assets/css/toolbarbuttons.css">
    <link rel="stylesheet" href="./assets/css/w3.css">
</head>
<body>
<div id="main_content" class="w3-twothird w3-panel">
    <h1>Retrieval Argumentation Generation for Code</h1>
    <div id="coderagtoolbar"></div>
    <div id="chatbox"></div>
    <div id="inputContainer">
        <input type="text" id="userInput" placeholder="Type your question..." autocomplete="off" disabled>
        <button id="sendButton" onclick="sendMessage()" disabled>Send</button>
    </div>
</div>
<script src="assets/js/rag.js"></script>
<script src="assets/js/build_modal.js"></script>
<script src="assets/js/toolbar.js"></script></body>
</html>
