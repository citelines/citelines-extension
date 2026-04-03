(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // src/studio/state.js
  function setCurrentVideoId(val) {
    currentVideoId = val;
  }
  function setUserShareToken(val) {
    userShareToken = val;
  }
  function setAnnotations(val) {
    annotations = val;
  }
  function setSidebar(val) {
    sidebar = val;
  }
  function setSidebarOpen(val) {
    sidebarOpen = val;
  }
  function setCollapseButton(val) {
    collapseButton = val;
  }
  function setMarkersContainer(val) {
    markersContainer = val;
  }
  function setNavObserver(val) {
    navObserver = val;
  }
  function setInitialized(val) {
    initialized = val;
  }
  var currentVideoId, userShareToken, annotations, sidebar, sidebarOpen, collapseButton, markersContainer, navObserver, initialized;
  var init_state = __esm({
    "src/studio/state.js"() {
      currentVideoId = null;
      userShareToken = null;
      annotations = [];
      sidebar = null;
      sidebarOpen = true;
      collapseButton = null;
      markersContainer = null;
      navObserver = null;
      initialized = false;
    }
  });

  // src/studio/globals.js
  var api, authManager, LoginUI, analytics;
  var init_globals = __esm({
    "src/studio/globals.js"() {
      api = window.api;
      authManager = window.authManager;
      LoginUI = window.LoginUI;
      analytics = window.analytics;
    }
  });

  // src/studio/storage.js
  var storage_exports = {};
  __export(storage_exports, {
    deleteAnnotation: () => deleteAnnotation,
    fetchOwnCitations: () => fetchOwnCitations,
    saveAnnotation: () => saveAnnotation,
    updateAnnotation: () => updateAnnotation
  });
  async function fetchOwnCitations(videoId2) {
    const result = await api.getSharesForVideo(videoId2);
    const shares = result.shares || [];
    const ownShare = shares.find((s) => s.isOwner);
    if (ownShare) {
      setUserShareToken(ownShare.shareToken);
      setAnnotations(ownShare.annotations || []);
    } else {
      setUserShareToken(null);
      setAnnotations([]);
    }
    return annotations;
  }
  async function saveAnnotation(videoId2, annotation) {
    const updatedAnnotations = [...annotations, annotation];
    if (userShareToken) {
      await api.updateShare(userShareToken, {
        annotations: updatedAnnotations,
        title: getVideoTitle()
      });
    } else {
      const result = await api.createShare(videoId2, updatedAnnotations, getVideoTitle());
      setUserShareToken(result.shareToken);
    }
    setAnnotations(updatedAnnotations);
    return updatedAnnotations;
  }
  async function updateAnnotation(annotationId, changes) {
    const updatedAnnotations = annotations.map((ann) => {
      if (ann.id === annotationId) {
        const updated = { ...ann };
        if (changes.text !== void 0) updated.text = changes.text;
        if (changes.citation !== void 0) {
          updated.citation = { ...updated.citation || {}, ...changes.citation };
        }
        if (changes.timestamp !== void 0) updated.timestamp = changes.timestamp;
        return updated;
      }
      return ann;
    });
    await api.updateShare(userShareToken, {
      annotations: updatedAnnotations,
      title: getVideoTitle()
    });
    setAnnotations(updatedAnnotations);
    return updatedAnnotations;
  }
  async function deleteAnnotation(annotationId) {
    const updatedAnnotations = annotations.filter((ann) => ann.id !== annotationId);
    if (updatedAnnotations.length === 0 && userShareToken) {
      await api.deleteShare(userShareToken);
      setUserShareToken(null);
    } else if (userShareToken) {
      await api.updateShare(userShareToken, {
        annotations: updatedAnnotations,
        title: getVideoTitle()
      });
    }
    setAnnotations(updatedAnnotations);
    return updatedAnnotations;
  }
  function getVideoTitle() {
    const titleInput = document.querySelector('#title-wrapper input, #textbox[aria-label="Add a title"]');
    return titleInput?.value || "YouTube Video";
  }
  var init_storage = __esm({
    "src/studio/storage.js"() {
      init_state();
      init_globals();
    }
  });

  // src/studio/main.js
  init_state();
  init_globals();
  init_storage();

  // src/studio/sidebar.js
  init_state();
  init_globals();

  // src/content/utils.js
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

  // src/studio/citationForm.js
  init_state();
  init_storage();

  // src/studio/markers.js
  init_state();
  var retryCount = 0;
  var MAX_RETRIES = 10;
  var LANES = [
    { id: "article", label: "Article", icon: "\u{1F4C4}" },
    { id: "youtube", label: "YouTube", icon: "\u25B6" },
    { id: "movie", label: "Movie", icon: "\u{1F39E}" },
    { id: "book", label: "Book", icon: "\u{1F4D6}" },
    { id: "podcast", label: "Podcast", icon: "\u{1F399}" },
    { id: "note", label: "Note", icon: "\u{1F4DD}" }
  ];
  function getLaneId(ann) {
    return ann.citation?.type || "note";
  }
  function renderStudioMarkers() {
    if (markersContainer) {
      markersContainer.remove();
      setMarkersContainer(null);
    }
    if (!annotations || annotations.length === 0) return;
    const video = document.querySelector("video");
    if (!video) {
      retryLater();
      return;
    }
    const duration = video.duration;
    if (!duration || !isFinite(duration) || duration <= 0) {
      video.addEventListener("loadedmetadata", () => renderStudioMarkers(), { once: true });
      retryLater();
      return;
    }
    const timeline = document.querySelector("#timeline-container");
    if (!timeline) {
      retryLater();
      return;
    }
    retryCount = 0;
    const laneAnnotations = {};
    for (const ann of annotations) {
      const laneId = getLaneId(ann);
      if (!laneAnnotations[laneId]) laneAnnotations[laneId] = [];
      laneAnnotations[laneId].push(ann);
    }
    const populatedLanes = LANES.filter((l) => laneAnnotations[l.id]?.length > 0);
    const knownIds = new Set(LANES.map((l) => l.id));
    for (const laneId of Object.keys(laneAnnotations)) {
      if (!knownIds.has(laneId)) {
        populatedLanes.push({ id: laneId, label: laneId.charAt(0).toUpperCase() + laneId.slice(1), icon: "\u{1F4C4}" });
      }
    }
    if (populatedLanes.length === 0) return;
    const container = document.createElement("div");
    container.className = "citelines-studio-timeline";
    const header = document.createElement("div");
    header.className = "citelines-studio-timeline-header";
    header.innerHTML = `
    <span class="citelines-studio-timeline-title">
      <span class="citelines-studio-timeline-logo">Cite<span class="citelines-studio-timeline-pipe">|</span>ines</span>
      Timeline
    </span>
    <span class="citelines-studio-timeline-right">
      <span class="citelines-studio-timeline-count">${annotations.length} citation${annotations.length !== 1 ? "s" : ""} \xB7 ${populatedLanes.length} type${populatedLanes.length !== 1 ? "s" : ""}</span>
      <span class="citelines-studio-timeline-chevron">&#9660;</span>
    </span>
  `;
    const body = document.createElement("div");
    body.className = "citelines-studio-timeline-body";
    const tracks = document.createElement("div");
    tracks.className = "citelines-studio-timeline-tracks";
    for (const lane of populatedLanes) {
      const trackEl = document.createElement("div");
      trackEl.className = "citelines-studio-timeline-track";
      const laneEl = document.createElement("div");
      laneEl.className = "citelines-studio-timeline-track-lane";
      const laneBg = document.createElement("div");
      laneBg.className = "citelines-studio-timeline-track-lane-bg";
      laneEl.appendChild(laneBg);
      const laneAnns = laneAnnotations[lane.id] || [];
      for (const ann of laneAnns) {
        const pct = ann.timestamp / duration * 100;
        if (pct < 0 || pct > 100) continue;
        const marker = document.createElement("div");
        marker.className = "citelines-studio-timeline-marker";
        marker.style.left = pct + "%";
        marker.dataset.annotationId = ann.id;
        const tooltipSource = ann.citation?.title || ann.text || "Note";
        const tooltip = document.createElement("div");
        tooltip.className = "citelines-studio-marker-tooltip";
        tooltip.innerHTML = `<div class="citelines-studio-marker-tooltip-row"><span class="citelines-studio-marker-tooltip-time">${formatTime(ann.timestamp)}</span><span class="citelines-studio-marker-tooltip-source">${escapeHtml(tooltipSource)}</span></div><div class="citelines-studio-marker-tooltip-arrow"></div><div class="citelines-studio-marker-tooltip-arrow-inner"></div>`;
        marker.appendChild(tooltip);
        marker.addEventListener("click", (e) => {
          e.stopPropagation();
          showMarkerPopup(ann, marker);
          scrollToAnnotation(ann.id);
        });
        laneEl.appendChild(marker);
      }
      const labelEl = document.createElement("div");
      labelEl.className = "citelines-studio-timeline-track-label";
      labelEl.innerHTML = `<span class="citelines-studio-timeline-track-icon">${lane.icon}</span>${lane.label}`;
      trackEl.appendChild(laneEl);
      trackEl.appendChild(labelEl);
      tracks.appendChild(trackEl);
    }
    body.appendChild(tracks);
    container.appendChild(header);
    container.appendChild(body);
    const chevron = header.querySelector(".citelines-studio-timeline-chevron");
    header.addEventListener("click", () => {
      body.classList.toggle("collapsed");
      header.classList.toggle("collapsed");
      chevron.classList.toggle("collapsed");
    });
    const html5Player = document.querySelector("ytcp-video-info ytcp-html5-video-player");
    if (html5Player && html5Player.parentNode) {
      html5Player.parentNode.insertBefore(container, html5Player.nextSibling);
    } else {
      timeline.parentNode.insertBefore(container, timeline.nextSibling);
    }
    setMarkersContainer(container);
  }
  function retryLater() {
    if (retryCount < MAX_RETRIES) {
      retryCount++;
      setTimeout(() => renderStudioMarkers(), 1e3);
    }
  }
  var activePopup = null;
  function closeMarkerPopup() {
    if (activePopup) {
      activePopup.remove();
      activePopup = null;
    }
  }
  function showMarkerPopup(ann, marker) {
    closeMarkerPopup();
    const timelineEl = markersContainer;
    if (!timelineEl) return;
    if (getComputedStyle(timelineEl).position === "static") {
      timelineEl.style.position = "relative";
    }
    const popup = document.createElement("div");
    popup.className = "citelines-studio-popup";
    let citationHtml = "";
    if (ann.citation && ann.citation.type) {
      citationHtml = formatCitation(ann.citation, true);
    }
    popup.innerHTML = `
    <div class="citelines-studio-popup-header">
      <span class="citelines-studio-popup-time">${escapeHtml(formatTime(ann.timestamp))}</span>
      <button class="citelines-studio-popup-close">&times;</button>
    </div>
    ${citationHtml}
    ${ann.text ? `<div class="citelines-studio-popup-text">${escapeHtml(ann.text)}</div>` : ""}
    <div class="citelines-studio-popup-actions">
      <button class="citelines-studio-popup-goto">Go to</button>
    </div>
  `;
    popup.querySelector(".citelines-studio-popup-close").addEventListener("click", (e) => {
      e.stopPropagation();
      closeMarkerPopup();
    });
    popup.querySelector(".citelines-studio-popup-goto").addEventListener("click", (e) => {
      e.stopPropagation();
      const video = document.querySelector("video");
      if (video) video.currentTime = ann.timestamp;
      closeMarkerPopup();
    });
    timelineEl.appendChild(popup);
    activePopup = popup;
    const markerRect = marker.getBoundingClientRect();
    const timelineRect = timelineEl.getBoundingClientRect();
    const popupWidth = popup.offsetWidth;
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
    const outsideHandler = (e) => {
      if (!popup.contains(e.target) && !marker.contains(e.target)) {
        closeMarkerPopup();
        document.removeEventListener("click", outsideHandler);
      }
    };
    setTimeout(() => document.addEventListener("click", outsideHandler), 0);
  }
  function scrollToAnnotation(annotationId) {
    if (!sidebar) return;
    const el = sidebar.querySelector(`[data-annotation-id="${annotationId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("citelines-studio-highlight");
      setTimeout(() => el.classList.remove("citelines-studio-highlight"), 1500);
    }
  }

  // src/studio/citationForm.js
  function createCitationForm(videoId2) {
    const form = document.createElement("div");
    form.className = "citelines-studio-form";
    form.innerHTML = `
    <h3 class="citelines-studio-form-title">Add Citation</h3>
    <div class="citelines-studio-field">
      <label class="citelines-studio-label">Timestamp</label>
      <div class="citelines-studio-timestamp-row">
        <input type="text" class="citelines-studio-input citelines-studio-timestamp-input" placeholder="0:00" value="0:00" />
        <button class="citelines-studio-btn-small citelines-studio-btn-current" title="Use current time">Now</button>
      </div>
    </div>
    <div class="citelines-studio-field">
      <label class="citelines-studio-label">Source Type</label>
      <select class="citelines-studio-select">
        <option value="note">Basic Note</option>
        <option value="youtube">YouTube Video</option>
        <option value="movie">Movie</option>
        <option value="article">Article</option>
      </select>
    </div>
    <div class="citelines-studio-dynamic-fields"></div>
    <div class="citelines-studio-field">
      <label class="citelines-studio-label">Note</label>
      <textarea class="citelines-studio-textarea" placeholder="Your note or comment..." rows="3"></textarea>
    </div>
    <div class="citelines-studio-field">
      <label class="citelines-studio-label">Citation Style</label>
      <select class="citelines-studio-select citelines-studio-style-select" disabled>
        <option value="">Coming soon (CSL)</option>
        <option value="apa">APA</option>
        <option value="mla">MLA</option>
        <option value="chicago">Chicago</option>
        <option value="ieee">IEEE</option>
      </select>
    </div>
    <div class="citelines-studio-form-actions">
      <button class="citelines-studio-btn citelines-studio-btn-save">Add Citation</button>
    </div>
    <div class="citelines-studio-form-message" style="display: none;"></div>
  `;
    const timestampInput = form.querySelector(".citelines-studio-timestamp-input");
    const currentBtn = form.querySelector(".citelines-studio-btn-current");
    const typeSelect = form.querySelector(".citelines-studio-select");
    const dynamicFields = form.querySelector(".citelines-studio-dynamic-fields");
    const textarea = form.querySelector(".citelines-studio-textarea");
    const saveBtn = form.querySelector(".citelines-studio-btn-save");
    const messageEl = form.querySelector(".citelines-studio-form-message");
    form.querySelectorAll("input, textarea, select").forEach((el) => {
      el.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          saveBtn.click();
        }
      });
      el.addEventListener("keyup", (e) => e.stopPropagation());
      el.addEventListener("keypress", (e) => e.stopPropagation());
    });
    currentBtn.addEventListener("click", () => {
      const video = document.querySelector("video");
      if (video) {
        timestampInput.value = formatTime(video.currentTime);
      }
    });
    function updateDynamicFields(type) {
      const fields = CITATION_FIELD_DEFS[type] || [];
      if (fields.length === 0) {
        dynamicFields.innerHTML = "";
        return;
      }
      let html = "";
      for (const field of fields) {
        if (field.isDate) {
          html += `
          <div class="citelines-studio-field">
            <label class="citelines-studio-label">Date</label>
            <div class="citelines-studio-date-row">
              <input type="text" class="citelines-studio-input" data-field="month" placeholder="Month" />
              <input type="text" class="citelines-studio-input" data-field="day" placeholder="Day" />
              <input type="text" class="citelines-studio-input" data-field="year" placeholder="Year" />
            </div>
          </div>
        `;
        } else {
          const isUrl = field.key === "url";
          html += `
          <div class="citelines-studio-field">
            <label class="citelines-studio-label">${escapeHtml(field.label)}</label>
            <input type="${isUrl ? "url" : "text"}" class="citelines-studio-input" data-field="${field.key}" placeholder="${escapeHtml(field.label)}" />
          </div>
        `;
        }
      }
      dynamicFields.innerHTML = html;
      dynamicFields.querySelectorAll("input").forEach((el) => {
        el.addEventListener("keydown", (e) => {
          e.stopPropagation();
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            saveBtn.click();
          }
        });
        el.addEventListener("keyup", (e) => e.stopPropagation());
        el.addEventListener("keypress", (e) => e.stopPropagation());
      });
    }
    typeSelect.addEventListener("change", () => updateDynamicFields(typeSelect.value));
    updateDynamicFields("note");
    saveBtn.addEventListener("click", async () => {
      if (saveBtn.disabled) return;
      const timestamp = parseTimestamp(timestampInput.value);
      if (timestamp === null) {
        showMessage(messageEl, "Invalid timestamp format. Use M:SS or H:MM:SS.", true);
        return;
      }
      const text = textarea.value.trim();
      const citationType = typeSelect.value;
      let citation = null;
      if (citationType !== "note") {
        citation = { type: citationType };
        const fields = CITATION_FIELD_DEFS[citationType] || [];
        for (const field of fields) {
          if (field.isDate) {
            const month = dynamicFields.querySelector('[data-field="month"]')?.value.trim() || "";
            const day = dynamicFields.querySelector('[data-field="day"]')?.value.trim() || "";
            const year = dynamicFields.querySelector('[data-field="year"]')?.value.trim() || "";
            if (month) citation.month = month;
            if (day) citation.day = day;
            if (year) citation.year = year;
          } else {
            const val = dynamicFields.querySelector(`[data-field="${field.key}"]`)?.value.trim() || "";
            if (val) citation[field.key] = val;
          }
        }
        if (!citation.title && citationType !== "note") {
          showMessage(messageEl, "Please enter a title for the citation.", true);
          return;
        }
      }
      if (!text && !citation) {
        showMessage(messageEl, "Please enter a note or add a citation.", true);
        return;
      }
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";
      const annotation = {
        id: Date.now().toString(),
        timestamp,
        text,
        citation,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      try {
        await saveAnnotation(videoId2, annotation);
        renderCitationList();
        renderStudioMarkers();
        timestampInput.value = "0:00";
        typeSelect.value = "note";
        updateDynamicFields("note");
        textarea.value = "";
        showMessage(messageEl, "Citation added!", false);
      } catch (err) {
        console.error("[Studio] Failed to save citation:", err);
        showMessage(messageEl, "Failed to save. Please try again.", true);
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Add Citation";
      }
    });
    return form;
  }
  function parseTimestamp(str) {
    const parts = str.trim().split(":").map(Number);
    if (parts.some(isNaN)) return null;
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return null;
  }
  function showMessage(el, text, isError) {
    el.textContent = text;
    el.style.display = "block";
    el.className = "citelines-studio-form-message" + (isError ? " citelines-studio-error" : " citelines-studio-success");
    setTimeout(() => {
      el.style.display = "none";
    }, 3e3);
  }

  // src/studio/sidebar.js
  init_storage();
  var escHandler = null;
  function createSidebar(videoId2) {
    removeSidebar();
    const sidebar2 = document.createElement("div");
    sidebar2.className = "citelines-studio-sidebar";
    sidebar2.id = "citelines-studio-sidebar";
    const header = document.createElement("div");
    header.className = "citelines-studio-header";
    header.innerHTML = `
    <div class="citelines-studio-header-left">
      <span class="citelines-studio-logo">C<span class="citelines-studio-logo-pipe">|</span></span>
      <span class="citelines-studio-title">Citelines</span>
    </div>
    <button class="citelines-studio-close" title="Collapse sidebar">&times;</button>
  `;
    sidebar2.appendChild(header);
    header.querySelector(".citelines-studio-close").addEventListener("click", collapseSidebar);
    const content = document.createElement("div");
    content.className = "citelines-studio-content";
    sidebar2.appendChild(content);
    document.body.appendChild(sidebar2);
    setSidebar(sidebar2);
    setSidebarOpen(true);
    setStudioLayout(true);
    showCollapseButton();
    if (!escHandler) {
      escHandler = (e) => {
        if (e.key === "Escape" && sidebarOpen) {
          collapseSidebar();
        }
      };
      document.addEventListener("keydown", escHandler);
    }
    if (authManager.isLoggedIn()) {
      renderAuthenticatedContent(content, videoId2);
    } else {
      renderSignInPrompt(content);
    }
  }
  function renderAuthenticatedContent(content, videoId2) {
    const form = createCitationForm(videoId2);
    content.appendChild(form);
    const divider = document.createElement("div");
    divider.className = "citelines-studio-divider";
    content.appendChild(divider);
    const listHeader = document.createElement("div");
    listHeader.className = "citelines-studio-list-header";
    listHeader.innerHTML = `<h3>Your Citations</h3><span class="citelines-studio-count">${annotations.length}</span>`;
    content.appendChild(listHeader);
    const list = document.createElement("div");
    list.className = "citelines-studio-list";
    list.id = "citelines-studio-list";
    content.appendChild(list);
    renderCitationListInto(list);
  }
  function renderSignInPrompt(content) {
    const prompt = document.createElement("div");
    prompt.className = "citelines-studio-signin";
    prompt.innerHTML = `
    <div class="citelines-studio-signin-icon">&#128274;</div>
    <h3>Sign in to add citations</h3>
    <p>Sign in with your YouTube account to add citations to your videos.</p>
    <button class="citelines-studio-btn citelines-studio-btn-youtube">&#9654; Sign in with YouTube</button>
  `;
    prompt.querySelector(".citelines-studio-btn-youtube").addEventListener("click", async () => {
      try {
        if (window.launchYouTubeOAuth) {
          await window.launchYouTubeOAuth();
          if (authManager.isLoggedIn()) {
            const videoId2 = currentVideoId;
            if (videoId2) {
              const { fetchOwnCitations: fetchOwnCitations2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
              await fetchOwnCitations2(videoId2);
              createSidebar(videoId2);
              renderStudioMarkers();
            }
          }
        }
      } catch (err) {
        console.error("[Studio] YouTube sign-in failed:", err);
      }
    });
    content.appendChild(prompt);
  }
  function renderCitationList() {
    if (!sidebar) return;
    const list = sidebar.querySelector("#citelines-studio-list");
    if (!list) return;
    renderCitationListInto(list);
    const count = sidebar.querySelector(".citelines-studio-count");
    if (count) count.textContent = annotations.length;
  }
  function renderCitationListInto(list) {
    if (annotations.length === 0) {
      list.innerHTML = '<div class="citelines-studio-empty">No citations yet. Use the form above to add one.</div>';
      return;
    }
    const sorted = [...annotations].sort((a, b) => a.timestamp - b.timestamp);
    list.innerHTML = "";
    for (const ann of sorted) {
      const item = document.createElement("div");
      item.className = "citelines-studio-citation-item";
      item.dataset.annotationId = ann.id;
      let citationHtml = "";
      if (ann.citation && ann.citation.type) {
        citationHtml = formatCitation(ann.citation, true);
      }
      item.innerHTML = `
      <div class="citelines-studio-citation-top">
        <span class="citelines-studio-citation-time">${escapeHtml(formatTime(ann.timestamp))}</span>
        <div class="citelines-studio-citation-actions">
          <button class="citelines-studio-btn-icon citelines-studio-edit-btn" title="Edit">&#9998;</button>
          <button class="citelines-studio-btn-icon citelines-studio-delete-btn" title="Delete">&times;</button>
        </div>
      </div>
      ${citationHtml}
      ${ann.text ? `<div class="citelines-studio-citation-text">${escapeHtml(ann.text)}</div>` : ""}
      <div class="citelines-studio-citation-meta">${formatCreationTime(ann.createdAt)}</div>
    `;
      item.querySelector(".citelines-studio-edit-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        showEditForm(item, ann);
      });
      item.querySelector(".citelines-studio-delete-btn").addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!confirm("Delete this citation?")) return;
        try {
          await deleteAnnotation(ann.id);
          renderCitationList();
          renderStudioMarkers();
        } catch (err) {
          console.error("[Studio] Failed to delete:", err);
          alert("Failed to delete citation.");
        }
      });
      list.appendChild(item);
    }
  }
  function showEditForm(item, ann) {
    const existing = item.querySelector(".citelines-studio-edit-form");
    if (existing) {
      existing.remove();
      return;
    }
    const form = document.createElement("div");
    form.className = "citelines-studio-edit-form";
    const citationType = ann.citation?.type || "note";
    const fields = CITATION_FIELD_DEFS[citationType] || [];
    let fieldsHtml = "";
    for (const field of fields) {
      if (field.isDate) {
        fieldsHtml += `
        <div class="citelines-studio-field">
          <label class="citelines-studio-label">Date</label>
          <div class="citelines-studio-date-row">
            <input type="text" class="citelines-studio-input" data-edit-field="month" placeholder="Month" value="${escapeHtml(ann.citation?.month || "")}" />
            <input type="text" class="citelines-studio-input" data-edit-field="day" placeholder="Day" value="${escapeHtml(ann.citation?.day || "")}" />
            <input type="text" class="citelines-studio-input" data-edit-field="year" placeholder="Year" value="${escapeHtml(ann.citation?.year || "")}" />
          </div>
        </div>
      `;
      } else {
        const val = ann.citation?.[field.key] || "";
        fieldsHtml += `
        <div class="citelines-studio-field">
          <label class="citelines-studio-label">${escapeHtml(field.label)}</label>
          <input type="text" class="citelines-studio-input" data-edit-field="${field.key}" value="${escapeHtml(val)}" />
        </div>
      `;
      }
    }
    form.innerHTML = `
    <div class="citelines-studio-field">
      <label class="citelines-studio-label">Timestamp</label>
      <input type="text" class="citelines-studio-input" data-edit-field="timestamp" value="${escapeHtml(formatTime(ann.timestamp))}" />
    </div>
    ${fieldsHtml}
    <div class="citelines-studio-field">
      <label class="citelines-studio-label">Note</label>
      <textarea class="citelines-studio-textarea" data-edit-field="text" rows="2">${escapeHtml(ann.text || "")}</textarea>
    </div>
    <div class="citelines-studio-edit-actions">
      <button class="citelines-studio-btn citelines-studio-btn-cancel">Cancel</button>
      <button class="citelines-studio-btn citelines-studio-btn-save">Save</button>
    </div>
  `;
    form.querySelectorAll("input, textarea").forEach((el) => {
      el.addEventListener("keydown", (e) => e.stopPropagation());
      el.addEventListener("keyup", (e) => e.stopPropagation());
      el.addEventListener("keypress", (e) => e.stopPropagation());
    });
    form.querySelector(".citelines-studio-btn-cancel").addEventListener("click", () => form.remove());
    form.querySelector(".citelines-studio-btn-save").addEventListener("click", async () => {
      const tsInput = form.querySelector('[data-edit-field="timestamp"]');
      const timestamp = parseTimestamp2(tsInput.value);
      if (timestamp === null) {
        alert("Invalid timestamp format.");
        return;
      }
      const text = form.querySelector('[data-edit-field="text"]').value.trim();
      const citation = {};
      for (const field of fields) {
        if (field.isDate) {
          citation.month = form.querySelector('[data-edit-field="month"]')?.value.trim() || "";
          citation.day = form.querySelector('[data-edit-field="day"]')?.value.trim() || "";
          citation.year = form.querySelector('[data-edit-field="year"]')?.value.trim() || "";
        } else {
          citation[field.key] = form.querySelector(`[data-edit-field="${field.key}"]`)?.value.trim() || "";
        }
      }
      try {
        const changes = { text, timestamp };
        if (Object.keys(citation).length > 0) {
          changes.citation = { ...ann.citation, ...citation };
        }
        await updateAnnotation(ann.id, changes);
        renderCitationList();
        renderStudioMarkers();
      } catch (err) {
        console.error("[Studio] Failed to update:", err);
        alert("Failed to save changes.");
      }
    });
    item.appendChild(form);
  }
  function parseTimestamp2(str) {
    const parts = str.trim().split(":").map(Number);
    if (parts.some(isNaN)) return null;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return null;
  }
  function collapseSidebar() {
    if (sidebar) {
      sidebar.style.display = "none";
    }
    setStudioLayout(false);
    setSidebarOpen(false);
    showCollapseButton();
  }
  function expandSidebar() {
    if (sidebar) {
      sidebar.style.display = "";
    }
    setStudioLayout(true);
    setSidebarOpen(true);
    showCollapseButton();
  }
  function toggleSidebar() {
    if (sidebarOpen) {
      collapseSidebar();
    } else {
      expandSidebar();
    }
  }
  var SIDEBAR_WIDTH = 360;
  var layoutStyleTag = null;
  function setStudioLayout(open) {
    if (open) {
      document.body.classList.add("citelines-studio-open");
      if (!layoutStyleTag) {
        layoutStyleTag = document.createElement("style");
        layoutStyleTag.textContent = `
        body.citelines-studio-open ytcp-entity-page#entity-page {
          right: ${SIDEBAR_WIDTH}px !important;
          width: auto !important;
          left: 0 !important;
        }
        body.citelines-studio-open .nav-and-main-content,
        body.citelines-studio-open main#main {
          overflow-x: hidden !important;
        }
      `;
        document.head.appendChild(layoutStyleTag);
      }
      window.dispatchEvent(new Event("resize"));
      applyEditorLayout();
      setTimeout(applyEditorLayout, 500);
    } else {
      document.body.classList.remove("citelines-studio-open");
      clearEditorLayout();
      window.dispatchEvent(new Event("resize"));
    }
  }
  function applyEditorLayout() {
    const editor = document.querySelector("ytcp-video-metadata-editor");
    if (!editor) return;
    editor.style.setProperty("overflow", "hidden", "important");
    const wrapperDiv = editor.querySelector(":scope > div");
    if (wrapperDiv) {
      wrapperDiv.style.setProperty("flex-shrink", "1", "important");
      wrapperDiv.style.setProperty("min-width", "0", "important");
    }
    const sp = editor.querySelector("ytcp-video-metadata-editor-sidepanel");
    if (sp) {
      sp.style.setProperty("flex-shrink", "0", "important");
    }
  }
  function clearEditorLayout() {
    const editor = document.querySelector("ytcp-video-metadata-editor");
    if (!editor) return;
    editor.style.removeProperty("overflow");
    const wrapperDiv = editor.querySelector(":scope > div");
    if (wrapperDiv) {
      wrapperDiv.style.removeProperty("flex-shrink");
      wrapperDiv.style.removeProperty("min-width");
    }
    const sp = editor.querySelector("ytcp-video-metadata-editor-sidepanel");
    if (sp) {
      sp.style.removeProperty("flex-shrink");
    }
  }
  function showCollapseButton() {
    if (!collapseButton) {
      const btn = document.createElement("button");
      btn.className = "citelines-studio-collapse-btn";
      btn.innerHTML = 'C<span style="color:#ffaa3e">|</span>';
      btn.addEventListener("click", toggleSidebar);
      document.body.appendChild(btn);
      setCollapseButton(btn);
    }
    if (sidebarOpen) {
      collapseButton.style.right = `${SIDEBAR_WIDTH + 12}px`;
      collapseButton.title = "Close Citelines sidebar";
    } else {
      collapseButton.style.right = "24px";
      collapseButton.title = "Open Citelines sidebar";
    }
  }
  function removeCollapseButton() {
    if (collapseButton) {
      collapseButton.remove();
      setCollapseButton(null);
    }
  }
  function removeSidebar() {
    if (sidebar) {
      sidebar.remove();
      setSidebar(null);
    }
    setStudioLayout(false);
    removeCollapseButton();
    setSidebarOpen(true);
  }

  // src/studio/main.js
  console.log("[Citelines Studio] Content script loaded");
  function getVideoIdFromUrl() {
    const match = window.location.pathname.match(/^\/video\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }
  async function initialize(videoId2) {
    if (initialized && currentVideoId === videoId2) return;
    console.log("[Citelines Studio] Initializing for video:", videoId2);
    setCurrentVideoId(videoId2);
    setInitialized(true);
    try {
      await Promise.allSettled([
        authManager.initialize(),
        api.initialize()
      ]);
      api.setAuthManager(authManager);
    } catch (err) {
      console.error("[Citelines Studio] Auth/API init failed:", err);
    }
    if (analytics) analytics.track("studio_viewed", { videoId: videoId2 });
    if (authManager.isLoggedIn()) {
      try {
        await fetchOwnCitations(videoId2);
      } catch (err) {
        console.error("[Citelines Studio] Failed to fetch citations:", err);
      }
    }
    createSidebar(videoId2);
    renderStudioMarkers();
  }
  function cleanup() {
    removeSidebar();
    if (markersContainer) {
      markersContainer.remove();
      setMarkersContainer(null);
    }
    setCurrentVideoId(null);
    setUserShareToken(null);
    setAnnotations([]);
    setInitialized(false);
  }
  function handleNavigation() {
    let lastUrl = location.href;
    const observer = new MutationObserver(() => {
      const url = location.href;
      if (url === lastUrl) return;
      lastUrl = url;
      console.log("[Citelines Studio] Navigation detected:", url);
      const videoId2 = getVideoIdFromUrl();
      if (videoId2 && videoId2 !== currentVideoId) {
        cleanup();
        initialize(videoId2);
      } else if (!videoId2 && currentVideoId) {
        cleanup();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setNavObserver(observer);
  }
  var videoId = getVideoIdFromUrl();
  if (videoId) {
    setTimeout(() => initialize(videoId), 100);
  } else {
    console.log("[Citelines Studio] Not a video edit page, waiting for navigation...");
  }
  handleNavigation();
})();
