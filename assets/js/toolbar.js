// JS assets/js/toolbar.js - Modified version with visibility control

(function () {
  const statusDiv = document.createElement('div')
  
  // Track current profile
  let currentProfile = 'ragcode';
  
  /**
   * @function updateButtonVisibility
   * @description Sets button visibility based on current profile
   * Buttons hidden for Transcripts profile: Rebuild Vector Store (FAISS) and Refresh Vector Store
   */
  function updateButtonVisibility() {
    // Buttons to hide when processing transcripts
    const hiddenForTranscripts = ['full_build', 'vectordb'];
    
    hiddenForTranscripts.forEach(buttonId => {
      const button = document.getElementById(`button_${buttonId}`);
      if (button) {
        if (currentProfile === 'transcript') {
          button.style.display = 'none';
        } else {
          button.style.display = '';
        }
      }
    });
  }
  
  /**
   * @function loadtoolbar
   * @description Initializes the application toolbar.
   */
  function loadtoolbar() {
    let launcherPID = null
    const bar = document.getElementById("coderagtoolbar")
    const buttonlist = document.createElement('ul')
    buttonlist.id = 'coderag_menu_buttons'
    buttonlist.classList.add('coderag-menu')

    buttonlist.appendChild(addbuttondropdown('fileload', 'fileloadBTN', 'left', ['RAGcode','Doomstead','Mainpage','RAGdocs','Transcripts']))
    buttonlist.appendChild(addbutton('line1', 'dividerBTN', 'left', true))
    buttonlist.appendChild(addbutton('homeserver', 'homeserverBTN', 'left', false))
    buttonlist.appendChild(addbutton('full_build', 'dbuploadBTN', 'left', false))
    buttonlist.appendChild(addbutton('vectordb', 'dbrefreshBTN', 'left', false))
    buttonlist.appendChild(addbutton('loadmodel', 'dogrunBTN', 'left', false))
    buttonlist.appendChild(addbutton('checkmodel', 'sailboatBTN', 'left', false))
    buttonlist.appendChild(addbutton('fastapi', 'horuseyeBTN', 'left', false))
    buttonlist.appendChild(addbutton('homepage', 'targetBTN', 'right', false))
    buttonlist.appendChild(addbutton('line5', 'dividerBTN', 'right', true))
    buttonlist.appendChild(addbutton('book', 'bookBTN', 'right', false))

    const statusLi = document.createElement('li')
    statusLi.style.float = 'right'

    statusDiv.id = 'status'
    statusDiv.className = 'status'
    statusDiv.textContent = 'Checking Ollama status...'

    statusLi.appendChild(statusDiv)

    const bookButton = buttonlist.querySelector('#button_book')
    if (bookButton?.parentNode?.nextSibling) {
      buttonlist.insertBefore(statusLi, bookButton.parentNode.nextSibling)
    } else {
      buttonlist.appendChild(statusLi)
    }

    bar.appendChild(buttonlist)
    loadtooltips()
    
    // Start Ollama service checker
    startOllamaChecker();

    // Direct button binding - MORE RELIABLE
    const runButton = document.querySelector('#loadmodel.dogrunBTN');
    if (runButton) {
      runButton.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        loadmodel();
        return false;
      };
    }

    const checkButton = document.querySelector('#checkmodel.sailboatBTN');
    if (checkButton) {
      checkButton.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        checkmodel();
        return false;
      };
    }

    const fullBuildButton = document.querySelector('#full_build.dbuploadBTN');
    if (fullBuildButton) {
      fullBuildButton.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        rebuild_vectorstore();
        return false;
      };
    }
    
    const refreshButton = document.querySelector('#vectordb.dbrefreshBTN');
    if (refreshButton) {
      refreshButton.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        refresh_vectorstore();
        return false;
      };
    }

    // Initial visibility setup
    updateButtonVisibility();
  }

  function addbutton(id, className, side, isIndicator) {
    const a = document.createElement('a')
    a.id = id
    a.className = className
    a.textContent = className
    if (isIndicator) {
      a.style = 'background-position: 0 0px; margin-top: 0px; margin-left: 0px;'
    } else {
      a.href = '#'
    }

    const li = document.createElement('li')
    li.style.float = side
    li.id = `button_${id}`
    li.appendChild(a)
    return li
  }

  function addbuttondropdown(id, className, side, items) {
    const dropdownfunctions = {
      RAGcode: ragcode,
      Doomstead: doomsteadcode,
      Mainpage: mainpagecode,
      RAGdocs: ragdocs,
      Transcripts: transcripts
    }
    const li = document.createElement('li')
    li.style.float = side
    li.id = `button_${id}`

    const a = document.createElement('a')
    a.id = id
    a.className = className
    a.textContent = className
    a.href = '#'
    li.appendChild(a)

    const content = document.createElement('div')
    content.id = `dropdown_${id}`
    content.classList.add('dropdown')
    content.style.display = 'none'
    content.style.position = 'absolute'

    const ul = document.createElement('ul')
    ul.id = `ul_${id}`

    items.forEach(item => {
      const itemLink = document.createElement('a')
      itemLink.href = '#'
      itemLink.textContent = item
      itemLink.style.color = '#964b00'
      const liItem = document.createElement('li')
      liItem.appendChild(itemLink)
      ul.appendChild(liItem)
    })

    ul.addEventListener('click', (e) => {
      e.preventDefault()
      const target = e.target
      if (target.tagName === 'A') {
        const func = dropdownfunctions[target.textContent.trim()]
        if (func) func()
      }
    })

    content.appendChild(ul)
    document.body.appendChild(content)
    
    a.addEventListener('mouseenter', () => {
      const rect = a.getBoundingClientRect()
      content.style.left = `${rect.left}px`
      content.style.top = `${rect.bottom}px`
      content.style.display = 'block'
    })

    a.addEventListener('mouseleave', () => {
      setTimeout(() => {
        if (!content.matches(':hover')) {
          content.style.display = 'none'
        }
      }, 100)
    })

    content.addEventListener('mouseleave', () => {
      content.style.display = 'none'
    })

    content.addEventListener('mouseenter', () => {
      content.style.display = 'block'
    })
    return li
  }

  function loadtooltips() {
    const tooltips = {
      fileload: 'File Set',
      full_build: 'Rebuild Vector Store (FAISS)',
      vectordb: 'Refresh Vector Store',
      homeserver: 'Check Ollama Service',
      loadmodel: 'Load Model (Ollama)',
      checkmodel: 'Check Model (Ollama)',
      fastapi: 'Ollama API Docs',
      homepage: 'Homepage',
      book: 'Documentation'
    }
    for (const id in tooltips) {
      const el = document.getElementById(id)
      if (el) el.setAttribute('title', tooltips[id])
    }
  }

  function colordropdowntext(content) {
    const dropdown = document.getElementById('dropdown_fileload')
    if (dropdown) {
      const ul = dropdown.querySelector('ul')
      if (ul) {
        const items = ul.querySelectorAll('li a')
        items.forEach(item => {
          item.style.color = item.textContent.trim() === content ? '#006400' : '#964b00'
        })
      }
    }
  }

  function ragcode() {
    const content = { "filesetconfig": "ragcode" }
    fetch('assets/php/save_config.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(content)
    }).finally(() => {
      const dropdown = document.getElementById('dropdown_fileload')
      if (dropdown) dropdown.style.display = 'none'
      colordropdowntext("RAGcode")
      clearchatbox()
      currentProfile = 'ragcode';
      updateButtonVisibility();
      updatestatus('Switched to RAGcode profile. Click Run button to load model.')
      updatetooltitle('Retrieval Argumentation Generation for Code')
    })
  }

  function doomsteadcode() {
    const content = { "filesetconfig": "doomstead" }
    fetch('assets/php/save_config.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(content)
    }).finally(() => {
      const dropdown = document.getElementById('dropdown_fileload')
      if (dropdown) dropdown.style.display = 'none'
      colordropdowntext("Doomstead")
      clearchatbox()
      currentProfile = 'doomstead';
      updateButtonVisibility();
      updatestatus('Switched to Doomstead profile. Click Run button to load model.')
      updatetooltitle('Retrieval Argumentation Generation for Code')
    })
  }

  function mainpagecode() {
    const content = { "filesetconfig": "mainpage" }
    fetch('assets/php/save_config.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(content)
    }).finally(() => {
      const dropdown = document.getElementById('dropdown_fileload')
      if (dropdown) dropdown.style.display = 'none'
      colordropdowntext("Mainpage")
      clearchatbox()
      currentProfile = 'mainpage';
      updateButtonVisibility();
      updatestatus('Switched to Mainpage profile. Click Run button to load model.')
      updatetooltitle('Retrieval Argumentation Generation for Code')
    })
  }

  function ragdocs() {
    const content = { "filesetconfig": "ragdocs" }
    fetch('assets/php/save_config.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(content)
    }).finally(() => {
      const dropdown = document.getElementById('dropdown_fileload')
      if (dropdown) dropdown.style.display = 'none'
      colordropdowntext("RAGdocs")
      clearchatbox()
      currentProfile = 'ragdocs';
      updateButtonVisibility();
      updatestatus('Switched to RAGdocs profile. Click Run button to load model.')
      updatetooltitle('Retrieval Argumentation Generation for Code')
    })
  }

  function transcripts() {
    const content = { "filesetconfig": "transcript" }
    fetch('assets/php/save_config.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(content)
    }).finally(() => {
      const dropdown = document.getElementById('dropdown_fileload')
      if (dropdown) dropdown.style.display = 'none'
      colordropdowntext("Transcripts")
      clearchatbox()
      currentProfile = 'transcript';
      updateButtonVisibility();
      updatestatus('Switched to Transcript profile. Click Run button to load model.')
      updatetooltitle('Transcript Processor')
    })
  }

  function clearchatbox() {
    const chatbox = document.getElementById("chatbox")
    if (chatbox) chatbox.innerHTML = ""
  }

  function rebuild_vectorstore() {
    updatestatus('Building FAISS vector store...')
    const modal = new BuildModal()
    modal.startPolling()

    fetch('assets/php/full_builder.php', {
      method: 'POST',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/json'
      }
    }).catch((error) => {
      console.error('Build error:', error)
      updatestatus('Build failed - check logs')
    })
  }

  function refresh_vectorstore() {
    updatestatus('Refresh not implemented - use Full Build')
    alert('Use "Full Build" to rebuild the vector store completely.')
  }

  /**
   * @function startOllamaChecker
   * @description Starts scheduled task to check Ollama service every second
   */
  let ollamaOnline = false;
  let checkerInterval = null;
  
  function startOllamaChecker() {
    if (checkerInterval) {
      clearInterval(checkerInterval);
    }
    
    checkerInterval = setInterval(() => {
      checkOllamaService();
    }, 1000);
  }
  
  function checkOllamaService() {
    const homeserverBtn = document.getElementById('homeserver');
    
    fetch('http://localhost:11434/api/tags', {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache'
    })
      .then(response => {
        if (response.ok) {
          // Service is running
          if (!ollamaOnline && homeserverBtn) {
            homeserverBtn.classList.remove('homeservershift');
            ollamaOnline = true;
          }
          return response.json();
        }
        throw new Error('Service not responding');
      })
      .catch(() => {
        // Service is not running
        if (ollamaOnline || (!ollamaOnline && homeserverBtn && !homeserverBtn.classList.contains('homeservershift'))) {
          if (homeserverBtn) {
            homeserverBtn.classList.add('homeservershift');
          }
          ollamaOnline = false;
        }
      });
  }

  function load_server() {
    updatestatus('Checking Ollama service...')
    
    const homeserverBtn = document.getElementById('homeserver');
    const isShifted = homeserverBtn && homeserverBtn.classList.contains('homeservershift');
    
    if (ollamaOnline) {
      // Service is running, stop it
      updatestatus('Stopping Ollama service...');
      
      fetch('http://localhost:11434/api/tags', {
        method: 'GET'
      })
        .then(() => {
          // Can't stop via API, need systemctl
          alert('Please stop Ollama service with:\nsudo systemctl stop ollama');
          updatestatus('Ollama service running - use systemctl stop to stop');
        })
        .catch(() => {
          alert('Ollama service is not responding properly');
        });
    } else {
      // Service is not running, start it
      updatestatus('Starting Ollama service...');
      alert('Start Ollama service with:\nsudo systemctl start ollama\n\nOr use the start.sh script from the documentation.');
      updatestatus('Start it with: sudo systemctl start ollama');
    }
  }

  async function getCurrentProfile() {
    try {
      const response = await fetch('assets/data/config.json')
      const config = await response.json()
      return config.filesetconfig || 'ragcode'
    } catch (error) {
      return 'ragcode'
    }
  }

  // MAIN LOAD MODEL FUNCTION - This is the Run button handler
  async function loadmodel() {
    const statusDiv = document.getElementById('status');
    const promptInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendButton');
    
    if (statusDiv) statusDiv.textContent = "Loading model from config...";
    
    try {
      const response = await fetch('assets/php/force_reload_model.php');
      const data = await response.json();
      
      if (data.success) {
        if (statusDiv) statusDiv.textContent = `Model ready: ${data.new_model}`;
        if (promptInput) promptInput.disabled = false;
        if (sendBtn) sendBtn.disabled = false;
        console.log(`✓ Model loaded: ${data.new_model}`);
      } else {
        if (statusDiv) statusDiv.textContent = "Failed to load model";
        alert("Failed to load model. Check Ollama service.");
      }
    } catch (error) {
      console.error("Load model error:", error);
      if (statusDiv) statusDiv.textContent = "Error loading model";
      alert("Error: " + error.message);
    }
  }

  async function checkmodel() {
    updatestatus('Checking Ollama models...')
    
    try {
      const response = await fetch('assets/php/ollama_api.php?action=list')
      const data = await response.json()
      
      if (data.success && data.models) {
        if (data.models.length === 0) {
          alert('No models found in Ollama.\n\nPull a model first:\nollama pull deepseek-coder:6.7b')
          updatestatus('No models available')
        } else {
          const modelList = data.models.map(m => `${m.name} (${(m.size / 1024 / 1024 / 1024).toFixed(1)} GB)`).join('\n')
          alert(`Available Ollama models:\n\n${modelList}\n\nTo load a model, click the Run button.`)
          updatestatus(`${data.models.length} model(s) available`)
        }
      } else {
        updatestatus('Could not fetch models')
        alert('Error connecting to Ollama API')
      }
    } catch (error) {
      console.error('Check model error:', error)
      updatestatus('Ollama API error')
      alert('Could not connect to Ollama. Is it running?\n\nsudo systemctl start ollama')
    }
  }

  function fastapi() {
    window.open('https://github.com/ollama/ollama/blob/main/docs/api.md', '_blank', 'noopener,noreferrer')
  }

  function homepage() {
    window.open('https://chasingthesquirrel.com/doomstead/index.php', '_blank', 'noopener,noreferrer')
  }

  function book() {
    updatestatus('Documentation feature coming soon')
    alert('Documentation viewer will be implemented in future version')
  }

  function updatestatus(text) {
    if (statusDiv) {
      statusDiv.textContent = text
    }
  }

  function updatetooltitle(text) {
    let banner = document.getElementById("tooltitle");
    if (banner) banner.textContent = text;
  }

  window.loadtoolbar = loadtoolbar
  window.updatestatus = updatestatus
  window.rebuild_vectorstore = rebuild_vectorstore
  window.loadmodel = loadmodel
  window.checkmodel = checkmodel
})()

// Initialize toolbar when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.loadtoolbar === 'function') {
      window.loadtoolbar()
    }
  })
} else {
  if (typeof window.loadtoolbar === 'function') {
    window.loadtoolbar()
  }
}