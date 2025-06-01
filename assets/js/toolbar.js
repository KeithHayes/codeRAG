(function () {
  /**
   * @function loadtoolbar
   * @description Initializes the application toolbar.
   */
  function loadtoolbar() {
    const bar = document.getElementById("dynamotoolbar");
    const buttonlist = document.createElement('ul');
    buttonlist.id = 'dynamo_menu_buttons';
    buttonlist.classList.add('dynamo-menu');

    buttonlist.appendChild(addbuttondropdown('fileload', 'fileloadBTN', 'left', ['Default']));
    buttonlist.appendChild(addbutton('line1', 'dividerBTN', 'left', true));
    buttonlist.appendChild(addbutton('full_build', 'eraserBTN', 'left', false));
    buttonlist.appendChild(addbutton('vectordb', 'vectordbBTN', 'left', false));
    buttonlist.appendChild(addbutton('hashtag', 'hashtagBTN', 'left', false));
    buttonlist.appendChild(addbutton('shapesstack', 'shapesstackBTN', 'left', false));
    buttonlist.appendChild(addbutton('run', 'dogrunBTN', 'left', false));
    buttonlist.appendChild(addbutton('csvdata', 'filesaveBTN', 'left', false));
    buttonlist.appendChild(addbutton('homepage', 'targetBTN', 'right', false));
    buttonlist.appendChild(addbutton('line5', 'dividerBTN', 'right', true));
    buttonlist.appendChild(addbutton('book', 'bookBTN', 'right', false));

    const statusLi = document.createElement('li')
    statusLi.style.float = 'right'

    const statusDiv = document.createElement('div')
    statusDiv.id = 'status'
    statusDiv.className = 'status'
    statusDiv.textContent = 'Checking model status...'

    statusLi.appendChild(statusDiv)

    // Append AFTER the book button (so it appears even farther right when floated)
    const bookButton = buttonlist.querySelector('#button_book')
    if (bookButton?.parentNode?.nextSibling) {
      buttonlist.insertBefore(statusLi, bookButton.parentNode.nextSibling)
    } else {
      buttonlist.appendChild(statusLi)
    }

    bar.appendChild(buttonlist);

    const toolbarfunctions = {
      fileloadBTN: fileload,
      eraserBTN: rebuild_vectorstore,
      vectordbBTN: refresh_vectorstore,
      hashtagBTN: hashtag,
      dogrunBTN: run,
      printerBTN: print,
      bookBTN: book,
      targetBTN: homepage
    };

    loadtooltips();

    buttonlist.onclick = (e) => {
      e.preventDefault()
      toolbarfunctions[e.target.innerHTML]()
    }
  }

  /**
   * @function addbutton
   * @description Creates a toolbar button.
   */
  function addbutton(id, className, side, isIndicator) {
    const a = document.createElement('a');
    a.id = id;
    a.className = className;
    a.textContent = className;
    if (isIndicator) {
      a.style = 'background-position: 0 0px; margin-top: 0px; margin-left: 0px;';
    } else {
      a.href = '#';
    }

    const li = document.createElement('li');
    li.style.float = side;
    li.id = `button_${id}`;
    li.appendChild(a);
    return li;
  }

  /**
   * @function addbuttondropdown
   * @description Creates a dropdown toolbar button.
   */
  function addbuttondropdown(id, className, side, items) {
    const dropdownfunctions = { Load: fileload, Default: loaddefault };
    const li = document.createElement('li');
    li.style.float = side;
    li.id = `button_${id}`;

    const a = document.createElement('a');
    a.id = id;
    a.className = className;
    a.textContent = className;
    a.href = '#';
    li.appendChild(a);

    const content = document.createElement('div');
    content.classList.add('dropdown');

    const ul = document.createElement('ul');
    ul.id = `ul_${id}`;

    items.forEach(item => {
      const itemLink = document.createElement('a');
      itemLink.href = '#';
      itemLink.textContent = item;
      const liItem = document.createElement('li');
      liItem.appendChild(itemLink);
      ul.appendChild(liItem);
    });

    ul.addEventListener('click', (e) => {
      e.preventDefault();
      const target = e.target;
      if (target.tagName === 'A') {
        dropdownfunctions[target.textContent.trim()]?.();
      }
    });

    content.appendChild(ul);
    li.appendChild(content);
    return li;
  }

  /**
   * @function addtablearrow
   * @description Adds a directional arrow button.
   */
  function addtablearrow(id, className, text) {
    const bar = document.getElementById("dynamotoolbar");
    const list = bar.querySelector('.dynamo-menu');
    const ref = list.querySelector('#button_book');

    const li = document.createElement('li');
    li.style.float = 'right';
    li.id = id;
    li.innerHTML = `<a id="${className}" class="${className}" href="#">${text}</a>`;

    ref?.insertAdjacentElement('beforebegin', li) || list.appendChild(li);
  }

  function addarrowleft() {
    addtablearrow('button_left', 'leftBTN', 'leftBTN');
  }

  function addarrowright() {
    addtablearrow('button_right', 'rightBTN', 'rightBTN');
  }

  function addpagescroll() {
    const list = document.getElementById("dynamotoolbar").querySelector('.dynamo-menu')
    if (!list.querySelector('#button_up')) {
      const ref = list.querySelector('#button_book')
      ['down', 'up'].forEach(dir => {
        const li = document.createElement('li')
        li.style.float = 'right'
        li.id = `button_${dir}`
        li.innerHTML = `<a id="page${dir}" class="page${dir === 'up' ? 'in' : 'out'}BTN" href="#">page${dir === 'up' ? 'in' : 'out'}BTN</a>`
        ref.insertAdjacentElement('afterend', li)
      });
    }
  }

  function loadtooltips() {
    const tooltips = {
      fileload: 'Load Dynamo Cards',
      full_build: 'Rebuild Vector Store',
      vectordb: 'Refresh Vector Store',
      hashtag: 'Initial Values',
      shapesstack: 'Processed Cards',
      run: 'Run Model',
      print: 'Print Results',
      plot: 'Plot Results',
      csvdata: 'Print or Plot CSV File'
    };
    for (const id in tooltips) {
      document.getElementById(id)?.setAttribute('title', tooltips[id])
    }
  }

  /**
   * @function statusColor
   * @description Visually indicates status by shifting button background.
   */
  function statusColor(StatusID, shift) {
    const el = document.getElementById(StatusID)
    if (el) {
      el.style.backgroundPosition = `0 ${shift}px`
    }
  }

  /**
   * @function fileload
   * @description Code for button.
   */
  function fileload() {

  }

  /**
   * @function rebuild_vectorstore
   * @description Code for button.
   */
  function rebuild_vectorstore() {
    const modal = new BuildModal();
    modal.startPolling();

    fetch('assets/php/full_builder.php', {
      method: 'POST',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/json'
      }
    }).catch(() => {
      // Ignore fetch errors completely
    });
  }

  /**
   * @function refresh_vectorstore
   * @description Code for button.
   */
  function refresh_vectorstore() {
      const modal = new BuildModal();
    modal.startPolling();

    fetch('assets/php/test_query.php', {
      method: 'POST',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/json'
      }
    }).catch(() => {
      // Ignore fetch errors completely
    });
  }

  /**
   * @function loaddefault
   * @description Code for button.
   */
  function loaddefault() {

  }

  window.loadtoolbar = loadtoolbar

})()

window.loadtoolbar()