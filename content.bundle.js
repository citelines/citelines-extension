(() => {
  // src/content/state.js
  var currentVideoId = null;
  var annotations = {};
  var sharedAnnotations = [];
  var markersContainer = null;
  var creatorMarkersContainer = null;
  var citationTimeline = null;
  var timelineCollapsed = false;
  var addButton = null;
  var sidebarButton = null;
  var sidebar = null;
  var sidebarOpen = false;
  var sidebarFilter = "all";
  var activePopup = null;
  var userShareId = null;
  var bookmarkShareId = null;
  var bookmarkAnnotations = [];
  var loginButton = null;
  var loginUI = null;
  var expiryWarning = null;
  var accountSidebar = null;
  var accountSidebarOpen = false;
  var currentVideoChannelId = null;
  var adObserver = null;
  var playerObserver = null;
  var initialized = false;
  function setCurrentVideoId(id) {
    currentVideoId = id;
  }
  function setSharedAnnotations(val) {
    sharedAnnotations = val;
  }
  function setMarkersContainer(val) {
    markersContainer = val;
  }
  function setCreatorMarkersContainer(val) {
    creatorMarkersContainer = val;
  }
  function setCitationTimeline(val) {
    citationTimeline = val;
  }
  function setTimelineCollapsed(val) {
    timelineCollapsed = val;
  }
  function setAddButton(val) {
    addButton = val;
  }
  function setSidebarButton(val) {
    sidebarButton = val;
  }
  function setSidebar(val) {
    sidebar = val;
  }
  function setSidebarOpen(val) {
    sidebarOpen = val;
  }
  function setSidebarFilter(val) {
    sidebarFilter = val;
  }
  function setActivePopup(val) {
    activePopup = val;
  }
  function setUserShareId(val) {
    userShareId = val;
  }
  function setBookmarkShareId(val) {
    bookmarkShareId = val;
  }
  function setBookmarkAnnotations(val) {
    bookmarkAnnotations = val;
  }
  function setLoginButton(val) {
    loginButton = val;
  }
  function setLoginUI(val) {
    loginUI = val;
  }
  function setExpiryWarning(val) {
    expiryWarning = val;
  }
  function setAccountSidebar(val) {
    accountSidebar = val;
  }
  function setAccountSidebarOpen(val) {
    accountSidebarOpen = val;
  }
  function setCurrentVideoChannelId(val) {
    currentVideoChannelId = val;
  }
  function setAdObserver(val) {
    adObserver = val;
  }
  function setPlayerObserver(val) {
    playerObserver = val;
  }
  function setInitialized(val) {
    initialized = val;
  }

  // src/content/globals.js
  var api = window.api;
  var authManager = window.authManager;
  var LoginUI = window.LoginUI;
  var UserProfileUI = window.UserProfileUI;
  var analytics = window.analytics;
  var connectYouTubeChannel = window.connectYouTubeChannel;
  var createShareButton = window.createShareButton;
  var createBrowseButton = window.createBrowseButton;
  var showShareModal = window.showShareModal;
  var showBrowseModal = window.showBrowseModal;
  var showImportModal = window.showImportModal;

  // src/content/utils.js
  function getVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("v");
  }
  function formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor(seconds % 3600 / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }
  function formatDate(citation) {
    if (!citation.month && !citation.day && !citation.year) return "";
    const parts = [];
    if (citation.month) parts.push(citation.month);
    if (citation.day) parts.push(citation.day);
    if (citation.year) parts.push(citation.year);
    return parts.join(" ");
  }
  function formatCreationTime(isoString) {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      const now = /* @__PURE__ */ new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 6e4);
      const diffHours = Math.floor(diffMs / 36e5);
      const diffDays = Math.floor(diffMs / 864e5);
      if (diffMins < 1) return "just now";
      if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
      if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
      const options = { month: "short", day: "numeric", year: "numeric" };
      return date.toLocaleDateString("en-US", options);
    } catch (e) {
      return "";
    }
  }
  function formatCitation(citation, isOwn = true) {
    if (!citation || !citation.type) return "";
    const ownershipClass = isOwn ? "" : " other";
    let html = `<div class="yt-annotator-citation${ownershipClass}">`;
    switch (citation.type) {
      case "youtube":
        html += '<div class="yt-annotator-citation-icon">\u{1F3A5}</div>';
        html += '<div class="yt-annotator-citation-content">';
        if (citation.url) {
          html += `<a href="${escapeHtml(citation.url)}" target="_blank" rel="noopener noreferrer" class="yt-annotator-citation-title">${escapeHtml(citation.title || "YouTube Video")}</a>`;
        } else {
          html += `<span class="yt-annotator-citation-title">${escapeHtml(citation.title || "YouTube Video")}</span>`;
        }
        const youtubeDate = formatDate(citation);
        if (youtubeDate) {
          html += `<div class="yt-annotator-citation-meta">${escapeHtml(youtubeDate)}</div>`;
        }
        html += "</div>";
        break;
      case "movie":
        html += '<div class="yt-annotator-citation-icon">\u{1F3AC}</div>';
        html += '<div class="yt-annotator-citation-content">';
        html += `<span class="yt-annotator-citation-title">${escapeHtml(citation.title || "Movie")}</span>`;
        const movieMeta = [];
        if (citation.year) movieMeta.push(citation.year);
        if (citation.director) movieMeta.push(`dir. ${citation.director}`);
        if (movieMeta.length > 0) {
          html += `<div class="yt-annotator-citation-meta">${escapeHtml(movieMeta.join(" \u2022 "))}</div>`;
        }
        html += "</div>";
        break;
      case "article":
        html += '<div class="yt-annotator-citation-icon">\u{1F4C4}</div>';
        html += '<div class="yt-annotator-citation-content">';
        if (citation.url) {
          html += `<a href="${escapeHtml(citation.url)}" target="_blank" rel="noopener noreferrer" class="yt-annotator-citation-title">${escapeHtml(citation.title || "Article")}</a>`;
        } else {
          html += `<span class="yt-annotator-citation-title">${escapeHtml(citation.title || "Article")}</span>`;
        }
        const articleMeta = [];
        if (citation.author) articleMeta.push(`by ${citation.author}`);
        const articleDate = formatDate(citation);
        if (articleDate) articleMeta.push(articleDate);
        if (articleMeta.length > 0) {
          html += `<div class="yt-annotator-citation-meta">${escapeHtml(articleMeta.join(" \u2022 "))}</div>`;
        }
        html += "</div>";
        break;
    }
    html += "</div>";
    return html;
  }
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
  function getInitials(displayName) {
    const words = displayName.trim().split(/\s+/);
    return words.slice(0, 2).map((w) => w[0].toUpperCase()).join("");
  }

  // src/content/creatorMode.js
  function getVideoChannelId() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "GET_CHANNEL_ID" }, (response) => {
        if (chrome.runtime.lastError) {
          console.log("[Creator] Could not get channel ID:", chrome.runtime.lastError.message);
          return resolve(null);
        }
        const id = response?.channelId || null;
        console.log("[Creator] Video channel ID:", id);
        resolve(id);
      });
    });
  }
  function isCreatorMode() {
    return !!(currentVideoChannelId && authManager.isLoggedIn() && authManager.getYouTubeChannelId() === currentVideoChannelId);
  }
  function updateCreatorMode() {
    const creatorMode = isCreatorMode();
    const elements = [addButton, sidebarButton, loginButton, sidebar, accountSidebar].filter(Boolean);
    elements.forEach((el) => el.classList.toggle("creator-mode", creatorMode));
  }

  // src/content/citationFields.js
  var CITATION_FIELD_DEFS = {
    note: [],
    youtube: [
      { key: "title", label: "Title", source: "citation" },
      { key: "url", label: "URL", source: "citation" },
      { key: "date", label: "Date", source: "citation", isDate: true }
    ],
    movie: [
      { key: "title", label: "Title", source: "citation" },
      { key: "year", label: "Year", source: "citation" },
      { key: "director", label: "Director", source: "citation" }
    ],
    article: [
      { key: "title", label: "Title", source: "citation" },
      { key: "url", label: "URL", source: "citation" },
      { key: "author", label: "Author", source: "citation" },
      { key: "date", label: "Date", source: "citation", isDate: true }
    ]
  };
  function getFieldsForCitation(citationType) {
    return [
      ...CITATION_FIELD_DEFS[citationType] || [],
      { key: "text", label: "Note", source: "text" }
    ];
  }
  function getFieldOriginalValue(field, citation, originalText) {
    if (field.isDate) return formatDate(citation);
    if (field.source === "citation") return citation[field.key] || "";
    return originalText;
  }
  function buildFieldEditorHTML(fields, citation, originalText) {
    let html = "";
    for (const field of fields) {
      const origVal = getFieldOriginalValue(field, citation, originalText);
      const displayVal = origVal || "(empty)";
      if (field.isDate) {
        html += `
        <div class="yt-annotator-suggest-field" data-field="${field.key}">
          <span class="yt-annotator-report-label">${field.label}</span>
          <div class="yt-annotator-suggest-row">
            <div class="yt-annotator-suggest-original">${escapeHtml(displayVal)}</div>
            <button class="yt-annotator-suggest-edit-btn" title="Edit">&#9998;</button>
          </div>
          <div class="yt-annotator-suggest-input-wrap" style="display: none;">
            <div style="display: flex; gap: 6px; flex: 1;">
              <input type="text" class="yt-annotator-suggest-input" data-date-part="month" placeholder="Month" value="${escapeHtml(citation.month || "")}" style="flex: 1;" />
              <input type="text" class="yt-annotator-suggest-input" data-date-part="day" placeholder="Day" value="${escapeHtml(citation.day || "")}" style="flex: 1;" />
              <input type="text" class="yt-annotator-suggest-input" data-date-part="year" placeholder="Year" value="${escapeHtml(citation.year || "")}" style="flex: 1;" />
            </div>
            <button class="yt-annotator-suggest-collapse-btn" title="Cancel edit">&times;</button>
          </div>
        </div>`;
      } else {
        const isTextarea = field.key === "text";
        const inputTag = isTextarea ? `<textarea class="yt-annotator-suggest-input" data-field-key="${field.key}">${escapeHtml(origVal)}</textarea>` : `<input type="text" class="yt-annotator-suggest-input" data-field-key="${field.key}" value="${escapeHtml(origVal)}" />`;
        html += `
        <div class="yt-annotator-suggest-field" data-field="${field.key}">
          <span class="yt-annotator-report-label">${field.label}</span>
          <div class="yt-annotator-suggest-row">
            <div class="yt-annotator-suggest-original">${escapeHtml(displayVal)}</div>
            <button class="yt-annotator-suggest-edit-btn" title="Edit">&#9998;</button>
          </div>
          <div class="yt-annotator-suggest-input-wrap" style="display: none;">
            ${inputTag}
            <button class="yt-annotator-suggest-collapse-btn" title="Cancel edit">&times;</button>
          </div>
        </div>`;
      }
    }
    return html;
  }
  function wireFieldEditorToggle(container) {
    container.querySelectorAll(".yt-annotator-suggest-field").forEach((fieldEl) => {
      const editBtn = fieldEl.querySelector(".yt-annotator-suggest-edit-btn");
      const inputWrap = fieldEl.querySelector(".yt-annotator-suggest-input-wrap");
      const collapseBtn = fieldEl.querySelector(".yt-annotator-suggest-collapse-btn");
      const toggle = () => {
        const visible = inputWrap.style.display !== "none";
        inputWrap.style.display = visible ? "none" : "flex";
        editBtn.classList.toggle("active", !visible);
      };
      editBtn.addEventListener("click", toggle);
      collapseBtn.addEventListener("click", toggle);
    });
    container.querySelectorAll("textarea, input").forEach((el) => {
      el.addEventListener("keydown", (e) => e.stopPropagation());
      el.addEventListener("keyup", (e) => e.stopPropagation());
      el.addEventListener("keypress", (e) => e.stopPropagation());
    });
  }
  function collectFieldChanges(container, fields, citation, originalText) {
    const changes = {};
    const citationChanges = {};
    for (const field of fields) {
      const fieldEl = container.querySelector(`.yt-annotator-suggest-field[data-field="${field.key}"]`);
      const inputWrap = fieldEl.querySelector(".yt-annotator-suggest-input-wrap");
      if (inputWrap.style.display === "none") continue;
      if (field.isDate) {
        const m = fieldEl.querySelector('[data-date-part="month"]').value.trim();
        const d = fieldEl.querySelector('[data-date-part="day"]').value.trim();
        const y = fieldEl.querySelector('[data-date-part="year"]').value.trim();
        const origM = citation.month || "";
        const origD = citation.day || "";
        const origY = citation.year || "";
        if (m !== origM || d !== origD || y !== origY) {
          citationChanges.month = m;
          citationChanges.day = d;
          citationChanges.year = y;
        }
      } else if (field.source === "citation") {
        const val = fieldEl.querySelector(`[data-field-key="${field.key}"]`).value.trim();
        const orig = citation[field.key] || "";
        if (val !== orig) {
          citationChanges[field.key] = val;
        }
      } else {
        const val = fieldEl.querySelector(`[data-field-key="${field.key}"]`).value.trim();
        if (val !== originalText) {
          changes.text = val;
        }
      }
    }
    if (Object.keys(citationChanges).length > 0) {
      changes.citation = citationChanges;
    }
    return changes;
  }

  // src/content/modals.js
  function showReportModal(annotation) {
    const reasons = [
      "Inaccurate or misleading",
      "Spam or self-promotion",
      "Offensive or inappropriate",
      "Irrelevant to video",
      "Other"
    ];
    const modal = document.createElement("div");
    modal.className = "yt-annotator-report-modal";
    modal.innerHTML = `
    <div class="yt-annotator-report-content">
      <button class="yt-annotator-report-close">&times;</button>
      <h3>Report Citation</h3>
      <p style="color: #aaa; font-size: 13px; margin: 0 0 16px 0;">Why are you reporting this citation?</p>
      <div class="yt-annotator-report-reasons">
        ${reasons.map((r, i) => `
          <label class="yt-annotator-report-reason">
            <input type="radio" name="report-reason" value="${escapeHtml(r)}" ${i === 0 ? "checked" : ""}>
            <span>${escapeHtml(r)}</span>
          </label>
        `).join("")}
      </div>
      <div style="margin-bottom: 4px;">
        <span class="yt-annotator-report-label">Additional details (optional):</span>
        <textarea class="yt-annotator-report-textarea" placeholder="Provide any extra context..."></textarea>
      </div>
      <div class="yt-annotator-report-actions">
        <button class="yt-annotator-btn yt-annotator-btn-secondary" data-action="cancel">Cancel</button>
        <button class="yt-annotator-btn yt-annotator-btn-primary" data-action="submit">Submit</button>
      </div>
    </div>
  `;
    modal.querySelectorAll("textarea").forEach((ta) => {
      ta.addEventListener("keydown", (e) => e.stopPropagation());
      ta.addEventListener("keyup", (e) => e.stopPropagation());
      ta.addEventListener("keypress", (e) => e.stopPropagation());
    });
    const closeModal = () => modal.remove();
    modal.querySelector(".yt-annotator-report-close").addEventListener("click", closeModal);
    modal.querySelector('[data-action="cancel"]').addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
    modal.querySelector('[data-action="submit"]').addEventListener("click", async () => {
      const reason = modal.querySelector('input[name="report-reason"]:checked')?.value;
      const details = modal.querySelector(".yt-annotator-report-textarea").value.trim();
      try {
        await api.reportCitation(annotation.shareToken, annotation.id, reason, details);
        const content = modal.querySelector(".yt-annotator-report-content");
        content.innerHTML = `
        <button class="yt-annotator-report-close">&times;</button>
        <h3>Report Citation</h3>
        <div class="yt-annotator-report-success">
          Thank you for your report. Our team will<br>review this citation.
        </div>
        <div class="yt-annotator-report-actions">
          <button class="yt-annotator-btn yt-annotator-btn-primary" data-action="close">Close</button>
        </div>
      `;
        content.querySelector(".yt-annotator-report-close").addEventListener("click", closeModal);
        content.querySelector('[data-action="close"]').addEventListener("click", closeModal);
      } catch (error) {
        console.error("Failed to submit report:", error);
      }
    });
    document.body.appendChild(modal);
  }
  async function handleSuggestAction(annotation) {
    if (annotation.userHasSuggestion) {
      try {
        const result = await api.getMySuggestion(annotation.shareToken, annotation.id);
        if (result.suggestion) {
          showSuggestModal(annotation, result.suggestion);
          return;
        }
      } catch (error) {
        console.error("Failed to fetch existing suggestion:", error);
      }
    }
    showSuggestModal(annotation, null);
  }
  function showSuggestModal(annotation, existingSuggestion = null) {
    const citation = annotation.citation || {};
    const citationType = citation.type || "note";
    const originalText = annotation.text || "";
    const fields = getFieldsForCitation(citationType);
    const fieldsHTML = buildFieldEditorHTML(fields, citation, originalText);
    const isEditing = !!existingSuggestion;
    const modalTitle = isEditing ? "View My Suggestion" : "Suggest a Change";
    const submitLabel = isEditing ? "Update Suggestion" : "Submit";
    const existingReason = isEditing ? existingSuggestion.reason || "" : "";
    let existingChanges = {};
    if (isEditing && existingSuggestion.suggestedText) {
      try {
        existingChanges = JSON.parse(existingSuggestion.suggestedText);
      } catch (e) {
      }
    }
    const modal = document.createElement("div");
    modal.className = "yt-annotator-report-modal";
    modal.innerHTML = `
    <div class="yt-annotator-report-content">
      <button class="yt-annotator-report-close">&times;</button>
      <h3>${modalTitle}</h3>
      ${fieldsHTML}
      <div style="margin-top: 14px; margin-bottom: 4px;">
        <span class="yt-annotator-report-label">Reason (optional):</span>
        <textarea class="yt-annotator-report-textarea yt-annotator-suggest-reason" placeholder="Why this change?">${escapeHtml(existingReason)}</textarea>
      </div>
      <div class="yt-annotator-report-actions">
        <button class="yt-annotator-btn yt-annotator-btn-secondary" data-action="cancel">Cancel</button>
        <button class="yt-annotator-btn yt-annotator-btn-primary" data-action="submit">${submitLabel}</button>
      </div>
    </div>
  `;
    wireFieldEditorToggle(modal);
    if (isEditing && Object.keys(existingChanges).length > 0) {
      for (const field of fields) {
        let hasChange = false;
        if (field.isDate && existingChanges.citation) {
          hasChange = "month" in existingChanges.citation || "day" in existingChanges.citation || "year" in existingChanges.citation;
        } else if (field.source === "citation" && existingChanges.citation && field.key in existingChanges.citation) {
          hasChange = true;
        } else if (field.key === "text" && "text" in existingChanges) {
          hasChange = true;
        }
        if (hasChange) {
          const fieldEl = modal.querySelector(`.yt-annotator-suggest-field[data-field="${field.key}"]`);
          if (!fieldEl) continue;
          const inputWrap = fieldEl.querySelector(".yt-annotator-suggest-input-wrap");
          const editBtn = fieldEl.querySelector(".yt-annotator-suggest-edit-btn");
          inputWrap.style.display = "flex";
          editBtn.classList.add("active");
          if (field.isDate && existingChanges.citation) {
            const mInput = fieldEl.querySelector('[data-date-part="month"]');
            const dInput = fieldEl.querySelector('[data-date-part="day"]');
            const yInput = fieldEl.querySelector('[data-date-part="year"]');
            if (mInput && existingChanges.citation.month !== void 0) mInput.value = existingChanges.citation.month;
            if (dInput && existingChanges.citation.day !== void 0) dInput.value = existingChanges.citation.day;
            if (yInput && existingChanges.citation.year !== void 0) yInput.value = existingChanges.citation.year;
          } else if (field.source === "citation" && existingChanges.citation) {
            const input = fieldEl.querySelector(`[data-field-key="${field.key}"]`);
            if (input) input.value = existingChanges.citation[field.key];
          } else if (field.key === "text") {
            const input = fieldEl.querySelector(`[data-field-key="text"]`);
            if (input) input.value = existingChanges.text;
          }
        }
      }
    }
    const closeModal = () => modal.remove();
    modal.querySelector(".yt-annotator-report-close").addEventListener("click", closeModal);
    modal.querySelector('[data-action="cancel"]').addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
    modal.querySelector('[data-action="submit"]').addEventListener("click", async () => {
      const reason = modal.querySelector(".yt-annotator-suggest-reason").value.trim();
      const changes = collectFieldChanges(modal, fields, citation, originalText);
      if (Object.keys(changes).length === 0) return;
      const suggestedText = JSON.stringify(changes);
      try {
        if (isEditing) {
          await api.updateSuggestion(existingSuggestion.id, suggestedText, reason);
        } else {
          await api.suggestEdit(annotation.shareToken, annotation.id, suggestedText, reason);
        }
        annotation.userHasSuggestion = true;
        const successMsg = isEditing ? "Your suggestion has been updated." : "Your suggestion has been submitted.<br>The citation author will be notified.";
        const content = modal.querySelector(".yt-annotator-report-content");
        content.innerHTML = `
        <button class="yt-annotator-report-close">&times;</button>
        <h3>${modalTitle}</h3>
        <div class="yt-annotator-report-success">
          ${successMsg}
        </div>
        <div class="yt-annotator-report-actions">
          <button class="yt-annotator-btn yt-annotator-btn-primary" data-action="close">Close</button>
        </div>
      `;
        content.querySelector(".yt-annotator-report-close").addEventListener("click", closeModal);
        content.querySelector('[data-action="close"]').addEventListener("click", closeModal);
      } catch (error) {
        console.error("Failed to submit suggestion:", error);
      }
    });
    document.body.appendChild(modal);
  }

  // src/content/theme.js
  var STORAGE_KEY = "citelines_theme_pref";
  var currentPref = "auto";
  var ytObserver = null;
  function isYouTubeDark() {
    if (document.documentElement.hasAttribute("dark")) return true;
    if (document.documentElement.classList.contains("dark")) return true;
    return false;
  }
  function getEffectiveTheme() {
    if (currentPref === "light" || currentPref === "dark") return currentPref;
    return isYouTubeDark() ? "dark" : "light";
  }
  function applyTheme() {
    const theme = getEffectiveTheme();
    const timeline = document.querySelector(".citelines-timeline");
    if (timeline) {
      timeline.classList.toggle("citelines-light", theme === "light");
    }
    document.querySelectorAll(".yt-annotator-popup, .yt-annotator-popup-create").forEach((el) => {
      el.classList.toggle("citelines-light", theme === "light");
    });
    const sidebar2 = document.querySelector(".yt-annotator-account-sidebar");
    if (sidebar2) {
      sidebar2.classList.toggle("citelines-light", theme === "light");
    }
    const annSidebar = document.querySelector(".yt-annotator-sidebar");
    if (annSidebar) {
      annSidebar.classList.toggle("citelines-light", theme === "light");
    }
  }
  function startYouTubeThemeObserver() {
    if (ytObserver) return;
    ytObserver = new MutationObserver(() => {
      if (currentPref === "auto") applyTheme();
    });
    ytObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["dark", "class"]
    });
  }
  async function initTheme() {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    currentPref = result[STORAGE_KEY] || "auto";
    applyTheme();
    startYouTubeThemeObserver();
  }
  function getThemePref() {
    return currentPref;
  }
  async function setThemePref(pref) {
    currentPref = pref;
    await chrome.storage.local.set({ [STORAGE_KEY]: pref });
    applyTheme();
  }

  // src/content/popup.js
  function closePopup() {
    if (activePopup) {
      activePopup.remove();
      setActivePopup(null);
    }
    const connector = document.querySelector(".yt-annotator-popup-connector");
    if (connector) {
      connector.remove();
    }
  }
  function positionPopupNearMarker(popup, markerEl) {
    if (!markerEl) return;
    const markerRect = markerEl.getBoundingClientRect();
    const timelineEl = document.querySelector(".citelines-timeline");
    if (!timelineEl) return;
    const timelineRect = timelineEl.getBoundingClientRect();
    const popupWidth = popup.offsetWidth;
    const popupHeight = popup.offsetHeight;
    const markerCenterX = markerRect.left + markerRect.width / 2 - timelineRect.left;
    let popupLeft = markerCenterX - popupWidth / 2;
    const padding = 8;
    popupLeft = Math.max(padding, Math.min(popupLeft, timelineRect.width - popupWidth - padding));
    const popupBottom = timelineRect.bottom - markerRect.top + 8;
    popup.style.position = "absolute";
    popup.style.left = `${popupLeft}px`;
    popup.style.bottom = `${popupBottom}px`;
    popup.style.top = "auto";
    popup.style.transform = "none";
  }
  function showAnnotationPopup(annotation, video, isShared = false, markerEl = null) {
    closePopup();
    if (annotation.adminDeleted) return;
    const timelineEl = document.querySelector(".citelines-timeline");
    const popupContainer = timelineEl || document.querySelector("#movie_player");
    if (!popupContainer) return;
    const popup = document.createElement("div");
    popup.className = "yt-annotator-popup";
    const isBookmark = !!annotation.isBookmark;
    const creatorName = annotation.creatorDisplayName || "Anonymous";
    let badge;
    if (isBookmark) {
      badge = `<span style="background: #0497a6; color: #000; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: 600; margin-left: 8px;">Bookmark</span>`;
    } else if (annotation.isCreatorCitation) {
      const ownSuffix = !isShared ? " (YOU)" : "";
      badge = `<span style="background: #ffaa3e; color: #000; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: 600; margin-left: 8px;">Creator${ownSuffix} - ${escapeHtml(creatorName)}</span>`;
    } else if (!isShared) {
      badge = `<span style="background: #0497a6; color: #000; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: 600; margin-left: 8px; border: 2px solid #3a3a3a;">YOU - ${escapeHtml(creatorName)}</span>`;
    } else {
      badge = `<span style="background: #3a3a3a; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; margin-left: 8px;">${escapeHtml(creatorName)}</span>`;
    }
    const citationHTML = isBookmark ? "" : formatCitation(annotation.citation, !isShared);
    const creationTime = formatCreationTime(annotation.createdAt);
    const creationTimeHTML = creationTime ? `<div class="yt-annotator-creation-time">Created ${creationTime}</div>` : "";
    const editedTimeHTML = annotation.editedAt ? `<div class="yt-annotator-edited-time">Edited ${formatCreationTime(annotation.editedAt)}</div>` : "";
    const bookmarkMetaHTML = isBookmark ? `<div class="yt-annotator-bookmark-meta">Only visible to you</div>` : "";
    const suggestionCount = annotation.suggestionCount || 0;
    const suggestionBadgeHTML = !isShared && !isBookmark && suggestionCount > 0 ? `<div class="yt-annotator-suggestion-badge" title="View suggestions">&#128161; ${suggestionCount} suggestion${suggestionCount !== 1 ? "s" : ""}</div>` : "";
    popup.innerHTML = `
    <div class="yt-annotator-popup-header">
      <span class="yt-annotator-popup-timestamp">${formatTime(annotation.timestamp)}${badge}</span>
      <div style="display: flex; align-items: center; gap: 4px;">
        <button class="yt-annotator-actions-btn" title="Actions">&#8942;</button>
        <button class="yt-annotator-popup-close">&times;</button>
      </div>
    </div>
    ${citationHTML}
    <div class="yt-annotator-popup-content">${escapeHtml(annotation.text)}</div>
    ${creationTimeHTML}
    ${editedTimeHTML}
    ${bookmarkMetaHTML}
    ${suggestionBadgeHTML}
    <div class="yt-annotator-suggestion-detail" style="display: none;"></div>
    <div class="yt-annotator-popup-actions">
      <button class="yt-annotator-btn yt-annotator-btn-secondary" data-action="goto">Go to</button>
    </div>
  `;
    popup.querySelector(".yt-annotator-popup-close").addEventListener("click", closePopup);
    const suggestionBadge = popup.querySelector(".yt-annotator-suggestion-badge");
    if (suggestionBadge) {
      suggestionBadge.addEventListener("click", async (e) => {
        e.stopPropagation();
        const detailDiv = popup.querySelector(".yt-annotator-suggestion-detail");
        if (!detailDiv) return;
        if (detailDiv.style.display !== "none") {
          detailDiv.style.display = "none";
          return;
        }
        detailDiv.style.display = "block";
        detailDiv.innerHTML = '<div style="color: #aaa; font-size: 12px; padding: 8px;">Loading suggestions...</div>';
        try {
          const result = await api.getSuggestions(annotation.shareToken);
          const suggestions = (result.suggestions || []).filter((s) => s.annotationId === annotation.id);
          if (suggestions.length === 0) {
            detailDiv.innerHTML = '<div style="color: #aaa; font-size: 12px; padding: 8px;">No suggestions found.</div>';
            return;
          }
          detailDiv.innerHTML = suggestions.map((s) => {
            let changesHTML = "";
            try {
              const changes = JSON.parse(s.suggestedText);
              if (changes.text) {
                changesHTML += `<div class="yt-annotator-suggestion-diff"><span class="yt-annotator-suggestion-diff-label">Note:</span> <span class="yt-annotator-suggestion-diff-old">${escapeHtml(annotation.text || "")}</span> <span class="yt-annotator-suggestion-diff-arrow">&rarr;</span> <span class="yt-annotator-suggestion-diff-new">${escapeHtml(changes.text)}</span></div>`;
              }
              if (changes.citation) {
                for (const [key, val] of Object.entries(changes.citation)) {
                  const origVal = (annotation.citation || {})[key] || "";
                  changesHTML += `<div class="yt-annotator-suggestion-diff"><span class="yt-annotator-suggestion-diff-label">${escapeHtml(key)}:</span> <span class="yt-annotator-suggestion-diff-old">${escapeHtml(origVal)}</span> <span class="yt-annotator-suggestion-diff-arrow">&rarr;</span> <span class="yt-annotator-suggestion-diff-new">${escapeHtml(val)}</span></div>`;
                }
              }
            } catch (e2) {
              changesHTML = `<div style="color: #aaa;">${escapeHtml(s.suggestedText)}</div>`;
            }
            const reasonHTML = s.reason ? `<div class="yt-annotator-suggestion-reason">Reason: ${escapeHtml(s.reason)}</div>` : "";
            return `<div class="yt-annotator-suggestion-item" data-suggestion-id="${s.id}">
            <div class="yt-annotator-suggestion-item-header">${escapeHtml(s.reporterDisplayName || "Anonymous")}</div>
            ${changesHTML}${reasonHTML}
            <div class="yt-annotator-suggestion-actions">
              <button class="yt-annotator-btn yt-annotator-suggestion-accept" data-suggestion-id="${s.id}">Accept</button>
              <button class="yt-annotator-btn yt-annotator-suggestion-dismiss" data-suggestion-id="${s.id}">Dismiss</button>
            </div>
          </div>`;
          }).join("");
          detailDiv.querySelectorAll(".yt-annotator-suggestion-accept").forEach((btn) => {
            btn.addEventListener("click", async (ev) => {
              ev.stopPropagation();
              const sid = btn.dataset.suggestionId;
              btn.disabled = true;
              btn.textContent = "Accepting...";
              try {
                await api.acceptSuggestion(sid);
                const card = detailDiv.querySelector(`.yt-annotator-suggestion-item[data-suggestion-id="${sid}"]`);
                if (card) {
                  card.innerHTML = '<div style="color: #4caf50; font-size: 12px; padding: 4px;">Accepted and applied.</div>';
                }
                if (currentVideoId) fetchAllAnnotations(currentVideoId);
              } catch (error) {
                console.error("Failed to accept suggestion:", error);
                btn.disabled = false;
                btn.textContent = "Accept";
              }
            });
          });
          detailDiv.querySelectorAll(".yt-annotator-suggestion-dismiss").forEach((btn) => {
            btn.addEventListener("click", async (ev) => {
              ev.stopPropagation();
              const sid = btn.dataset.suggestionId;
              btn.disabled = true;
              btn.textContent = "Dismissing...";
              try {
                await api.dismissSuggestion(sid);
                const card = detailDiv.querySelector(`.yt-annotator-suggestion-item[data-suggestion-id="${sid}"]`);
                if (card) card.remove();
                const remaining = detailDiv.querySelectorAll(".yt-annotator-suggestion-item").length;
                if (remaining === 0) {
                  detailDiv.style.display = "none";
                  const badge2 = popup.querySelector(".yt-annotator-suggestion-badge");
                  if (badge2) badge2.remove();
                }
                if (suggestionBadge && remaining > 0) {
                  suggestionBadge.innerHTML = `&#128161; ${remaining} suggestion${remaining !== 1 ? "s" : ""}`;
                }
                annotation.suggestionCount = remaining;
              } catch (error) {
                console.error("Failed to dismiss suggestion:", error);
                btn.disabled = false;
                btn.textContent = "Dismiss";
              }
            });
          });
        } catch (error) {
          console.error("Failed to load suggestions:", error);
          detailDiv.innerHTML = '<div style="color: #f44; font-size: 12px; padding: 8px;">Failed to load suggestions.</div>';
        }
      });
    }
    const actionsBtn = popup.querySelector(".yt-annotator-actions-btn");
    actionsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const existing = popup.querySelector(".yt-annotator-actions-menu");
      if (existing) {
        existing.remove();
        return;
      }
      const menu = document.createElement("div");
      menu.className = "yt-annotator-actions-menu";
      if (isBookmark || !isShared) {
        menu.innerHTML = `
        <button class="yt-annotator-actions-menu-item" data-menu-action="edit">
          <span class="yt-annotator-actions-menu-icon">&#9998;</span> Edit
        </button>
        <button class="yt-annotator-actions-menu-item danger" data-menu-action="delete">
          <span class="yt-annotator-actions-menu-icon">&#128465;</span> Delete
        </button>
      `;
      } else {
        const suggestLabel = annotation.userHasSuggestion ? "View My Suggestion" : "Suggest a Change";
        menu.innerHTML = `
        <button class="yt-annotator-actions-menu-item" data-menu-action="report">
          <span class="yt-annotator-actions-menu-icon">&#9873;</span> Report
        </button>
        <button class="yt-annotator-actions-menu-item" data-menu-action="suggest">
          <span class="yt-annotator-actions-menu-icon">&#9998;</span> ${suggestLabel}
        </button>
      `;
      }
      const header = popup.querySelector(".yt-annotator-popup-header");
      header.appendChild(menu);
      menu.querySelectorAll(".yt-annotator-actions-menu-item").forEach((item) => {
        item.addEventListener("click", (ev) => {
          ev.stopPropagation();
          const action = item.dataset.menuAction;
          menu.remove();
          if (action === "edit") {
            enterEditMode(popup, annotation, video);
          } else if (action === "delete") {
            handleDeleteAnnotation(annotation);
          } else if (action === "report") {
            showReportModal(annotation);
          } else if (action === "suggest") {
            handleSuggestAction(annotation);
          }
        });
      });
      const closeMenu = (ev) => {
        if (!menu.contains(ev.target) && ev.target !== actionsBtn) {
          menu.remove();
          document.removeEventListener("click", closeMenu, true);
        }
      };
      setTimeout(() => document.addEventListener("click", closeMenu, true), 0);
    });
    const badgeElement = popup.querySelector(".yt-annotator-popup-header span");
    if (badgeElement && annotation.creatorUserId) {
      badgeElement.style.cursor = "pointer";
      badgeElement.addEventListener("click", (e) => {
        e.stopPropagation();
        const userProfileUI = new UserProfileUI();
        userProfileUI.show(annotation.creatorUserId, annotation.creatorDisplayName || "User", annotation.isOwn);
      });
    }
    popup.querySelector('[data-action="goto"]').addEventListener("click", () => {
      video.currentTime = annotation.timestamp;
      closePopup();
    });
    popupContainer.appendChild(popup);
    setActivePopup(popup);
    applyTheme();
    positionPopupNearMarker(popup, markerEl);
  }
  async function handleDeleteAnnotation(annotation) {
    const videoId = getVideoId();
    const shareToken = annotation.shareToken;
    if (!shareToken) return;
    try {
      if (annotation.isBookmark) {
        const updatedBookmarks = bookmarkAnnotations.filter((a) => a.id !== annotation.id);
        if (updatedBookmarks.length === 0) {
          await api.deleteShare(shareToken);
          setBookmarkShareId(null);
        } else {
          await api.updateShare(shareToken, { annotations: updatedBookmarks });
        }
        setBookmarkAnnotations(updatedBookmarks);
        await fetchAllAnnotations(videoId);
      } else {
        const shareData = await api.getShare(shareToken);
        const updatedAnnotations = shareData.annotations.filter((a) => a.id !== annotation.id);
        if (updatedAnnotations.length === 0) {
          await api.deleteShare(shareToken);
        } else {
          await api.updateShare(shareToken, { annotations: updatedAnnotations });
        }
        annotations[videoId] = updatedAnnotations;
        const storageKey = getAnnotationsStorageKey(videoId);
        await chrome.storage.local.set({ [storageKey]: updatedAnnotations });
        await fetchAllAnnotations(videoId);
      }
    } catch (error) {
      console.error("Failed to delete annotation:", error);
    }
    closePopup();
  }
  function enterEditMode(popup, annotation, video) {
    const citation = annotation.citation || {};
    const citationType = citation.type || "note";
    const isStructured = citationType !== "note";
    if (isStructured) {
      enterStructuredEditMode(popup, annotation, video);
    } else {
      enterSimpleEditMode(popup, annotation, video);
    }
  }
  function enterSimpleEditMode(popup, annotation, video) {
    const contentDiv = popup.querySelector(".yt-annotator-popup-content");
    const actionsDiv = popup.querySelector(".yt-annotator-popup-actions");
    const actionsBtn = popup.querySelector(".yt-annotator-actions-btn");
    if (actionsBtn) actionsBtn.style.display = "none";
    const originalText = annotation.text || "";
    contentDiv.innerHTML = `<textarea class="yt-annotator-edit-textarea">${escapeHtml(originalText)}</textarea>`;
    const textarea = contentDiv.querySelector("textarea");
    textarea.addEventListener("keydown", (e) => e.stopPropagation());
    textarea.addEventListener("keyup", (e) => e.stopPropagation());
    textarea.addEventListener("keypress", (e) => e.stopPropagation());
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    actionsDiv.innerHTML = `
    <button class="yt-annotator-btn yt-annotator-btn-secondary" data-action="cancel-edit">Cancel</button>
    <button class="yt-annotator-btn yt-annotator-btn-primary" data-action="save-edit">Save</button>
  `;
    actionsDiv.querySelector('[data-action="cancel-edit"]').addEventListener("click", () => {
      showAnnotationPopup(annotation, video, false);
    });
    actionsDiv.querySelector('[data-action="save-edit"]').addEventListener("click", async () => {
      const newText = textarea.value.trim();
      if (!newText) return;
      if (newText === originalText) {
        showAnnotationPopup(annotation, video, false);
        return;
      }
      try {
        await api.editAnnotation(annotation.shareToken, annotation.id, { text: newText });
        const videoId = getVideoId();
        await fetchAllAnnotations(videoId);
        const updated = sharedAnnotations.find((a) => a.id === annotation.id);
        if (updated) {
          showAnnotationPopup(updated, video, false);
        } else {
          closePopup();
        }
      } catch (error) {
        console.error("Failed to edit annotation:", error);
        textarea.style.borderColor = "#f44336";
      }
    });
  }
  function enterStructuredEditMode(popup, annotation, video) {
    const contentDiv = popup.querySelector(".yt-annotator-popup-content");
    const actionsDiv = popup.querySelector(".yt-annotator-popup-actions");
    const actionsBtn = popup.querySelector(".yt-annotator-actions-btn");
    if (actionsBtn) actionsBtn.style.display = "none";
    const citation = annotation.citation || {};
    const citationType = citation.type || "note";
    const originalText = annotation.text || "";
    const fields = getFieldsForCitation(citationType);
    contentDiv.innerHTML = buildFieldEditorHTML(fields, citation, originalText);
    wireFieldEditorToggle(contentDiv);
    actionsDiv.innerHTML = `
    <button class="yt-annotator-btn yt-annotator-btn-secondary" data-action="cancel-edit">Cancel</button>
    <button class="yt-annotator-btn yt-annotator-btn-primary" data-action="save-edit">Save</button>
  `;
    actionsDiv.querySelector('[data-action="cancel-edit"]').addEventListener("click", () => {
      showAnnotationPopup(annotation, video, false);
    });
    actionsDiv.querySelector('[data-action="save-edit"]').addEventListener("click", async () => {
      const changes = collectFieldChanges(contentDiv, fields, citation, originalText);
      if (Object.keys(changes).length === 0) {
        showAnnotationPopup(annotation, video, false);
        return;
      }
      try {
        await api.editAnnotation(annotation.shareToken, annotation.id, changes);
        const videoId = getVideoId();
        await fetchAllAnnotations(videoId);
        const updated = sharedAnnotations.find((a) => a.id === annotation.id);
        if (updated) {
          showAnnotationPopup(updated, video, false);
        } else {
          closePopup();
        }
      } catch (error) {
        console.error("Failed to edit annotation:", error);
      }
    });
  }

  // src/content/annotationsSidebar.js
  function createSidebarButton() {
    if (sidebarButton) return;
    const playerContainer = document.querySelector("#movie_player");
    if (!playerContainer) return;
    const btn = document.createElement("button");
    btn.className = "yt-annotator-sidebar-btn";
    btn.innerHTML = "\u2261";
    btn.title = "View all annotations";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleSidebar();
    });
    playerContainer.appendChild(btn);
    setSidebarButton(btn);
  }
  function toggleSidebar() {
    if (accountSidebarOpen) {
      setAccountSidebarOpen(false);
      if (accountSidebar) accountSidebar.classList.remove("yt-annotator-sidebar-open");
    }
    setSidebarOpen(!sidebarOpen);
    if (sidebarOpen) {
      if (!sidebar) {
        createSidebar();
      }
      sidebar.classList.add("yt-annotator-sidebar-open");
      if (isCreatorMode()) sidebar.classList.add("creator-mode");
      updateSidebarContent();
      if (addButton) addButton.classList.add("sidebar-open");
      if (sidebarButton) sidebarButton.classList.add("sidebar-open");
      if (loginButton) loginButton.classList.add("sidebar-open");
    } else {
      if (sidebar) {
        sidebar.classList.remove("yt-annotator-sidebar-open");
      }
      if (addButton) addButton.classList.remove("sidebar-open");
      if (sidebarButton) sidebarButton.classList.remove("sidebar-open");
      if (loginButton) loginButton.classList.remove("sidebar-open");
    }
  }
  function createSidebar() {
    if (sidebar) return;
    const playerContainer = document.querySelector("#movie_player");
    if (!playerContainer) return;
    const sb = document.createElement("div");
    sb.className = "yt-annotator-sidebar";
    sb.innerHTML = `
    <div class="yt-annotator-sidebar-header">
      <h3>Citations</h3>
      <button class="yt-annotator-sidebar-close" title="Close">&times;</button>
    </div>
    <div class="yt-annotator-sidebar-filters">
      <button class="yt-annotator-filter-btn active" data-filter="all">All</button>
      <button class="yt-annotator-filter-btn" data-filter="mine">Mine</button>
      <button class="yt-annotator-filter-btn" data-filter="creator">Creator</button>
      <button class="yt-annotator-filter-btn" data-filter="others">Others</button>
    </div>
    <div class="yt-annotator-sidebar-count"></div>
    <div class="yt-annotator-sidebar-content"></div>
  `;
    sb.querySelector(".yt-annotator-sidebar-close").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleSidebar();
    });
    sb.querySelectorAll(".yt-annotator-filter-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const filter = btn.dataset.filter;
        setSidebarFilter(filter);
        sb.querySelectorAll(".yt-annotator-filter-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        updateSidebarContent();
      });
    });
    playerContainer.appendChild(sb);
    setSidebar(sb);
  }
  function updateSidebarContent() {
    if (!sidebar) return;
    const contentDiv = sidebar.querySelector(".yt-annotator-sidebar-content");
    const countDiv = sidebar.querySelector(".yt-annotator-sidebar-count");
    let filtered = sharedAnnotations;
    if (sidebarFilter === "mine") {
      filtered = sharedAnnotations.filter((a) => a.isOwn);
    } else if (sidebarFilter === "creator") {
      filtered = sharedAnnotations.filter((a) => a.isCreatorCitation);
    } else if (sidebarFilter === "others") {
      filtered = sharedAnnotations.filter((a) => !a.isOwn && !a.isCreatorCitation);
    }
    filtered = [...filtered].sort((a, b) => a.timestamp - b.timestamp);
    countDiv.textContent = `${filtered.length} annotation${filtered.length !== 1 ? "s" : ""}`;
    if (filtered.length === 0) {
      contentDiv.innerHTML = '<div class="yt-annotator-sidebar-empty">No annotations yet</div>';
      return;
    }
    const listHTML = filtered.map((annotation) => {
      if (annotation.adminDeleted) {
        return `
        <div class="yt-annotator-sidebar-item other" data-timestamp="${annotation.timestamp}" style="opacity: 0.5;">
          <div class="yt-annotator-sidebar-item-header">
            <span class="yt-annotator-sidebar-time">${formatTime(annotation.timestamp)}</span>
          </div>
          <div class="yt-annotator-sidebar-text" style="color: #999; font-style: italic;">This citation was removed by a moderator</div>
        </div>
      `;
      }
      const citationPreview = annotation.citation ? `<div class="yt-annotator-sidebar-citation">
        ${annotation.citation.type === "youtube" ? "\u{1F3A5}" : annotation.citation.type === "movie" ? "\u{1F3AC}" : "\u{1F4C4}"}
        ${escapeHtml(annotation.citation.title || "")}
      </div>` : "";
      const textPreview = annotation.text ? `<div class="yt-annotator-sidebar-text">${escapeHtml(annotation.text.substring(0, 100))}${annotation.text.length > 100 ? "..." : ""}</div>` : "";
      const ownerClass = annotation.isCreatorCitation ? "creator-citation" : annotation.isOwn ? "own" : "other";
      const creatorName = annotation.creatorDisplayName || "Anonymous";
      let ownerBadge;
      if (annotation.isCreatorCitation) {
        const ownSuffix = annotation.isOwn ? " (YOU)" : "";
        ownerBadge = `<span class="yt-annotator-sidebar-badge creator">Creator${ownSuffix} - ${escapeHtml(creatorName)}</span>`;
      } else if (annotation.isOwn) {
        ownerBadge = `<span class="yt-annotator-sidebar-badge own">YOU - ${escapeHtml(creatorName)}</span>`;
      } else {
        ownerBadge = `<span class="yt-annotator-sidebar-badge other">${escapeHtml(creatorName)}</span>`;
      }
      const sidebarSuggestionIndicator = annotation.isOwn && annotation.suggestionCount > 0 ? `<span class="yt-annotator-suggestion-badge-small" title="${annotation.suggestionCount} suggestion${annotation.suggestionCount !== 1 ? "s" : ""}">&#128161; ${annotation.suggestionCount}</span>` : "";
      return `
      <div class="yt-annotator-sidebar-item ${ownerClass}" data-timestamp="${annotation.timestamp}">
        <div class="yt-annotator-sidebar-item-header">
          <span class="yt-annotator-sidebar-time">${formatTime(annotation.timestamp)}</span>
          ${ownerBadge}
          ${sidebarSuggestionIndicator}
          <button class="yt-annotator-actions-btn" title="Actions">&#8942;</button>
        </div>
        ${citationPreview}
        ${textPreview}
      </div>
    `;
    }).join("");
    contentDiv.innerHTML = listHTML;
    contentDiv.querySelectorAll(".yt-annotator-sidebar-item").forEach((item, index) => {
      const annotation = filtered[index];
      if (annotation.adminDeleted) return;
      item.addEventListener("click", (e) => {
        if (e.target.classList.contains("yt-annotator-sidebar-badge") || e.target.classList.contains("yt-annotator-actions-btn")) {
          return;
        }
        e.stopPropagation();
        if (typeof analytics !== "undefined") analytics.track("citation_clicked", { videoId: currentVideoId, source: "sidebar" });
        const video = document.querySelector("video");
        if (video && annotation) {
          showAnnotationPopup(annotation, video, !annotation.isOwn);
        }
      });
      const badge = item.querySelector(".yt-annotator-sidebar-badge");
      if (badge && annotation.creatorUserId) {
        badge.addEventListener("click", (e) => {
          e.stopPropagation();
          const userProfileUI = new UserProfileUI();
          userProfileUI.show(annotation.creatorUserId, annotation.creatorDisplayName || "User", annotation.isOwn);
        });
      }
      const sidebarActionsBtn = item.querySelector(".yt-annotator-actions-btn");
      if (sidebarActionsBtn) {
        sidebarActionsBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          sidebar.querySelectorAll(".yt-annotator-actions-menu").forEach((m) => m.remove());
          const menu = document.createElement("div");
          menu.className = "yt-annotator-actions-menu";
          if (annotation.isOwn) {
            menu.innerHTML = `
            <button class="yt-annotator-actions-menu-item" data-menu-action="edit">
              <span class="yt-annotator-actions-menu-icon">&#9998;</span> Edit
            </button>
            <button class="yt-annotator-actions-menu-item danger" data-menu-action="delete">
              <span class="yt-annotator-actions-menu-icon">&#128465;</span> Delete
            </button>
          `;
          } else {
            const suggestLabel = annotation.userHasSuggestion ? "View My Suggestion" : "Suggest a Change";
            menu.innerHTML = `
            <button class="yt-annotator-actions-menu-item" data-menu-action="report">
              <span class="yt-annotator-actions-menu-icon">&#9873;</span> Report
            </button>
            <button class="yt-annotator-actions-menu-item" data-menu-action="suggest">
              <span class="yt-annotator-actions-menu-icon">&#9998;</span> ${suggestLabel}
            </button>
          `;
          }
          const header = item.querySelector(".yt-annotator-sidebar-item-header");
          header.appendChild(menu);
          menu.querySelectorAll(".yt-annotator-actions-menu-item").forEach((menuItem) => {
            menuItem.addEventListener("click", (ev) => {
              ev.stopPropagation();
              const action = menuItem.dataset.menuAction;
              menu.remove();
              if (action === "edit") {
                const video = document.querySelector("video");
                if (video) {
                  showAnnotationPopup(annotation, video, false);
                  setTimeout(() => {
                    if (activePopup) enterEditMode(activePopup, annotation, video);
                  }, 50);
                }
              } else if (action === "delete") {
                handleDeleteAnnotation(annotation);
              } else if (action === "report") {
                showReportModal(annotation);
              } else if (action === "suggest") {
                handleSuggestAction(annotation);
              }
            });
          });
          const closeMenu = (ev) => {
            if (!menu.contains(ev.target) && ev.target !== sidebarActionsBtn) {
              menu.remove();
              document.removeEventListener("click", closeMenu, true);
            }
          };
          setTimeout(() => document.addEventListener("click", closeMenu, true), 0);
        });
      }
    });
  }

  // src/content/markers.js
  var LANES = [
    { id: "article", label: "Article", icon: "\u{1F4C4}" },
    { id: "youtube", label: "YouTube", icon: "\u25B6" },
    { id: "movie", label: "Movie", icon: "\u{1F39E}" },
    { id: "book", label: "Book", icon: "\u{1F4D6}" },
    { id: "podcast", label: "Podcast", icon: "\u{1F399}" },
    { id: "note", label: "Note", icon: "\u{1F4DD}" }
  ];
  var BOOKMARK_LANE = { id: "bookmark", label: "Bookmarks", icon: "\u{1F512}" };
  function getLaneId(annotation) {
    if (annotation.isBookmark) return "bookmark";
    return annotation.citation?.type || "note";
  }
  function getMarkerClass(annotation) {
    if (annotation.isBookmark) return "bookmark";
    if (annotation.isCreatorCitation) return "creator";
    if (annotation.isOwn) return "mine";
    return "other";
  }
  function getTooltipSource(annotation) {
    const c = annotation.citation;
    if (c?.title) return c.title;
    if (c?.url) return c.url;
    if (annotation.text) return annotation.text;
    return "Note";
  }
  function refreshMarkerColors() {
    const currentUserId = authManager.getCurrentUser()?.id || null;
    setSharedAnnotations(sharedAnnotations.map((ann) => ({
      ...ann,
      isOwn: currentUserId ? ann.creatorUserId === currentUserId : false
    })));
    renderMarkers();
  }
  function renderMarkers() {
    if (!citationTimeline) return;
    const video = document.querySelector("video");
    if (!video) return;
    if (!video.duration || video.duration === 0) {
      const retryRender = () => {
        if (video.duration && video.duration > 0) {
          renderMarkers();
        }
      };
      video.addEventListener("durationchange", retryRender, { once: true });
      video.addEventListener("loadedmetadata", retryRender, { once: true });
      video.addEventListener("canplay", retryRender, { once: true });
      return;
    }
    const player = document.querySelector(".html5-video-player");
    if (player && player.classList.contains("ad-showing")) {
      startAdObserver();
      return;
    }
    const annotations2 = sharedAnnotations.filter((a) => !a.adminDeleted);
    const laneAnnotations = {};
    for (const ann of annotations2) {
      const laneId = getLaneId(ann);
      if (!laneAnnotations[laneId]) laneAnnotations[laneId] = [];
      laneAnnotations[laneId].push(ann);
    }
    const populatedLanes = LANES.filter((l) => laneAnnotations[l.id]?.length > 0);
    const knownIds = new Set(LANES.map((l) => l.id));
    knownIds.add("bookmark");
    for (const laneId of Object.keys(laneAnnotations)) {
      if (!knownIds.has(laneId)) {
        populatedLanes.push({ id: laneId, label: laneId.charAt(0).toUpperCase() + laneId.slice(1), icon: "\u{1F4C4}" });
      }
    }
    const hasBookmarks = laneAnnotations["bookmark"]?.length > 0;
    const tracksContainer = citationTimeline.querySelector(".citelines-tracks");
    const countEl = citationTimeline.querySelector(".citelines-count");
    console.log("[Citelines] renderMarkers: tracksContainer found?", !!tracksContainer, "annotations:", annotations2.length, "lanes:", populatedLanes.map((l) => l.id));
    if (!tracksContainer) return;
    tracksContainer.innerHTML = "";
    citationTimeline.style.display = "";
    if (annotations2.length === 0) {
      if (countEl) countEl.textContent = "0 citations";
      return;
    }
    const playhead = document.createElement("div");
    playhead.className = "citelines-playhead";
    const currentPct = video.duration > 0 ? video.currentTime / video.duration * 100 : 0;
    playhead.style.left = `${currentPct}%`;
    tracksContainer.appendChild(playhead);
    for (const lane of populatedLanes) {
      const trackEl = document.createElement("div");
      trackEl.className = "citelines-track";
      const laneEl = document.createElement("div");
      laneEl.className = "citelines-track-lane";
      const laneBg = document.createElement("div");
      laneBg.className = "citelines-track-lane-bg";
      laneEl.appendChild(laneBg);
      const laneAnns = laneAnnotations[lane.id] || [];
      for (const ann of laneAnns) {
        const pct = ann.timestamp / video.duration * 100;
        const marker = document.createElement("div");
        marker.className = "citelines-marker " + getMarkerClass(ann);
        marker.style.left = pct + "%";
        marker.dataset.annotationId = ann.id;
        const colorClass = getMarkerClass(ann);
        const tooltip = document.createElement("div");
        tooltip.className = "citelines-marker-tooltip";
        tooltip.innerHTML = `<div class="citelines-marker-tooltip-row"><span class="citelines-marker-tooltip-time ${colorClass}">${formatTime(ann.timestamp)}</span><span class="citelines-marker-tooltip-source">${escapeHtml(getTooltipSource(ann))}</span></div><div class="citelines-marker-tooltip-arrow"></div><div class="citelines-marker-tooltip-arrow-inner"></div>`;
        marker.appendChild(tooltip);
        marker.addEventListener("click", (e) => {
          e.stopPropagation();
          if (typeof analytics !== "undefined") analytics.track("citation_clicked", { videoId: currentVideoId, source: "marker" });
          showAnnotationPopup(ann, video, !ann.isOwn, marker);
        });
        laneEl.appendChild(marker);
      }
      const labelEl = document.createElement("div");
      labelEl.className = "citelines-track-label";
      labelEl.innerHTML = `<span class="citelines-track-icon">${lane.icon}</span>${lane.label}`;
      trackEl.appendChild(laneEl);
      trackEl.appendChild(labelEl);
      tracksContainer.appendChild(trackEl);
    }
    if (hasBookmarks) {
      const svgDefs = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svgDefs.setAttribute("width", "0");
      svgDefs.setAttribute("height", "0");
      svgDefs.style.position = "absolute";
      svgDefs.innerHTML = `
      <defs>
        <pattern id="citelines-bookmark-hash" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(0,180,180,0.6)" stroke-width="1.5"/>
        </pattern>
      </defs>
    `;
      tracksContainer.appendChild(svgDefs);
      const bookmarkTrack = document.createElement("div");
      bookmarkTrack.className = "citelines-track citelines-track-bookmark";
      const bookmarkLane = document.createElement("div");
      bookmarkLane.className = "citelines-track-lane";
      const bookmarkLaneBg = document.createElement("div");
      bookmarkLaneBg.className = "citelines-track-lane-bg";
      bookmarkLane.appendChild(bookmarkLaneBg);
      const bookmarkAnns = laneAnnotations["bookmark"] || [];
      for (const ann of bookmarkAnns) {
        const pct = ann.timestamp / video.duration * 100;
        const marker = document.createElement("div");
        marker.className = "citelines-marker bookmark";
        marker.style.left = pct + "%";
        marker.dataset.annotationId = ann.id;
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", "12");
        svg.setAttribute("height", "16");
        svg.setAttribute("viewBox", "0 0 12 16");
        svg.innerHTML = `<path d="M1 1h10v13l-5-3.5L1 14V1z" fill="url(#citelines-bookmark-hash)" stroke="rgba(0,180,180,0.8)" stroke-width="1"/>`;
        marker.appendChild(svg);
        const colorClass = "bookmark";
        const tooltip = document.createElement("div");
        tooltip.className = "citelines-marker-tooltip";
        tooltip.innerHTML = `<div class="citelines-marker-tooltip-row"><span class="citelines-marker-tooltip-time ${colorClass}">${formatTime(ann.timestamp)}</span><span class="citelines-marker-tooltip-source">${escapeHtml(getTooltipSource(ann))}</span></div><div class="citelines-marker-tooltip-arrow"></div><div class="citelines-marker-tooltip-arrow-inner"></div>`;
        marker.appendChild(tooltip);
        marker.addEventListener("click", (e) => {
          e.stopPropagation();
          showAnnotationPopup(ann, video, false, marker);
        });
        bookmarkLane.appendChild(marker);
      }
      const bookmarkLabel = document.createElement("div");
      bookmarkLabel.className = "citelines-track-label citelines-track-label-bookmark";
      bookmarkLabel.innerHTML = `<span class="citelines-track-icon">${BOOKMARK_LANE.icon}</span>${BOOKMARK_LANE.label}`;
      bookmarkTrack.appendChild(bookmarkLane);
      bookmarkTrack.appendChild(bookmarkLabel);
      tracksContainer.appendChild(bookmarkTrack);
    }
    const citationCount = annotations2.filter((a) => !a.isBookmark).length;
    if (countEl) {
      const typeCount = populatedLanes.length;
      let countText = `${citationCount} citation${citationCount !== 1 ? "s" : ""}`;
      if (typeCount > 0) countText += ` \xB7 ${typeCount} type${typeCount !== 1 ? "s" : ""}`;
      if (hasBookmarks) countText += ` \xB7 ${laneAnnotations["bookmark"].length} bookmark${laneAnnotations["bookmark"].length !== 1 ? "s" : ""}`;
      countEl.textContent = countText;
    }
    const bookmarkLegendItem = citationTimeline.querySelector(".citelines-legend-bookmark");
    if (bookmarkLegendItem) {
      bookmarkLegendItem.style.display = hasBookmarks ? "" : "none";
    }
    const ownCount = annotations2.filter((a) => a.isOwn).length;
    const sharedCount = annotations2.filter((a) => !a.isOwn && !a.isCreatorCitation).length;
    const creatorCount = annotations2.filter((a) => a.isCreatorCitation).length;
    console.log(`Rendered ${ownCount} own + ${sharedCount} shared + ${creatorCount} creator annotations`);
    if (sidebarOpen && sidebar) {
      updateSidebarContent();
    }
  }
  function updatePlayhead() {
    if (!citationTimeline) return;
    const video = document.querySelector("video");
    if (!video || !video.duration) return;
    const playhead = citationTimeline.querySelector(".citelines-playhead");
    if (!playhead) return;
    const pct = video.currentTime / video.duration;
    playhead.style.left = `${pct * 100}%`;
  }
  function startAdObserver() {
    if (adObserver) return;
    const player = document.querySelector(".html5-video-player");
    if (!player) return;
    const observer = new MutationObserver(() => {
      if (!player.classList.contains("ad-showing")) {
        observer.disconnect();
        setAdObserver(null);
        setTimeout(() => renderMarkers(), 300);
      }
    });
    observer.observe(player, { attributes: true, attributeFilter: ["class"] });
    setAdObserver(observer);
  }
  function createMarkersContainer() {
    if (citationTimeline) return;
    const playerContainer = document.querySelector("#movie_player");
    if (!playerContainer) return;
    const progressBar = document.querySelector(".ytp-progress-bar-container");
    if (progressBar) {
      const mc = document.createElement("div");
      mc.className = "yt-annotator-markers-container";
      progressBar.appendChild(mc);
      setMarkersContainer(mc);
      const cmc = document.createElement("div");
      cmc.className = "yt-annotator-markers-container yt-annotator-creator-markers-container";
      progressBar.appendChild(cmc);
      setCreatorMarkersContainer(cmc);
    }
    const timeline = document.createElement("div");
    timeline.className = "citelines-timeline";
    timeline.style.display = "none";
    timeline.innerHTML = `
    <div class="citelines-timeline-header">
      <span class="citelines-title">
        <span class="citelines-logo">Cite<span class="citelines-logo-pipe">|</span>ines</span>
        Citations
      </span>
      <span class="citelines-right">
        <span class="citelines-count"></span>
        <span class="citelines-chevron">&#9660;</span>
      </span>
    </div>
    <div class="citelines-timeline-body">
      <div class="citelines-tracks"></div>
      <div class="citelines-legend">
        <div class="citelines-legend-item"><div class="citelines-legend-swatch creator"></div> Creator</div>
        <div class="citelines-legend-item"><div class="citelines-legend-swatch mine"></div> Yours</div>
        <div class="citelines-legend-item"><div class="citelines-legend-swatch other"></div> Others</div>
        <div class="citelines-legend-item citelines-legend-bookmark" style="display: none;"><div class="citelines-legend-swatch bookmark"></div> Bookmarks</div>
      </div>
    </div>
  `;
    function insertTimeline() {
      const below = document.querySelector("#below");
      if (below && below.parentNode) {
        below.parentNode.insertBefore(timeline, below);
        setCitationTimeline(timeline);
        return true;
      }
      return false;
    }
    if (!insertTimeline()) {
      const observer = new MutationObserver(() => {
        if (insertTimeline()) {
          observer.disconnect();
          renderMarkers();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setCitationTimeline(timeline);
    }
    const header = timeline.querySelector(".citelines-timeline-header");
    const body = timeline.querySelector(".citelines-timeline-body");
    const chevron = timeline.querySelector(".citelines-chevron");
    header.addEventListener("click", () => {
      const collapsed = !timelineCollapsed;
      setTimelineCollapsed(collapsed);
      body.classList.toggle("collapsed", collapsed);
      header.classList.toggle("collapsed", collapsed);
      chevron.classList.toggle("collapsed", collapsed);
    });
    const video = document.querySelector("video");
    if (video) {
      video.addEventListener("timeupdate", updatePlayhead);
    }
  }

  // src/content/fetchAnnotations.js
  async function fetchAllAnnotations(videoId) {
    try {
      const channelIdPromise = currentVideoChannelId ? Promise.resolve(currentVideoChannelId) : getVideoChannelId();
      const [result, videoChannelId] = await Promise.all([
        api.getSharesForVideo(videoId),
        channelIdPromise
      ]);
      setCurrentVideoChannelId(videoChannelId);
      const newSharedAnnotations = [];
      let foundUserShareId = null;
      let foundBookmarkShareId = null;
      for (const share of result.shares) {
        if (!share.annotations || !Array.isArray(share.annotations)) continue;
        const isOwn = share.isOwner || false;
        const isBookmarkShare = isOwn && share.isPublic === false;
        if (isBookmarkShare && !foundBookmarkShareId) {
          foundBookmarkShareId = share.shareToken;
          const nonDeletedBookmarks = share.annotations.filter((ann) => !ann.deleted_at);
          setBookmarkAnnotations(nonDeletedBookmarks);
        } else if (isOwn && !foundUserShareId) {
          foundUserShareId = share.shareToken;
          const nonDeletedAnnotations = share.annotations.filter((ann) => !ann.deleted_at);
          annotations[videoId] = nonDeletedAnnotations;
          const storageKey = getAnnotationsStorageKey(videoId);
          chrome.storage.local.set({ [storageKey]: nonDeletedAnnotations });
        }
        const isCreatorCitation = !!(videoChannelId && share.creatorYoutubeChannelId && share.creatorYoutubeChannelId === videoChannelId);
        const suggestionCounts = share.suggestionCounts || {};
        const mapped = share.annotations.filter((ann) => {
          if (!ann.deleted_at) return true;
          return isOwn && !!ann.deleted_by;
        }).map((ann) => {
          const sc = suggestionCounts[ann.id];
          const adminDeleted = !!(ann.deleted_at && ann.deleted_by);
          return {
            ...ann,
            shareToken: share.shareToken,
            isOwn,
            isBookmark: isBookmarkShare,
            creatorDisplayName: share.creatorDisplayName,
            creatorUserId: share.userId,
            isCreatorCitation,
            adminDeleted,
            suggestionCount: sc ? sc.count : 0,
            userHasSuggestion: sc ? sc.userHasSuggestion : false
          };
        });
        newSharedAnnotations.push(...mapped);
      }
      setUserShareId(foundUserShareId);
      setBookmarkShareId(foundBookmarkShareId);
      setSharedAnnotations(newSharedAnnotations);
      if (!foundUserShareId) {
        annotations[videoId] = [];
        const storageKey = getAnnotationsStorageKey(videoId);
        chrome.storage.local.set({ [storageKey]: [] });
      }
      if (!foundBookmarkShareId) {
        setBookmarkAnnotations([]);
      }
      renderMarkers();
      updateCreatorMode();
    } catch (error) {
      console.error("Failed to fetch annotations:", error);
    }
  }

  // src/content/storage.js
  function getAnnotationsStorageKey(videoId) {
    const isIncognito = chrome.extension.inIncognitoContext;
    return isIncognito ? `annotations_incognito_${videoId}` : `annotations_${videoId}`;
  }
  async function loadAnnotations(videoId) {
    return new Promise((resolve) => {
      const storageKey = getAnnotationsStorageKey(videoId);
      chrome.storage.local.get([storageKey], (result) => {
        resolve(result[storageKey] || []);
      });
    });
  }
  async function saveAnnotations(videoId, annotationsList) {
    await new Promise((resolve) => {
      const storageKey = getAnnotationsStorageKey(videoId);
      chrome.storage.local.set({ [storageKey]: annotationsList }, resolve);
    });
    try {
      if (annotationsList.length > 0) {
        await syncAnnotationsToBackend(videoId, annotationsList);
      }
      await fetchAllAnnotations(videoId);
    } catch (error) {
      console.error("Failed to sync annotations to backend:", error);
      if (error.suspended || error.banned) {
        const message = error.banned ? "Your account has been suspended. Your citations will not be saved." : `Your account is suspended until ${new Date(error.suspendedUntil).toLocaleDateString()}. Your citations will not be saved.`;
        alert(message);
      }
    }
  }
  async function syncAnnotationsToBackend(videoId, annotationsList) {
    const videoTitle = document.querySelector("h1.ytd-watch-metadata yt-formatted-string")?.textContent || "YouTube Video";
    if (userShareId) {
      await api.updateShare(userShareId, {
        annotations: annotationsList,
        title: videoTitle
      });
    } else {
      const result = await api.createShare(videoId, annotationsList, videoTitle);
      setUserShareId(result.shareToken);
      console.log("Created share:", result.shareToken);
    }
  }
  async function saveBookmark(videoId, text, timestamp) {
    const annotation = {
      id: Date.now().toString(),
      timestamp,
      text,
      citation: null,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const updatedBookmarks = [...bookmarkAnnotations, annotation];
    const videoTitle = document.querySelector("h1.ytd-watch-metadata yt-formatted-string")?.textContent || "YouTube Video";
    try {
      if (bookmarkShareId) {
        await api.updateShare(bookmarkShareId, {
          annotations: updatedBookmarks,
          title: videoTitle
        });
      } else {
        const result = await api.createShare(videoId, updatedBookmarks, videoTitle, false);
        setBookmarkShareId(result.shareToken);
      }
      setBookmarkAnnotations(updatedBookmarks);
      await fetchAllAnnotations(videoId);
    } catch (error) {
      console.error("Failed to save bookmark:", error);
      if (error.suspended || error.banned) {
        alert("Your account is suspended. Bookmarks will not be saved.");
      }
    }
  }

  // src/content/createPopup.js
  function showCreatePopup(timestamp, video) {
    closePopup();
    const playerContainer = document.querySelector("#movie_player");
    if (!playerContainer) return;
    const popup = document.createElement("div");
    popup.className = "yt-annotator-popup yt-annotator-popup-create" + (isCreatorMode() ? " creator-mode" : "");
    const isLoggedIn = authManager && authManager.isLoggedIn();
    popup.innerHTML = `
    <div class="yt-annotator-popup-header">
      <span class="yt-annotator-popup-timestamp">New annotation at ${formatTime(timestamp)}</span>
      <button class="yt-annotator-popup-close">&times;</button>
    </div>

    <div class="yt-annotator-create-toggle">
      <button class="yt-annotator-toggle-btn active" data-mode="citation">Citation <span class="yt-annotator-toggle-label">public</span></button>
      <button class="yt-annotator-toggle-btn${isLoggedIn ? "" : " disabled"}" data-mode="bookmark">Bookmark <span class="yt-annotator-toggle-label">private</span></button>
    </div>

    <div class="yt-annotator-login-hint" style="display: none;">
      Sign in to save private bookmarks.
    </div>

    <div class="yt-annotator-citation-type">
      <label for="citation-type">Citation Type:</label>
      <select id="citation-type" class="yt-annotator-select">
        <option value="note">Basic Note</option>
        <option value="youtube">YouTube Video</option>
        <option value="movie">Movie</option>
        <option value="article">Article</option>
      </select>
    </div>

    <div id="citation-fields" class="yt-annotator-citation-fields">
      <!-- Dynamic fields will be inserted here -->
    </div>

    <div class="yt-annotator-private-hint" style="display: none;">
      Only visible to you
    </div>

    <textarea class="yt-annotator-popup-input" placeholder="Your note or comment..."></textarea>

    <div class="yt-annotator-popup-actions">
      <button class="yt-annotator-btn yt-annotator-btn-secondary" data-action="cancel">Cancel</button>
      <button class="yt-annotator-btn yt-annotator-btn-primary" data-action="save">Save</button>
    </div>
  `;
    const textarea = popup.querySelector("textarea");
    const citationTypeSelect = popup.querySelector("#citation-type");
    const citationFields = popup.querySelector("#citation-fields");
    const citationTypeContainer = popup.querySelector(".yt-annotator-citation-type");
    const privateHint = popup.querySelector(".yt-annotator-private-hint");
    const loginHint = popup.querySelector(".yt-annotator-login-hint");
    const toggleBtns = popup.querySelectorAll(".yt-annotator-toggle-btn");
    let createMode = "citation";
    toggleBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const mode = btn.dataset.mode;
        if (mode === "bookmark" && !isLoggedIn) {
          loginHint.style.display = "block";
          return;
        }
        loginHint.style.display = "none";
        createMode = mode;
        toggleBtns.forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
        if (mode === "bookmark") {
          citationTypeContainer.style.display = "none";
          citationFields.style.display = "none";
          privateHint.style.display = "block";
          textarea.placeholder = "Your private note...";
        } else {
          citationTypeContainer.style.display = "";
          citationFields.style.display = "";
          privateHint.style.display = "none";
          textarea.placeholder = "Your note or comment...";
        }
      });
    });
    function updateCitationFields(type) {
      let fieldsHTML = "";
      switch (type) {
        case "youtube":
          fieldsHTML = `
          <input type="text" class="yt-annotator-input" id="citation-title" placeholder="Video Title" />
          <input type="url" class="yt-annotator-input" id="citation-url" placeholder="YouTube URL" />
          <div style="display: flex; gap: 8px;">
            <input type="text" class="yt-annotator-input" id="citation-month" placeholder="Month" style="flex: 1;" />
            <input type="text" class="yt-annotator-input" id="citation-day" placeholder="Day" style="flex: 1;" />
            <input type="text" class="yt-annotator-input" id="citation-year" placeholder="Year" style="flex: 1;" />
          </div>
        `;
          break;
        case "movie":
          fieldsHTML = `
          <input type="text" class="yt-annotator-input" id="citation-title" placeholder="Movie Title" />
          <div style="display: flex; gap: 8px;">
            <input type="text" class="yt-annotator-input" id="citation-year" placeholder="Year" style="flex: 1;" />
            <input type="text" class="yt-annotator-input" id="citation-director" placeholder="Director (optional)" style="flex: 2;" />
          </div>
        `;
          break;
        case "article":
          fieldsHTML = `
          <input type="text" class="yt-annotator-input" id="citation-title" placeholder="Article Title" />
          <input type="url" class="yt-annotator-input" id="citation-url" placeholder="Article URL" />
          <input type="text" class="yt-annotator-input" id="citation-author" placeholder="Author (optional)" />
          <div style="display: flex; gap: 8px;">
            <input type="text" class="yt-annotator-input" id="citation-month" placeholder="Month" style="flex: 1;" />
            <input type="text" class="yt-annotator-input" id="citation-day" placeholder="Day" style="flex: 1;" />
            <input type="text" class="yt-annotator-input" id="citation-year" placeholder="Year" style="flex: 1;" />
          </div>
        `;
          break;
        case "note":
        default:
          fieldsHTML = "";
          break;
      }
      citationFields.innerHTML = fieldsHTML;
      citationFields.querySelectorAll("input").forEach((input) => {
        input.addEventListener("keydown", (e) => e.stopPropagation());
        input.addEventListener("keyup", (e) => e.stopPropagation());
        input.addEventListener("keypress", (e) => e.stopPropagation());
      });
    }
    updateCitationFields("note");
    citationTypeSelect.addEventListener("change", (e) => {
      updateCitationFields(e.target.value);
    });
    textarea.addEventListener("keydown", (e) => e.stopPropagation());
    textarea.addEventListener("keyup", (e) => e.stopPropagation());
    textarea.addEventListener("keypress", (e) => e.stopPropagation());
    popup.querySelector(".yt-annotator-popup-close").addEventListener("click", closePopup);
    popup.querySelector('[data-action="cancel"]').addEventListener("click", closePopup);
    popup.querySelector('[data-action="save"]').addEventListener("click", async (e) => {
      e.stopPropagation();
      e.preventDefault();
      const saveBtn = popup.querySelector('[data-action="save"]');
      if (saveBtn.disabled) return;
      const text = textarea.value.trim();
      const videoId = getVideoId();
      if (createMode === "bookmark") {
        if (!text) {
          alert("Please enter a note");
          return;
        }
        saveBtn.disabled = true;
        saveBtn.textContent = "Saving...";
        try {
          await saveBookmark(videoId, text, timestamp);
          closePopup();
        } catch (error) {
          console.error("Failed to save bookmark:", error);
          saveBtn.disabled = false;
          saveBtn.textContent = "Save";
          alert("Failed to save bookmark. Please try again.");
        }
        return;
      }
      const citationType = citationTypeSelect.value;
      let citation = null;
      if (citationType !== "note") {
        citation = { type: citationType };
        const titleInput = popup.querySelector("#citation-title");
        const urlInput = popup.querySelector("#citation-url");
        const yearInput = popup.querySelector("#citation-year");
        const monthInput = popup.querySelector("#citation-month");
        const dayInput = popup.querySelector("#citation-day");
        const directorInput = popup.querySelector("#citation-director");
        const authorInput = popup.querySelector("#citation-author");
        if (titleInput) citation.title = titleInput.value.trim();
        if (urlInput) citation.url = urlInput.value.trim();
        if (yearInput) citation.year = yearInput.value.trim();
        if (monthInput) citation.month = monthInput.value.trim();
        if (dayInput) citation.day = dayInput.value.trim();
        if (directorInput) citation.director = directorInput.value.trim();
        if (authorInput) citation.author = authorInput.value.trim();
        if (!citation.title) {
          alert("Please enter a title for the citation");
          return;
        }
      }
      if (!text && !citation) {
        alert("Please enter a note or add a citation");
        return;
      }
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";
      const newAnnotation = {
        id: Date.now().toString(),
        timestamp,
        text,
        citation,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      if (!annotations[videoId]) {
        annotations[videoId] = [];
      }
      annotations[videoId].push(newAnnotation);
      try {
        await saveAnnotations(videoId, annotations[videoId]);
        renderMarkers();
        closePopup();
      } catch (error) {
        console.error("Failed to save annotation:", error);
        annotations[videoId] = annotations[videoId].filter((ann) => ann.id !== newAnnotation.id);
        const storageKey = getAnnotationsStorageKey(videoId);
        await new Promise((resolve) => {
          chrome.storage.local.set({ [storageKey]: annotations[videoId] }, resolve);
        });
        if (error.suspended || error.banned) {
          const message = error.banned ? "Your account has been suspended. You cannot create citations." : `Your account is suspended until ${new Date(error.suspendedUntil).toLocaleDateString()}. You cannot create citations.`;
          alert(message);
        } else {
          saveBtn.disabled = false;
          saveBtn.textContent = "Save";
          alert("Failed to save annotation. Please try again.");
        }
      }
    });
    playerContainer.appendChild(popup);
    setActivePopup(popup);
    applyTheme();
    setTimeout(() => textarea.focus(), 0);
  }

  // src/content/accountSidebar.js
  function updateLoginButton() {
    if (!loginButton) return;
    const sidebarWasOpen = loginButton.classList.contains("sidebar-open");
    if (authManager.isLoggedIn()) {
      const user = authManager.getCurrentUser();
      const initials = getInitials(user.displayName);
      loginButton.className = "yt-annotator-user-badge";
      loginButton.innerHTML = `<span class="yt-annotator-user-initials">${escapeHtml(initials)}</span>`;
      loginButton.title = `Logged in as ${user.displayName} - Click to logout`;
    } else {
      loginButton.className = "yt-annotator-login-btn";
      loginButton.innerHTML = "\u{1F464}";
      loginButton.title = "Sign in or create account";
    }
    if (sidebarWasOpen) loginButton.classList.add("sidebar-open");
  }
  function createLoginButton() {
    if (loginButton) return;
    const playerContainer = document.querySelector("#movie_player");
    if (!playerContainer) return;
    const btn = document.createElement("button");
    btn.className = "yt-annotator-user-badge";
    btn.innerHTML = "";
    btn.title = "Loading...";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      handleLoginButtonClick();
    });
    playerContainer.appendChild(btn);
    setLoginButton(btn);
  }
  function createAccountSidebar() {
    if (accountSidebar) return;
    const playerContainer = document.querySelector("#movie_player");
    if (!playerContainer) return;
    const sb = document.createElement("div");
    sb.className = "yt-annotator-account-sidebar";
    sb.addEventListener("keydown", (e) => e.stopPropagation());
    sb.addEventListener("keypress", (e) => e.stopPropagation());
    sb.addEventListener("keyup", (e) => e.stopPropagation());
    playerContainer.appendChild(sb);
    setAccountSidebar(sb);
  }
  function showMergeConfirmation(mergeData, sidebar2) {
    const body = sidebar2.querySelector(".yt-annotator-account-sidebar-body");
    if (!body) return;
    const name = mergeData.secondaryDisplayName || "YouTube account";
    const count = mergeData.secondaryShareCount || 0;
    const mergeHtml = `
    <div class="yt-annotator-merge-prompt">
      <p style="color:#ccc; font-size:0.85rem; line-height:1.5; margin:0.75rem 0;">
        Your YouTube channel is already linked to another account
        (<strong style="color:#fff;">${escapeHtml(name)}</strong>) with
        <strong style="color:#fff;">${count}</strong> citation${count !== 1 ? "s" : ""}.
        Merge into this account?
      </p>
      <div style="display:flex; gap:8px; margin-top:0.75rem;">
        <button class="yt-annotator-merge-confirm"
          style="flex:1; background:#0497a6; color:#000; border:none; border-radius:6px;
                 padding:8px 12px; font-size:0.82rem; font-weight:600; cursor:pointer;">
          Merge Accounts
        </button>
        <button class="yt-annotator-merge-cancel"
          style="flex:1; background:transparent; color:#aaa; border:1px solid #555;
                 border-radius:6px; padding:8px 12px; font-size:0.82rem; cursor:pointer;">
          Cancel
        </button>
      </div>
    </div>
  `;
    const connectBtn = body.querySelector(".yt-annotator-connect-yt-btn");
    if (connectBtn) {
      connectBtn.insertAdjacentHTML("afterend", mergeHtml);
      connectBtn.remove();
    } else {
      body.insertAdjacentHTML("beforeend", mergeHtml);
    }
    body.querySelector(".yt-annotator-merge-cancel").addEventListener("click", (e) => {
      e.stopPropagation();
      updateAccountSidebarContent();
    });
    body.querySelector(".yt-annotator-merge-confirm").addEventListener("click", async (e) => {
      e.stopPropagation();
      const btn = e.target;
      btn.textContent = "Merging...";
      btn.disabled = true;
      try {
        await authManager.mergeWithYouTube(mergeData._accessToken);
        updateAccountSidebarContent();
        if (currentVideoId) fetchAllAnnotations(currentVideoId);
      } catch (err) {
        console.error("[Auth] Merge failed:", err);
        btn.textContent = "Merge failed";
        btn.style.background = "#f44336";
        btn.style.color = "#fff";
        setTimeout(() => updateAccountSidebarContent(), 2e3);
      }
    });
  }
  function updateAccountSidebarContent() {
    if (!accountSidebar) return;
    if (authManager.isLoggedIn()) {
      const user = authManager.getCurrentUser();
      const initials = getInitials(user.displayName);
      const ytVerified = authManager.isYouTubeVerified();
      const ytTitle = user.youtubeChannelTitle || "";
      const ytSection = ytVerified ? `<div class="yt-annotator-yt-status">&#10003; YouTube: ${escapeHtml(ytTitle)}</div>` : `<button class="yt-annotator-connect-yt-btn">Verify as YouTube Creator</button>`;
      const bannedBanner = authManager.isBanned() ? `<div style="background: #f44336; color: white; padding: 8px 12px; border-radius: 4px; font-size: 13px; margin-bottom: 10px; text-align: center;">Your account is suspended. You can view citations but cannot create or edit them.</div>` : "";
      accountSidebar.innerHTML = `
      <div class="yt-annotator-sidebar-header">
        <h3>Account</h3>
        <button class="yt-annotator-sidebar-close" title="Close">&times;</button>
      </div>
      <div class="yt-annotator-account-sidebar-body">
        ${bannedBanner}
        <div class="yt-annotator-account-avatar">${escapeHtml(initials)}</div>
        <div class="yt-annotator-account-name">${escapeHtml(user.displayName)}</div>
        <div class="yt-annotator-account-email">${escapeHtml(user.email || "")}</div>
        ${ytSection}
        <div class="yt-annotator-account-stats">
          <div class="yt-annotator-account-stats-joined">Contributor since \u2014</div>
          <div class="yt-annotator-account-stats-row">
            <div class="yt-annotator-account-stat"><span class="yt-annotator-account-stat-num">\u2014</span> Citations</div>
            <div class="yt-annotator-account-stat"><span class="yt-annotator-account-stat-num">\u2014</span> Videos</div>
          </div>
        </div>
        <a class="yt-annotator-account-settings-link" href="https://www.citelines.org/my-dashboard" target="_blank">My Dashboard</a>
        <a class="yt-annotator-account-settings-link" href="https://www.citelines.org/account-settings" target="_blank">Account Settings</a>
        <div class="yt-annotator-theme-toggle">
          <span class="yt-annotator-theme-label">Theme</span>
          <div class="yt-annotator-theme-options">
            <button class="yt-annotator-theme-btn${getThemePref() === "auto" ? " active" : ""}" data-theme="auto">Auto</button>
            <button class="yt-annotator-theme-btn${getThemePref() === "light" ? " active" : ""}" data-theme="light">Light</button>
            <button class="yt-annotator-theme-btn${getThemePref() === "dark" ? " active" : ""}" data-theme="dark">Dark</button>
          </div>
        </div>
        <button class="yt-annotator-account-signout">Sign Out</button>
      </div>
    `;
      accountSidebar.querySelectorAll(".yt-annotator-theme-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const pref = btn.dataset.theme;
          await setThemePref(pref);
          accountSidebar.querySelectorAll(".yt-annotator-theme-btn").forEach((b) => b.classList.toggle("active", b.dataset.theme === pref));
        });
      });
      accountSidebar.querySelector(".yt-annotator-account-signout").addEventListener("click", async (e) => {
        e.stopPropagation();
        await authManager.logout();
        setUserShareId(null);
        toggleAccountSidebar();
        updateLoginButton();
        refreshMarkerColors();
        updateCreatorMode();
        if (currentVideoId) fetchAllAnnotations(currentVideoId);
      });
      const userId = user.id;
      if (userId) {
        fetch(`https://citelines-extension-production.up.railway.app/api/users/${userId}/profile`).then((r) => r.ok ? r.json() : Promise.reject()).then((profile) => {
          const joinedEl = accountSidebar?.querySelector(".yt-annotator-account-stats-joined");
          const statNums = accountSidebar?.querySelectorAll(".yt-annotator-account-stat-num");
          if (joinedEl && profile.accountCreated) {
            const d = new Date(profile.accountCreated);
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            joinedEl.textContent = `Contributor since ${months[d.getMonth()]} ${d.getFullYear()}`;
          }
          if (statNums && statNums.length >= 2) {
            statNums[0].textContent = profile.stats?.totalCitations ?? 0;
            statNums[1].textContent = profile.stats?.totalVideos ?? 0;
          }
        }).catch(() => {
        });
      }
      if (!ytVerified) {
        accountSidebar.querySelector(".yt-annotator-connect-yt-btn").addEventListener("click", async (e) => {
          e.stopPropagation();
          try {
            const result = await connectYouTubeChannel(api, authManager, (msg) => {
              const statusEl = accountSidebar.querySelector(".yt-annotator-connect-yt-btn");
              if (statusEl) statusEl.textContent = msg;
            });
            if (result.needsMerge) {
              showMergeConfirmation(result, accountSidebar);
              return;
            }
            updateAccountSidebarContent();
            if (currentVideoId) fetchAllAnnotations(currentVideoId);
          } catch (err) {
            console.error("[Auth] YouTube connect failed:", err);
            const btn = accountSidebar.querySelector(".yt-annotator-connect-yt-btn");
            if (btn) btn.textContent = "Connect YouTube Channel";
            alert(err.message || "Failed to connect YouTube channel");
          }
        });
      }
    } else {
      accountSidebar.innerHTML = `
      <div class="yt-annotator-sidebar-header">
        <h3>Account</h3>
        <button class="yt-annotator-sidebar-close" title="Close">&times;</button>
      </div>
      <div class="yt-annotator-account-auth-body"></div>
      <div class="yt-annotator-theme-toggle" style="padding: 0 16px 12px;">
        <span class="yt-annotator-theme-label">Theme</span>
        <div class="yt-annotator-theme-options">
          <button class="yt-annotator-theme-btn${getThemePref() === "auto" ? " active" : ""}" data-theme="auto">Auto</button>
          <button class="yt-annotator-theme-btn${getThemePref() === "light" ? " active" : ""}" data-theme="light">Light</button>
          <button class="yt-annotator-theme-btn${getThemePref() === "dark" ? " active" : ""}" data-theme="dark">Dark</button>
        </div>
      </div>
    `;
      if (!loginUI) {
        setLoginUI(new LoginUI(authManager, handleLoginSuccess, toggleAccountSidebar));
      }
      loginUI.show(accountSidebar.querySelector(".yt-annotator-account-auth-body"), "login");
      accountSidebar.querySelectorAll(".yt-annotator-theme-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const pref = btn.dataset.theme;
          await setThemePref(pref);
          accountSidebar.querySelectorAll(".yt-annotator-theme-btn").forEach((b) => b.classList.toggle("active", b.dataset.theme === pref));
        });
      });
    }
    accountSidebar.querySelector(".yt-annotator-sidebar-close").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleAccountSidebar();
    });
  }
  function toggleAccountSidebar() {
    if (sidebarOpen) toggleSidebar();
    setAccountSidebarOpen(!accountSidebarOpen);
    if (accountSidebarOpen) {
      createAccountSidebar();
      updateAccountSidebarContent();
      if (isCreatorMode()) accountSidebar.classList.add("creator-mode");
      accountSidebar.classList.add("yt-annotator-sidebar-open");
      applyTheme();
      if (addButton) addButton.classList.add("sidebar-open");
      if (sidebarButton) sidebarButton.classList.add("sidebar-open");
      if (loginButton) loginButton.classList.add("sidebar-open");
    } else {
      if (accountSidebar) accountSidebar.classList.remove("yt-annotator-sidebar-open");
      if (addButton) addButton.classList.remove("sidebar-open");
      if (sidebarButton) sidebarButton.classList.remove("sidebar-open");
      if (loginButton) loginButton.classList.remove("sidebar-open");
    }
  }
  function handleLoginButtonClick() {
    toggleAccountSidebar();
  }
  async function handleLoginSuccess() {
    console.log("[Auth] Login successful, refreshing UI...");
    updateLoginButton();
    refreshMarkerColors();
    updateCreatorMode();
    if (accountSidebarOpen) toggleAccountSidebar();
    if (currentVideoId) fetchAllAnnotations(currentVideoId);
    if (currentVideoId) {
      await fetchAllAnnotations(currentVideoId);
    }
  }
  async function checkExpiryWarning() {
    if (authManager.isLoggedIn()) return;
    try {
      const expiryInfo = await authManager.getExpiryInfo();
      if (expiryInfo && expiryInfo.daysUntilExpiry !== null && expiryInfo.daysUntilExpiry <= 10) {
        showExpiryWarning(expiryInfo.daysUntilExpiry);
      }
    } catch (error) {
      console.error("[Auth] Failed to check expiry:", error);
    }
  }
  function showExpiryWarning(daysLeft) {
    if (expiryWarning) return;
    const playerContainer = document.querySelector("#movie_player");
    if (!playerContainer) return;
    const warning = document.createElement("div");
    warning.className = "yt-annotator-expiry-warning";
    warning.innerHTML = `
    <div class="yt-annotator-expiry-warning-text">
      \u26A0\uFE0F Your account expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.
      Create an account to preserve your citations permanently.
    </div>
    <button>Sign Up</button>
  `;
    warning.querySelector("button").addEventListener("click", () => {
      if (!loginUI) {
        setLoginUI(new LoginUI(authManager, handleLoginSuccess));
      }
      loginUI.show("register");
    });
    playerContainer.appendChild(warning);
    setExpiryWarning(warning);
  }

  // src/content/main.js
  function createAddButton() {
    if (addButton) return;
    const playerContainer = document.querySelector("#movie_player");
    if (!playerContainer) return;
    const btn = document.createElement("button");
    btn.className = "yt-annotator-add-btn";
    btn.innerHTML = "+";
    btn.title = "Add annotation at current time";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const video = document.querySelector("video");
      if (video) {
        showCreatePopup(video.currentTime, video);
      }
    });
    playerContainer.appendChild(btn);
    setAddButton(btn);
  }
  async function initialize() {
    const videoId = getVideoId();
    if (!videoId) return;
    if (videoId !== currentVideoId) {
      setCurrentVideoId(videoId);
      if (typeof analytics !== "undefined") analytics.track("video_viewed", { videoId });
      annotations[videoId] = await loadAnnotations(videoId);
      setSharedAnnotations([]);
      setUserShareId(null);
      setBookmarkShareId(null);
      setBookmarkAnnotations([]);
      setCurrentVideoChannelId(null);
    }
    createMarkersContainer();
    createAddButton();
    createSidebarButton();
    createLoginButton();
    updateCreatorMode();
    initTheme();
    const [authReady, , channelIdResult] = await Promise.allSettled([
      authManager.initialize(),
      api.initialize(),
      getVideoChannelId()
    ]);
    if (channelIdResult.status === "fulfilled" && channelIdResult.value) {
      setCurrentVideoChannelId(channelIdResult.value);
      updateCreatorMode();
    }
    api.setAuthManager(authManager);
    updateLoginButton();
    checkExpiryWarning();
    if (authReady.status === "rejected") {
      console.error("[Auth] Failed to initialize:", authReady.reason);
    }
    try {
      await fetchAllAnnotations(videoId);
      applyTheme();
    } catch (err) {
      console.error("Failed to fetch annotations:", err);
    }
  }
  function waitForPlayer() {
    const observer = new MutationObserver((mutations, obs) => {
      if (initialized) return;
      const player2 = document.querySelector("#movie_player");
      const video2 = document.querySelector("video");
      if (player2 && video2) {
        if (video2.readyState >= 1) {
          setInitialized(true);
          obs.disconnect();
          initialize();
        } else {
          video2.addEventListener("loadedmetadata", () => {
            if (!initialized) {
              setInitialized(true);
              obs.disconnect();
              initialize();
            }
          }, { once: true });
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    setPlayerObserver(observer);
    const player = document.querySelector("#movie_player");
    const video = document.querySelector("video");
    if (player && video && video.readyState >= 1) {
      setInitialized(true);
      observer.disconnect();
      initialize();
    }
  }
  function handleNavigation() {
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        console.log("[YT Annotator] Navigation detected:", url);
        if (markersContainer) {
          markersContainer.remove();
          setMarkersContainer(null);
        }
        if (creatorMarkersContainer) {
          creatorMarkersContainer.remove();
          setCreatorMarkersContainer(null);
        }
        if (citationTimeline) {
          citationTimeline.remove();
          setCitationTimeline(null);
          setTimelineCollapsed(false);
        }
        if (adObserver) {
          adObserver.disconnect();
          setAdObserver(null);
        }
        if (addButton) {
          addButton.remove();
          setAddButton(null);
        }
        if (sidebarButton) {
          sidebarButton.remove();
          setSidebarButton(null);
        }
        if (loginButton) {
          loginButton.remove();
          setLoginButton(null);
        }
        if (sidebar) {
          sidebar.remove();
          setSidebar(null);
        }
        if (expiryWarning) {
          expiryWarning.remove();
          setExpiryWarning(null);
        }
        setSidebarOpen(false);
        setSharedAnnotations([]);
        setUserShareId(null);
        setBookmarkShareId(null);
        setBookmarkAnnotations([]);
        setCurrentVideoChannelId(null);
        setInitialized(false);
        closePopup();
        if (playerObserver) {
          playerObserver.disconnect();
          setPlayerObserver(null);
        }
        waitForPlayer();
      }
    }).observe(document, { subtree: true, childList: true });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (sidebarOpen) toggleSidebar();
      else if (accountSidebarOpen) toggleAccountSidebar();
    }
  });
  var mouseDownInsidePopup = false;
  document.addEventListener("mousedown", (e) => {
    if (activePopup) {
      mouseDownInsidePopup = activePopup.contains(e.target);
    }
  }, true);
  document.addEventListener("mouseup", (e) => {
    if (!activePopup) return;
    if (!mouseDownInsidePopup && !activePopup.contains(e.target)) {
      closePopup();
    }
    mouseDownInsidePopup = false;
  }, true);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && activePopup) {
      closePopup();
    }
  }, true);
  waitForPlayer();
  handleNavigation();
})();
