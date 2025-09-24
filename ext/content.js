(function () {
  // ---------- Helpers ----------
  function getEditorCode() {
    try {
      // Preferred: Monaco API
      if (window.monaco && window.monaco.editor) {
        const models = window.monaco.editor.getModels();
        if (models && models.length > 0) {
          return models.map(m => m.getValue()).join('\n\n');
        }
      }

      // Fallback: DOM-based approach (may not work for shadow DOM)
      const editorElement = document.querySelector('.monaco-editor');
      if (editorElement) {
        const codeLines = editorElement.querySelectorAll('.view-line');
        if (codeLines && codeLines.length > 0) {
          return Array.from(codeLines).map(l => l.textContent).join('\n');
        }
      }
    } catch (err) {
      console.warn('getEditorCode error:', err);
    }
    return '';
  }

  function safeSetText(container, text) {
    container.textContent = text;
  }

  // Create standard result UI (returns {resultDiv, toggleButton})
  function createResultUI() {
    const resultDiv = document.createElement("div");
    resultDiv.style.position = "fixed";
    resultDiv.style.bottom = "60px";
    resultDiv.style.left = "50%";
    resultDiv.style.transform = "translateX(-50%)";
    resultDiv.style.padding = "15px";
    resultDiv.style.background = "white";
    resultDiv.style.border = "1px solid #e8e8e8";
    resultDiv.style.borderRadius = "8px";
    resultDiv.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
    resultDiv.style.zIndex = "10000";
    resultDiv.style.display = "none";
    resultDiv.style.width = "340px";
    resultDiv.style.maxHeight = "400px";
    resultDiv.style.overflowY = "auto";

    document.body.appendChild(resultDiv);

    const toggleButton = document.createElement("button");
    toggleButton.innerHTML = "−";
    toggleButton.style.padding = "5px 10px";
    toggleButton.style.border = "none";
    toggleButton.style.backgroundColor = "#f0f0f0";
    toggleButton.style.borderRadius = "4px";
    toggleButton.style.cursor = "pointer";
    toggleButton.style.color = "#666";
    toggleButton.style.width = "40px";
    toggleButton.style.fontSize = "16px";
    toggleButton.style.display = "none";

    let isMinimized = false;
    toggleButton.addEventListener("click", () => {
      if (isMinimized) {
        resultDiv.style.display = "block";
        toggleButton.innerHTML = "−";
      } else {
        resultDiv.style.display = "none";
        toggleButton.innerHTML = "+";
      }
      isMinimized = !isMinimized;
    });

    toggleButton.addEventListener('mouseover', () => {
      toggleButton.style.backgroundColor = "#e0e0e0";
    });
    toggleButton.addEventListener('mouseout', () => {
      toggleButton.style.backgroundColor = "#f0f0f0";
    });

    return { resultDiv, toggleButton };
  }

  // Render analysis safely into resultDiv
  function renderAnalysis(resultDiv, analysis) {
    resultDiv.innerHTML = ''; // clear
    const wrapper = document.createElement('div');
    wrapper.style.fontFamily = 'monospace';
    wrapper.style.lineHeight = '1.5';

    const timeDiv = document.createElement('div');
    timeDiv.style.marginBottom = '12px';
    timeDiv.innerHTML = `<span style="color:#2cbb5d; font-weight:bold">Time Complexity: </span>`;
    const timeVal = document.createElement('span');
    timeVal.style.fontSize = '16px';
    timeVal.style.fontWeight = '700';
    timeVal.textContent = analysis?.complexity?.time ?? 'Not specified';
    timeDiv.appendChild(timeVal);

    const spaceDiv = document.createElement('div');
    spaceDiv.style.marginBottom = '12px';
    spaceDiv.innerHTML = `<span style="color:#2cbb5d; font-weight:bold">Space Complexity: </span>`;
    const spaceVal = document.createElement('span');
    spaceVal.style.fontSize = '16px';
    spaceVal.style.fontWeight = '700';
    spaceVal.textContent = analysis?.complexity?.space ?? 'Not specified';
    spaceDiv.appendChild(spaceVal);

    const sep = document.createElement('div');
    sep.style.borderTop = '1px solid #e8e8e8';
    sep.style.paddingTop = '10px';
    sep.style.marginTop = '10px';

    const explainTitle = document.createElement('div');
    explainTitle.style.color = '#666';
    explainTitle.textContent = 'Explanation:';

    const explainBody = document.createElement('pre');
    explainBody.style.marginTop = '6px';
    explainBody.style.color = '#1a1a1a';
    explainBody.style.whiteSpace = 'pre-wrap';
    explainBody.style.fontFamily = 'inherit';
    explainBody.textContent = analysis?.explanation ?? 'No explanation provided';

    sep.appendChild(explainTitle);
    sep.appendChild(explainBody);

    wrapper.appendChild(timeDiv);
    wrapper.appendChild(spaceDiv);
    wrapper.appendChild(sep);

    resultDiv.appendChild(wrapper);
  }

  function renderError(resultDiv, message, details) {
    resultDiv.innerHTML = '';
    const errDiv = document.createElement('div');
    errDiv.style.color = '#ff4444';
    errDiv.style.marginBottom = '10px';
    errDiv.textContent = message || 'Analysis failed';

    const detailsDiv = document.createElement('div');
    detailsDiv.style.color = '#666';
    detailsDiv.style.fontSize = '12px';
    if (details) {
      detailsDiv.textContent = typeof details === 'string' ? details : JSON.stringify(details);
    }

    resultDiv.appendChild(errDiv);
    resultDiv.appendChild(detailsDiv);
  }

  // analyzeWithRetry that expects background responses shaped { ok, payload } or { ok:false, ... }
  async function analyzeWithRetry(code, resultDiv, maxRetries = 2) {
    let retryCount = 0;

    function attemptSend() {
      return new Promise((resolve) => {
        try {
          chrome.runtime.sendMessage({ code }, (response) => {
            // defensive: capture chrome.runtime.lastError
            const lastErr = chrome.runtime && chrome.runtime.lastError ? chrome.runtime.lastError : null;
            resolve({ response, lastErr });
          });
        } catch (err) {
          resolve({ response: null, lastErr: err });
        }
      });
    }

    while (retryCount <= maxRetries) {
      if (retryCount > 0) {
        resultDiv.innerHTML = `<div style="margin-bottom:10px;font-weight:bold">Retrying analysis... (Attempt ${retryCount + 1}/${maxRetries + 1})</div><div style="color:#666">Please wait...</div>`;
      }

      const { response, lastErr } = await attemptSend();
      console.log(`analyzeWithRetry attempt ${retryCount + 1} response:`, response, 'lastErr:', lastErr);

      try {
        if (lastErr) {
          throw new Error(lastErr.message || String(lastErr));
        }

        if (!response) {
          throw new Error('No response from background script');
        }

        if (response.ok === false) {
          // background returned structured error
          const serverMsg = response.serverError ?? response.error ?? response;
          throw new Error(`Background error: ${JSON.stringify(serverMsg)}`);
        }

        // success path: response.ok === true and response.payload exists
        const payload = response.payload;
        if (!payload) {
          throw new Error('Background returned no payload');
        }

        // payload may be a JSON string (if you instructed model to return JSON), or plain text.
        let analysisObj = null;
        if (typeof payload === 'string') {
          // Try parse – if parsing fails, treat payload as plain explanation text
          try {
            analysisObj = JSON.parse(payload);
          } catch (_) {
            // If not JSON, the model might have returned text; attempt to extract JSON inside text
            // Try to find first {...} block and parse it
            const jsonMatch = payload.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                analysisObj = JSON.parse(jsonMatch[0]);
              } catch (_) {
                // give up; wrap text
                analysisObj = { complexity: { time: 'Unknown', space: 'Unknown' }, explanation: payload };
              }
            } else {
              analysisObj = { complexity: { time: 'Unknown', space: 'Unknown' }, explanation: payload };
            }
          }
        } else if (typeof payload === 'object') {
          analysisObj = payload;
        } else {
          analysisObj = { complexity: { time: 'Unknown', space: 'Unknown' }, explanation: String(payload) };
        }

        // Render the analysis
        renderAnalysis(resultDiv, analysisObj);
        return;
      } catch (err) {
        console.error(`Attempt ${retryCount + 1} failed:`, err);
        retryCount++;
        if (retryCount > maxRetries) {
          renderError(resultDiv, `Analysis failed after ${maxRetries + 1} attempts`, err.message || String(err));
          return;
        } else {
          // small wait before retrying
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }
  }

  // ---------- UI placement logic ----------
  function positionNextToElement(targetElement, insertBefore) {
    // Basic guard
    if (!targetElement || !targetElement.parentNode) return false;

    // Create shared UI elements
    const buttonContainer = document.createElement("div");
    buttonContainer.style.display = "inline-flex";
    buttonContainer.style.gap = "5px";
    buttonContainer.style.marginRight = "10px";
    buttonContainer.style.marginLeft = "10px";
    buttonContainer.style.zIndex = "10000";
    buttonContainer.style.verticalAlign = "middle";
    buttonContainer.style.alignItems = "center";
    buttonContainer.style.height = "100%";

    const isSubmitButton = !!targetElement.querySelector && !!targetElement.querySelector('span.text-sm.font-medium');
    const hasPlayIcon = !!targetElement.querySelector && !!targetElement.querySelector('svg.fa-play');

    if (isSubmitButton || hasPlayIcon) {
      buttonContainer.style.margin = "5px 5px";
      buttonContainer.style.marginTop = "-2px";
    }

    const toggleButton = document.createElement("button");
    toggleButton.innerHTML = "−";
    toggleButton.style.padding = "5px 10px";
    toggleButton.style.border = "none";
    toggleButton.style.backgroundColor = "#f0f0f0";
    toggleButton.style.borderRadius = "4px";
    toggleButton.style.cursor = "pointer";
    toggleButton.style.color = "#666";
    toggleButton.style.width = "40px";
    toggleButton.style.fontSize = "16px";
    toggleButton.style.display = "none";
    toggleButton.style.height = "2rem";

    const analyzeButton = document.createElement("button");
    analyzeButton.textContent = "Analyze Code";
    analyzeButton.style.padding = "5px 10px";
    analyzeButton.style.backgroundColor = "#f7df1e";
    analyzeButton.style.color = "black";
    analyzeButton.style.border = "1px solid #e6d000";
    analyzeButton.style.borderRadius = "4px";
    analyzeButton.style.cursor = "pointer";

    if (isSubmitButton || hasPlayIcon) {
      analyzeButton.style.height = "32px";
      analyzeButton.style.fontSize = "14px";
      analyzeButton.style.fontWeight = "500";
      analyzeButton.style.display = "inline-flex";
      analyzeButton.style.alignItems = "center";
      analyzeButton.style.justifyContent = "center";
      analyzeButton.style.verticalAlign = "middle";
    } else {
      analyzeButton.style.height = "2rem";
      analyzeButton.style.fontSize = "15px";
    }

    buttonContainer.appendChild(toggleButton);
    buttonContainer.appendChild(analyzeButton);

    if (insertBefore) {
      targetElement.parentNode.insertBefore(buttonContainer, targetElement);
    } else {
      if (targetElement.nextSibling) {
        targetElement.parentNode.insertBefore(buttonContainer, targetElement.nextSibling);
      } else {
        targetElement.parentNode.appendChild(buttonContainer);
      }
    }

    const { resultDiv, toggleButton: createdToggle } = (function () {
      // If a resultDiv already exists (from previous insertions) reuse it
      const existing = document.querySelector('div[data-ccan-result]');
      if (existing) {
        // find its associated toggle if present
        let existingToggle = document.querySelector('button[data-ccan-toggle]');
        return { resultDiv: existing, toggleButton: existingToggle || toggleButton };
      }
      // else create new and mark it
      const ui = createResultUI();
      ui.resultDiv.setAttribute('data-ccan-result', '1');
      ui.toggleButton.setAttribute('data-ccan-toggle', '1');
      // Place toggle visually near our buttons for convenience
      buttonContainer.insertBefore(ui.toggleButton, buttonContainer.firstChild);
      return { resultDiv: ui.resultDiv, toggleButton: ui.toggleButton };
    })();

    // Make analyze button open the result UI and run analyzer
    analyzeButton.addEventListener("click", async function () {
      const code = getEditorCode();
      if (!code) {
        alert("Could not find code in the editor. Please make sure you're on a LeetCode problem page and the editor has code.");
        return;
      }

      resultDiv.style.display = "block";
      createdToggle.style.display = "inline-block";
      createdToggle.innerHTML = "−";

      // Show initial analyzing UI
      resultDiv.innerHTML = `
        <div style="margin-bottom: 10px; font-weight: bold;">Analyzing code...</div>
        <div style="color: #666;">Please wait while we analyze the complexity...</div>
      `;

      await analyzeWithRetry(code, resultDiv, 2);
    });

    return true;
  }

  // Try to position buttons immediately
  function positionButtons() {
    // First try to find the Run button with id
    const runButton = document.querySelector('#run-button');
    if (runButton) return positionNextToElement(runButton, true);

    const submitButton = document.querySelector('span.text-sm.font-medium');
    if (submitButton && submitButton.textContent.trim() === 'Submit') {
      let parentButton = submitButton;
      while (parentButton && parentButton.tagName !== 'BUTTON' && parentButton.parentElement) {
        parentButton = parentButton.parentElement;
      }
      if (parentButton && parentButton.tagName === 'BUTTON') {
        return positionNextToElement(parentButton, false);
      }
    }

    const playIcon = document.querySelector('svg.fa-play');
    if (playIcon) {
      let parentButton = playIcon;
      while (parentButton && parentButton.tagName !== 'BUTTON' && parentButton.parentElement) {
        parentButton = parentButton.parentElement;
      }
      if (parentButton && parentButton.tagName === 'BUTTON') {
        return positionNextToElement(parentButton, false);
      }
    }

    const stickyNoteSvg = document.querySelector('svg.fa-note-sticky');
    if (stickyNoteSvg) {
      let targetElement = stickyNoteSvg;
      for (let i = 0; i < 3 && targetElement.parentElement; i++) {
        targetElement = targetElement.parentElement;
      }
      return positionNextToElement(targetElement, false);
    }

    return false;
  }

  // Initial try
  if (!positionButtons()) {
    // If elements aren't found immediately, try again after a short delay
    setTimeout(() => {
      if (!positionButtons()) {
        // fallback: place fixed buttons at bottom center
        const existingFixed = document.querySelector('div[data-ccan-fixed]');
        if (existingFixed) return;

        const buttonContainer = document.createElement("div");
        buttonContainer.setAttribute('data-ccan-fixed', '1');
        buttonContainer.style.position = "fixed";
        buttonContainer.style.bottom = "20px";
        buttonContainer.style.left = "50%";
        buttonContainer.style.transform = "translateX(-50%)";
        buttonContainer.style.zIndex = "10000";
        buttonContainer.style.display = "flex";
        buttonContainer.style.gap = "5px";

        const { resultDiv, toggleButton } = createResultUI();
        resultDiv.setAttribute('data-ccan-result', '1');
        toggleButton.setAttribute('data-ccan-toggle', '1');
        toggleButton.style.display = "none";

        const analyzeButton = document.createElement("button");
        analyzeButton.textContent = "Analyze Code";
        analyzeButton.style.padding = "10px";
        analyzeButton.style.backgroundColor = "#f7df1e";
        analyzeButton.style.color = "black";
        analyzeButton.style.border = "none";
        analyzeButton.style.borderRadius = "4px";
        analyzeButton.style.cursor = "pointer";

        buttonContainer.appendChild(toggleButton);
        buttonContainer.appendChild(analyzeButton);
        document.body.appendChild(buttonContainer);

        analyzeButton.addEventListener('click', async () => {
          const code = getEditorCode();
          if (!code) {
            alert("Could not find code in the editor. Please make sure you're on a LeetCode problem page and the editor has code.");
            return;
          }

          resultDiv.style.display = "block";
          toggleButton.style.display = "inline-block";
          toggleButton.innerHTML = "−";

          resultDiv.innerHTML = `<div style="margin-bottom:10px;font-weight:bold">Analyzing code...</div><div style="color:#666">Please wait while we analyze the complexity...</div>`;

          await analyzeWithRetry(code, resultDiv, 2);
        });
      }
    }, 2000);
  }
})();
