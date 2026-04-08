(function () {
  "use strict";

  /**
   * Change this before deploying. Anyone can read it in the page source —
   * this only blocks casual editing, not a determined person.
   */
  const ADMIN_PASSWORD = "bruce";

  /**
   * Optional GitHub token for “Publish to GitHub”. Leave empty — do not paste a real token here
   * if you push to GitHub: their push protection will block the commit. Use “Remember token on
   * this device” in the Publish dialog after pasting once, or paste the token each time.
   */
  const GITHUB_PUBLISH_TOKEN = "";

  const STORAGE_KEY = "gallery-catalog-v2";
  const LEGACY_STORAGE_KEY = "gallery-catalog-v1";
  const SESSION_UNLOCK = "gallery-pricing-unlocked";
  const SESSION_GH_TOKEN = "gallery-github-token";
  const LOCAL_GH_TOKEN = "gallery-github-token-local";

  /** Relative folder for shipped images (same directory as index.html when deployed). */
  const IMAGES_DIR = "images";

  const root = document.getElementById("categoriesRoot");
  const emptyState = document.getElementById("emptyState");
  const standaloneSection = document.getElementById("standaloneSection");
  const standaloneGrid = document.getElementById("standaloneGrid");
  const tplCategory = document.getElementById("tplCategory");
  const tplEntry = document.getElementById("tplEntry");
  const tplEntryImageRow = document.getElementById("tplEntryImageRow");
  const btnAddCategory = document.getElementById("addCategory");
  const btnAddStandalone = document.getElementById("addStandalone");
  const btnAddStandaloneFooter = document.getElementById("btnAddStandaloneFooter");
  const btnPublishGithub = document.getElementById("btnPublishGithub");
  const btnCopyCatalogJson = document.getElementById("btnCopyCatalogJson");
  const btnDownloadCatalogJson = document.getElementById("btnDownloadCatalogJson");
  const btnImportCatalog = document.getElementById("btnImportCatalog");
  const btnLoadLatestFromSite = document.getElementById("btnLoadLatestFromSite");
  const btnImportCatalogApply = document.getElementById("btnImportCatalogApply");
  const importCatalogModal = document.getElementById("importCatalogModal");
  const importCatalogTextarea = document.getElementById("importCatalogTextarea");
  const importCatalogError = document.getElementById("importCatalogError");
  const importCatalogFile = document.getElementById("importCatalogFile");
  const catalogClipboardFeedback = document.getElementById("catalogClipboardFeedback");
  const publishGithubModal = document.getElementById("publishGithubModal");
  const publishGithubOwner = document.getElementById("publishGithubOwner");
  const publishGithubRepo = document.getElementById("publishGithubRepo");
  const publishGithubPath = document.getElementById("publishGithubPath");
  const publishGithubToken = document.getElementById("publishGithubToken");
  const publishGithubRemember = document.getElementById("publishGithubRemember");
  const btnPublishGithubApply = document.getElementById("btnPublishGithubApply");
  const btnClearGithubToken = document.getElementById("btnClearGithubToken");
  const publishGithubError = document.getElementById("publishGithubError");
  const standaloneCollapseToggle = document.getElementById("standaloneCollapseToggle");
  const standaloneThumbStrip = document.getElementById("standaloneThumbStrip");
  const standaloneDetails = document.getElementById("standaloneDetails");
  const btnUnlock = document.getElementById("btnUnlock");
  const btnLock = document.getElementById("btnLock");
  const btnInstructions = document.getElementById("btnInstructions");
  const instructionsModal = document.getElementById("instructionsModal");
  const authModal = document.getElementById("authModal");
  const authPassword = document.getElementById("authPassword");
  const authSubmit = document.getElementById("authSubmit");
  const authError = document.getElementById("authError");
  const previewModal = document.getElementById("previewModal");
  const previewModalImg = document.getElementById("previewModalImg");
  const previewModalNoImg = document.getElementById("previewModalNoImg");
  const previewModalHeading = document.getElementById("previewModalHeading");
  const previewModalPrice = document.getElementById("previewModalPrice");
  const previewModalSold = document.getElementById("previewModalSold");
  const previewModalAvailability = document.getElementById("previewModalAvailability");
  const previewModalSet = document.getElementById("previewModalSet");
  const previewModalGoEdit = document.getElementById("previewModalGoEdit");
  const previewModalPrev = document.getElementById("previewModalPrev");
  const previewModalNext = document.getElementById("previewModalNext");
  const previewModalImgCount = document.getElementById("previewModalImgCount");

  /** Set in init — used when toggling lock so lists and prices refresh. */
  let catalogState = null;
  /** Last opened preview target for “Edit listing”. */
  let previewContext = null;

  function uid() {
    return Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
  }

  function isHttpLikeUrl(s) {
    return /^https?:\/\//i.test(s) || s.indexOf("//") === 0;
  }

  function pathHasDotDot(t) {
    if (!t || isHttpLikeUrl(t)) return false;
    return t.split(/[/\\]/).some(function (p) {
      return p === "..";
    });
  }

  function encodePathForImgSrc(path) {
    var t = (path || "").trim();
    if (!t) return "";
    if (isHttpLikeUrl(t)) return t;
    return t
      .replace(/\\/g, "/")
      .split("/")
      .filter(function (seg) {
        return seg.length > 0 && seg !== ".";
      })
      .map(function (seg) {
        return encodeURIComponent(seg);
      })
      .join("/");
  }

  function safeImageBasename(name) {
    if (!name || typeof name !== "string") return "";
    var base = name.replace(/^.*[\\/]/, "").trim();
    if (!base || base.indexOf("..") !== -1 || /[\\/]/.test(base)) return "";
    return base;
  }

  function isImageFile(file) {
    if (!file) return false;
    if (file.type && file.type.indexOf("image/") === 0) return true;
    return /\.(jpe?g|png|gif|webp|avif|bmp|svg)$/i.test(file.name || "");
  }

  function dataTransferMayHaveFiles(dt) {
    if (!dt) return false;
    if (dt.types && Array.prototype.indexOf.call(dt.types, "Files") !== -1) return true;
    if (dt.items && dt.items.length) {
      for (var i = 0; i < dt.items.length; i++) {
        if (dt.items[i].kind === "file") return true;
      }
    }
    return false;
  }

  function firstImageFileFromDataTransfer(dt) {
    if (!dt || !dt.files || !dt.files.length) return null;
    for (var i = 0; i < dt.files.length; i++) {
      if (isImageFile(dt.files[i])) return dt.files[i];
    }
    return null;
  }

  function normalizeTypedImagePath(v) {
    var t = (v || "").trim();
    if (!t) return "";
    if (isHttpLikeUrl(t)) return t;
    t = t.replace(/\\/g, "/").replace(/^\/+/, "");
    if (t.indexOf("/") === -1 && t.indexOf("\\") === -1) return IMAGES_DIR + "/" + t;
    return t;
  }

  function revokeEntryBlob(el) {
    revokeEntryImageBlobs(el);
  }

  function revokeEntryImageBlobs(el) {
    if (!el) return;
    el.querySelectorAll(".entry__image-row-item").forEach(function (row) {
      const u = row.dataset.blobUrl;
      if (u) {
        try {
          URL.revokeObjectURL(u);
        } catch (e) {
          /* ignore */
        }
        delete row.dataset.blobUrl;
      }
    });
    const legacy = el.dataset.blobUrl;
    if (legacy) {
      try {
        URL.revokeObjectURL(legacy);
      } catch (e) {
        /* ignore */
      }
      delete el.dataset.blobUrl;
    }
  }

  function parseMoney(v) {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.-]/g, ""));
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n * 100) / 100;
  }

  function formatMoney(n) {
    if (n === null || n === undefined || !Number.isFinite(n)) return "—";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  }

  function migrateFromV1(old) {
    const categories = Array.isArray(old.categories) ? old.categories : [];
    return {
      standalone: [],
      ui: { standaloneCollapsed: false },
      categories: categories.map(function (c) {
        return {
          id: c.id || uid(),
          title: c.title || "",
          offerAsSet: !!c.offerAsSet,
          setPrice: null,
          collapsed: false,
          entries: (Array.isArray(c.entries) ? c.entries : []).map(function (e) {
            return {
              id: e.id || uid(),
              images: e.url && String(e.url).trim() ? [String(e.url).trim()] : [],
              label: e.label || "",
              individual: e.individual !== false,
              price: null,
              sold: false,
              availabilityNote: "",
            };
          }),
        };
      }),
    };
  }

  function normalizeState(data) {
    if (!data || typeof data !== "object") data = {};
    if (!Array.isArray(data.categories)) data.categories = [];
    if (!Array.isArray(data.standalone)) data.standalone = [];
    if (!data.ui || typeof data.ui !== "object") data.ui = {};
    if (typeof data.ui.standaloneCollapsed !== "boolean") data.ui.standaloneCollapsed = false;
    data.categories.forEach(function (c) {
      if (!c.id) c.id = uid();
      c.title = c.title || "";
      c.offerAsSet = !!c.offerAsSet;
      c.setPrice = parseMoney(c.setPrice);
      if (typeof c.collapsed !== "boolean") c.collapsed = false;
      if (!Array.isArray(c.entries)) c.entries = [];
      c.entries.forEach(function (e) {
        if (!e.id) e.id = uid();
        var imgs = [];
        if (Array.isArray(e.images)) {
          imgs = e.images.map(function (s) {
            return String(s);
          });
        }
        if (typeof e.url === "string" && e.url.trim() && imgs.length === 0) {
          imgs = [e.url.trim()];
        }
        while (imgs.length && !imgs[imgs.length - 1].trim()) {
          imgs.pop();
        }
        e.images = imgs;
        delete e.url;
        e.label = e.label || "";
        e.individual = e.individual !== false;
        e.price = parseMoney(e.price);
        e.sold = e.sold === true;
        e.availabilityNote = typeof e.availabilityNote === "string" ? e.availabilityNote : "";
      });
    });
    data.standalone.forEach(function (e) {
      if (!e.id) e.id = uid();
      var imgsS = [];
      if (Array.isArray(e.images)) {
        imgsS = e.images.map(function (s) {
          return String(s);
        });
      }
      if (typeof e.url === "string" && e.url.trim() && imgsS.length === 0) {
        imgsS = [e.url.trim()];
      }
      while (imgsS.length && !imgsS[imgsS.length - 1].trim()) {
        imgsS.pop();
      }
      e.images = imgsS;
      delete e.url;
      e.label = e.label || "";
      e.price = parseMoney(e.price);
      e.sold = e.sold === true;
      e.availabilityNote = typeof e.availabilityNote === "string" ? e.availabilityNote : "";
    });
    return data;
  }

  function emptyCatalogState() {
    return normalizeState({ standalone: [], categories: [], ui: { standaloneCollapsed: false } });
  }

  /** Returns null only when nothing is in storage yet (allows optional fetch of catalog.json). */
  function loadState() {
    try {
      let raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacy) {
          const migrated = migrateFromV1(JSON.parse(legacy));
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          raw = localStorage.getItem(STORAGE_KEY);
        }
      }
      if (!raw) return null;
      return normalizeState(JSON.parse(raw));
    } catch {
      return emptyCatalogState();
    }
  }

  /**
   * If the browser has no saved catalog yet, try to load ./catalog.json (same folder as this page).
   * Use this on GitHub Pages: export your catalog, save the file as catalog.json next to index.html, commit, deploy.
   */
  function loadStateWithBootstrap() {
    return new Promise(function (resolve) {
      const fromStorage = loadState();
      if (fromStorage !== null) {
        resolve(fromStorage);
        return;
      }
      fetch("catalog.json", { cache: "no-store" })
        .then(function (r) {
          if (!r.ok) return null;
          return r.json();
        })
        .then(function (data) {
          if (data && typeof data === "object") {
            const normalized = normalizeState(data);
            saveState(normalized);
            resolve(normalized);
          } else {
            resolve(emptyCatalogState());
          }
        })
        .catch(function () {
          resolve(emptyCatalogState());
        });
    });
  }

  /**
   * Re-fetch catalog.json from the same origin (cache-busted). Use when another device published
   * or GitHub Pages cached an old file — normal refresh still uses localStorage until this runs.
   */
  function loadCatalogJsonFromWebsite(onDone) {
    const url = "catalog.json?cb=" + Date.now();
    fetch(url, { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then(function (data) {
        if (!data || typeof data !== "object") throw new Error("bad");
        const normalized = normalizeState(data);
        saveState(normalized);
        if (typeof onDone === "function") onDone(null);
      })
      .catch(function (err) {
        if (typeof onDone === "function") onDone(err);
      });
  }

  function showCatalogCopyFeedback(message) {
    if (!catalogClipboardFeedback) return;
    catalogClipboardFeedback.textContent = message;
    catalogClipboardFeedback.hidden = false;
    window.clearTimeout(showCatalogCopyFeedback._t);
    showCatalogCopyFeedback._t = window.setTimeout(function () {
      catalogClipboardFeedback.hidden = true;
      catalogClipboardFeedback.textContent = "";
    }, 2800);
  }

  function copyCatalogJsonToClipboard() {
    if (!catalogState || !isUnlocked()) return;
    const json = JSON.stringify(catalogState, null, 2);
    function doneOk() {
      showCatalogCopyFeedback("Copied — paste into catalog.json in your project folder.");
    }
    function doneFail() {
      window.alert("Could not copy automatically. Use Download JSON instead.");
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(json).then(doneOk).catch(function () {
        fallbackCopyText(json, doneOk, doneFail);
      });
    } else {
      fallbackCopyText(json, doneOk, doneFail);
    }
  }

  function fallbackCopyText(text, onOk, onFail) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (ok) onOk();
      else onFail();
    } catch (e) {
      onFail();
    }
  }

  function downloadCatalogJsonFile() {
    if (!catalogState || !isUnlocked()) return;
    const json = JSON.stringify(catalogState, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const a = document.createElement("a");
    const name = "catalog-export-" + new Date().toISOString().slice(0, 10) + ".json";
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function applyImportedCatalogJsonString(text, onDone) {
    try {
      const data = JSON.parse(text);
      const normalized = normalizeState(data);
      saveState(normalized);
      if (typeof onDone === "function") onDone(null);
    } catch (err) {
      if (typeof onDone === "function") onDone(err);
    }
  }

  function closeImportCatalogModal() {
    if (importCatalogModal) importCatalogModal.hidden = true;
    if (importCatalogError) {
      importCatalogError.hidden = true;
      importCatalogError.textContent = "";
    }
    document.body.style.overflow = "";
  }

  function openImportCatalogModal() {
    if (!isUnlocked()) return;
    if (previewModal && !previewModal.hidden) {
      closePreviewModal();
    }
    if (instructionsModal && !instructionsModal.hidden) {
      closeInstructionsModal();
    }
    if (authModal && !authModal.hidden) {
      closeModal();
    }
    if (importCatalogTextarea) importCatalogTextarea.value = "";
    if (importCatalogError) {
      importCatalogError.hidden = true;
      importCatalogError.textContent = "";
    }
    if (importCatalogModal) {
      importCatalogModal.hidden = false;
      document.body.style.overflow = "hidden";
      window.setTimeout(function () {
        if (importCatalogTextarea) importCatalogTextarea.focus();
      }, 0);
    }
  }

  function importCatalogFromChosenFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
      const text = String(reader.result || "").trim();
      if (importCatalogTextarea) importCatalogTextarea.value = text;
      if (importCatalogError) {
        importCatalogError.hidden = true;
        importCatalogError.textContent = "";
      }
      // Optional: auto-import immediately if it looks like JSON
      if (text && text[0] === "{") {
        // leave it for the user to click Import so it’s explicit
      }
    };
    reader.onerror = function () {
      if (importCatalogError) {
        importCatalogError.textContent = "Could not read that file.";
        importCatalogError.hidden = false;
      }
    };
    reader.readAsText(file, "utf-8");
  }

  function closePublishGithubModal() {
    if (publishGithubModal) publishGithubModal.hidden = true;
    if (publishGithubError) {
      publishGithubError.hidden = true;
      publishGithubError.textContent = "";
    }
    document.body.style.overflow = "";
  }

  /** Token order: typed field → this session → saved on device → optional constant in app.js */
  function resolveGithubTokenForPublish() {
    const fromInput = publishGithubToken ? publishGithubToken.value.trim() : "";
    if (fromInput) return fromInput;
    return (
      sessionStorage.getItem(SESSION_GH_TOKEN) ||
      localStorage.getItem(LOCAL_GH_TOKEN) ||
      String(GITHUB_PUBLISH_TOKEN || "").trim() ||
      ""
    );
  }

  function clearStoredGithubTokens() {
    localStorage.removeItem(LOCAL_GH_TOKEN);
    sessionStorage.removeItem(SESSION_GH_TOKEN);
    if (publishGithubToken) {
      publishGithubToken.value = String(GITHUB_PUBLISH_TOKEN || "").trim();
    }
  }

  function openPublishGithubModal() {
    if (!isUnlocked()) return;
    if (previewModal && !previewModal.hidden) closePreviewModal();
    if (instructionsModal && !instructionsModal.hidden) closeInstructionsModal();
    if (importCatalogModal && !importCatalogModal.hidden) closeImportCatalogModal();
    if (authModal && !authModal.hidden) closeModal();
    if (publishGithubError) {
      publishGithubError.hidden = true;
      publishGithubError.textContent = "";
    }
    if (publishGithubToken) {
      const t =
        sessionStorage.getItem(SESSION_GH_TOKEN) ||
        localStorage.getItem(LOCAL_GH_TOKEN) ||
        String(GITHUB_PUBLISH_TOKEN || "").trim() ||
        "";
      publishGithubToken.value = t;
    }
    if (publishGithubModal) {
      publishGithubModal.hidden = false;
      document.body.style.overflow = "hidden";
      window.setTimeout(function () {
        const hasToken = !!resolveGithubTokenForPublish();
        if (hasToken && btnPublishGithubApply) {
          btnPublishGithubApply.focus();
        } else if (publishGithubToken) {
          publishGithubToken.focus();
        }
      }, 0);
    }
  }

  function toBase64Utf8(text) {
    return btoa(
      encodeURIComponent(text).replace(/%([0-9A-F]{2})/g, function (_m, p1) {
        return String.fromCharCode(parseInt(p1, 16));
      })
    );
  }

  function githubApiJson(url, opts) {
    return fetch(url, opts).then(function (r) {
      return r
        .text()
        .then(function (t) {
          var data = null;
          try {
            data = t ? JSON.parse(t) : null;
          } catch (e) {
            data = null;
          }
          return { ok: r.ok, status: r.status, data: data, text: t };
        })
        .catch(function () {
          return { ok: r.ok, status: r.status, data: null, text: "" };
        });
    });
  }

  function publishCatalogToGithub(owner, repo, path, token) {
    if (!catalogState || !isUnlocked()) return Promise.resolve({ ok: false, msg: "Locked" });
    owner = String(owner || "").trim();
    repo = String(repo || "").trim();
    path = String(path || "").trim() || "catalog.json";
    token = String(token || "").trim();
    if (!owner || !repo || !token) return Promise.resolve({ ok: false, msg: "Missing fields" });

    sessionStorage.setItem(SESSION_GH_TOKEN, token);

    var apiBase =
      "https://api.github.com/repos/" +
      encodeURIComponent(owner) +
      "/" +
      encodeURIComponent(repo) +
      "/contents/";
    var url = apiBase + path.replace(/^\/+/, "");
    var headers = {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + token,
    };

    return githubApiJson(url, { method: "GET", headers: headers }).then(function (res) {
      var sha = null;
      if (res.ok && res.data && res.data.sha) sha = res.data.sha;
      if (!res.ok && res.status !== 404) {
        return { ok: false, msg: "GitHub error (GET): " + res.status };
      }

      var json = JSON.stringify(catalogState, null, 2);
      var body = {
        message: "Update catalog data",
        content: toBase64Utf8(json),
      };
      if (sha) body.sha = sha;

      return githubApiJson(url, {
        method: "PUT",
        headers: Object.assign({ "Content-Type": "application/json" }, headers),
        body: JSON.stringify(body),
      }).then(function (res2) {
        if (res2.ok) return { ok: true, msg: "Published" };
        var detail = "";
        if (res2.data && res2.data.message) detail = res2.data.message;
        return {
          ok: false,
          msg: "GitHub error (PUT): " + res2.status + (detail ? " — " + detail : ""),
        };
      });
    });
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function isUnlocked() {
    return sessionStorage.getItem(SESSION_UNLOCK) === "1";
  }

  function setUnlocked(on) {
    if (on) sessionStorage.setItem(SESSION_UNLOCK, "1");
    else sessionStorage.removeItem(SESSION_UNLOCK);
    applyLockUI();
  }

  function setEntryViewportTooltip(viewport) {
    if (!viewport) return;
    if (!isUnlocked()) {
      viewport.setAttribute("title", "Click the photo to see it larger with price and details.");
      viewport.classList.add("viewer-hover");
    } else {
      viewport.removeAttribute("title");
      viewport.classList.remove("viewer-hover");
    }
  }

  function refreshAllEntryViewportTooltips() {
    document.querySelectorAll(".entry__car-viewport").forEach(setEntryViewportTooltip);
  }

  function applyLockUI() {
    const unlocked = isUnlocked();
    document.body.classList.toggle("is-locked", !unlocked);
    btnUnlock.hidden = unlocked;
    btnLock.hidden = !unlocked;

    if (!unlocked && instructionsModal && !instructionsModal.hidden) {
      closeInstructionsModal();
    }
    if (!unlocked && importCatalogModal && !importCatalogModal.hidden) {
      closeImportCatalogModal();
    }
    if (!unlocked && publishGithubModal && !publishGithubModal.hidden) {
      closePublishGithubModal();
    }

    root.querySelectorAll(".category__title-input").forEach(function (inp) {
      inp.readOnly = !unlocked;
    });

    if (catalogState) {
      refreshAllDisplays(catalogState);
      updateEmptyAndStandalone(catalogState);
    }

    refreshAllEntryViewportTooltips();
  }

  function remainingSetPrice(cat) {
    if (!cat || !cat.offerAsSet) return null;
    const base = parseMoney(cat.setPrice);
    if (base === null || base <= 0) return null;
    let sub = 0;
    cat.entries.forEach(function (e) {
      if (e.sold === true) {
        const p = parseMoney(e.price);
        if (p !== null) sub += p;
      }
    });
    return Math.max(0, Math.round((base - sub) * 100) / 100);
  }

  function updateCategorySetDisplay(section, cat) {
    const viewer = section.querySelector(".category__set-pricing");
    const editor = section.querySelector(".category__set-editor");
    if (!cat.offerAsSet) {
      viewer.hidden = true;
      editor.hidden = true;
      syncCategoryCompactAside(section, cat);
      return;
    }
    viewer.hidden = false;
    editor.hidden = false;

    const base = parseMoney(cat.setPrice);
    const remaining = remainingSetPrice(cat);
    const baseEl = section.querySelector("[data-set-base]");
    const remEl = section.querySelector("[data-set-remaining]");
    const noteEl = section.querySelector("[data-set-note]");

    if (baseEl) baseEl.textContent = base !== null && base > 0 ? formatMoney(base) : "—";
    if (remEl) {
      if (base !== null && base > 0 && remaining !== null) remEl.textContent = formatMoney(remaining);
      else remEl.textContent = "—";
    }
    if (noteEl) {
      const soldCount = cat.entries.filter(function (e) {
        return e.sold === true;
      }).length;
      if (soldCount > 0 && base !== null && base > 0) {
        noteEl.hidden = false;
        noteEl.textContent =
          "Sold pieces are subtracted from the bundle using each piece’s individual price.";
      } else {
        noteEl.hidden = true;
      }
    }
    syncCategoryCompactAside(section, cat);
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function syncCategoryCompactAside(section, cat) {
    const el = section.querySelector("[data-compact-set]");
    if (!el) return;
    if (!cat.offerAsSet) {
      el.innerHTML =
        '<p class="category__compact-muted">This group is not offered as a combined set.</p>';
      return;
    }
    const base = parseMoney(cat.setPrice);
    const remaining = remainingSetPrice(cat);
    const baseStr = base !== null && base > 0 ? formatMoney(base) : "—";
    const remStr =
      base !== null && base > 0 && remaining !== null ? formatMoney(remaining) : "—";
    el.innerHTML =
      '<p class="category__compact-row"><span class="category__compact-k">Full set</span> <strong>' +
      escapeHtml(baseStr) +
      "</strong></p>" +
      '<p class="category__compact-row category__compact-row--accent"><span class="category__compact-k">Remaining set</span> <strong>' +
      escapeHtml(remStr) +
      "</strong></p>";
  }

  function updateEntryPublicDisplay(el, entry, isStandalone, cat) {
    const priceEl = el.querySelector("[data-price-display]");
    const labelView = el.querySelector(".entry__label-view");
    const flagSingle = el.querySelector(".entry__flag--nosingle");
    const flagSold = el.querySelector(".entry__flag--sold");
    const availView = el.querySelector(".entry__availability-view");
    const p = parseMoney(entry.price);
    if (priceEl) priceEl.textContent = p !== null ? formatMoney(p) : "—";
    if (labelView) {
      const t = (entry.label || "").trim();
      labelView.textContent = t;
      labelView.hidden = !t;
    }
    if (flagSingle) flagSingle.hidden = isStandalone || entry.individual !== false;
    if (flagSold) flagSold.hidden = entry.sold !== true;
    if (availView) {
      const note = (entry.availabilityNote || "").trim();
      availView.textContent = note;
      availView.hidden = !note;
    }
  }

  function refreshAllDisplays(state) {
    root.querySelectorAll(".category").forEach(function (section) {
      const id = section.dataset.categoryId;
      const cat = state.categories.find(function (c) {
        return c.id === id;
      });
      if (cat) updateCategorySetDisplay(section, cat);
    });
    root.querySelectorAll(".entry").forEach(function (el) {
      const entryId = el.dataset.entryId;
      const catSection = el.closest(".category");
      if (catSection) {
        const cid = catSection.dataset.categoryId;
        const cat = state.categories.find(function (c) {
          return c.id === cid;
        });
        const ent = cat && cat.entries.find(function (e) {
          return e.id === entryId;
        });
        if (ent) updateEntryPublicDisplay(el, ent, false, cat);
      }
    });
    standaloneGrid.querySelectorAll(".entry").forEach(function (el) {
      const entryId = el.dataset.entryId;
      const ent = state.standalone.find(function (e) {
        return e.id === entryId;
      });
      if (ent) updateEntryPublicDisplay(el, ent, true, null);
    });
  }

  function updateEmptyAndStandalone(state) {
    const hasCat = state.categories.length > 0;
    const hasStand = state.standalone.length > 0;
    emptyState.hidden = hasCat || hasStand;
    const showStandalone = hasStand || isUnlocked();
    standaloneSection.hidden = !showStandalone;
    applyStandaloneCollapsed(state);
  }

  function pathToImageSrc(raw) {
    const t = (raw || "").trim();
    if (!t || pathHasDotDot(t)) return null;
    const url = normalizeTypedImagePath(t);
    if (!url) return null;
    return isHttpLikeUrl(url) ? url : encodePathForImgSrc(url);
  }

  function entryImagesEffective(entry) {
    if (!entry || !Array.isArray(entry.images)) return [];
    return entry.images
      .map(function (s) {
        return String(s).trim();
      })
      .filter(Boolean);
  }

  function entrySlideCount(entry) {
    if (!entry || !Array.isArray(entry.images) || entry.images.length === 0) return 1;
    return entry.images.length;
  }

  function entryImageSrcAt(entry, slideIndex) {
    if (!entry || !Array.isArray(entry.images) || entry.images.length === 0) {
      return null;
    }
    const raw = entry.images[slideIndex];
    if (raw == null) return null;
    return pathToImageSrc(String(raw));
  }

  function entryImageSrc(entry) {
    const eff = entryImagesEffective(entry);
    return eff.length ? pathToImageSrc(eff[0]) : null;
  }

  function closePreviewModal() {
    if (previewModal) previewModal.hidden = true;
    previewContext = null;
    document.body.style.overflow = "";
  }

  function closeInstructionsModal() {
    if (instructionsModal) instructionsModal.hidden = true;
    document.body.style.overflow = "";
  }

  function openInstructionsModal() {
    if (!isUnlocked()) return;
    if (importCatalogModal && !importCatalogModal.hidden) {
      closeImportCatalogModal();
    }
    if (previewModal && !previewModal.hidden) {
      closePreviewModal();
    }
    if (authModal && !authModal.hidden) {
      closeModal();
    }
    if (instructionsModal) {
      instructionsModal.hidden = false;
      document.body.style.overflow = "hidden";
    }
  }

  function findEntryForPreview(ctx, state) {
    if (!ctx || !state) return null;
    if (ctx.isStandalone) {
      return state.standalone.find(function (e) {
        return e.id === ctx.entryId;
      });
    }
    const cat = state.categories.find(function (c) {
      return c.id === ctx.categoryId;
    });
    return cat && cat.entries.find(function (e) {
      return e.id === ctx.entryId;
    });
  }

  function renderPreviewModalSlide() {
    if (!previewContext || !catalogState || !previewModalImg || !previewModalNoImg) return;
    const ent = findEntryForPreview(previewContext, catalogState);
    if (!ent) return;
    const label = (ent.label || "").trim() || "Item";
    const n = entrySlideCount(ent);
    let idx = previewContext.imageIndex;
    if (typeof idx !== "number" || isNaN(idx)) idx = 0;
    if (idx < 0 || idx >= n) idx = 0;
    previewContext.imageIndex = idx;
    if (previewModalPrev) previewModalPrev.hidden = n <= 1;
    if (previewModalNext) previewModalNext.hidden = n <= 1;
    if (previewModalImgCount) {
      if (n <= 1) {
        previewModalImgCount.hidden = true;
        previewModalImgCount.textContent = "";
      } else {
        previewModalImgCount.hidden = false;
        previewModalImgCount.textContent = idx + 1 + " / " + n;
      }
    }
    const src = entryImageSrcAt(ent, ent.images.length ? idx : 0);
    if (src) {
      previewModalImg.hidden = false;
      previewModalImg.src = src;
      previewModalImg.alt = label;
      previewModalNoImg.hidden = true;
    } else {
      previewModalImg.hidden = true;
      previewModalImg.removeAttribute("src");
      previewModalNoImg.hidden = false;
    }
  }

  function stepPreviewSlide(delta) {
    if (!previewModal || previewModal.hidden || !previewContext || !catalogState) return;
    const ent = findEntryForPreview(previewContext, catalogState);
    if (!ent) return;
    const n = entrySlideCount(ent);
    if (n <= 1) return;
    let idx = previewContext.imageIndex + delta;
    idx = ((idx % n) + n) % n;
    previewContext.imageIndex = idx;
    renderPreviewModalSlide();
  }

  function openPreviewModal(ent, cat, state, startSlideIndex) {
    if (!previewModal || !ent) return;
    const n = entrySlideCount(ent);
    let start = 0;
    if (typeof startSlideIndex === "number" && !isNaN(startSlideIndex)) {
      start = Math.floor(startSlideIndex);
    }
    if (start < 0 || start >= n) start = 0;
    previewContext = {
      entryId: ent.id,
      categoryId: cat ? cat.id : null,
      isStandalone: !cat,
      imageIndex: start,
    };
    const label = (ent.label || "").trim() || "Item";
    if (previewModalHeading) previewModalHeading.textContent = label;
    const p = parseMoney(ent.price);
    if (previewModalPrice) previewModalPrice.textContent = p !== null ? formatMoney(p) : "—";
    if (previewModalSold) previewModalSold.hidden = ent.sold !== true;
    if (previewModalAvailability) {
      const parts = [];
      if (cat && ent.individual === false) {
        parts.push("Not sold individually — only with the set.");
      }
      const note = (ent.availabilityNote || "").trim();
      if (note) parts.push(note);
      previewModalAvailability.textContent = parts.join("\n\n");
      previewModalAvailability.hidden = parts.length === 0;
    }
    if (previewModalSet) {
      if (cat && cat.offerAsSet) {
        const base = parseMoney(cat.setPrice);
        const rem = remainingSetPrice(cat);
        previewModalSet.hidden = false;
        const baseStr = base !== null && base > 0 ? formatMoney(base) : "—";
        const remStr = rem !== null ? formatMoney(rem) : "—";
        previewModalSet.textContent = "Set bundle — Full: " + baseStr + " · Remaining: " + remStr;
      } else {
        previewModalSet.hidden = true;
        previewModalSet.textContent = "";
      }
    }
    renderPreviewModalSlide();
    previewModal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function fillRichThumbStrip(strip, entries, cat, state) {
    if (!strip) return;
    strip.replaceChildren();
    if (!entries || !entries.length) {
      const empty = document.createElement("span");
      empty.className = "thumb-strip__empty";
      empty.textContent = "No images yet";
      strip.appendChild(empty);
      return;
    }
    const isStandalone = !cat;
    entries.forEach(function (ent) {
      const card = document.createElement("div");
      card.className = "thumb-card";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "thumb-card__preview viewer-hover";
      btn.title = "Open a larger view with price and details for this item.";
      const label = (ent.label || "").trim();
      const p = parseMoney(ent.price);
      btn.setAttribute(
        "aria-label",
        "Preview " + (label || "item") + (p !== null ? ", " + formatMoney(p) : "")
      );
      const imgWrap = document.createElement("span");
      imgWrap.className = "thumb-card__img-wrap";
      const src = entryImageSrc(ent);
      if (src) {
        const im = document.createElement("img");
        im.src = src;
        im.alt = "";
        imgWrap.appendChild(im);
      } else {
        const ph = document.createElement("span");
        ph.className = "thumb-card__placeholder";
        ph.textContent = "No image";
        imgWrap.appendChild(ph);
      }
      btn.appendChild(imgWrap);
      const priceEl = document.createElement("span");
      priceEl.className = "thumb-card__price";
      priceEl.textContent = p !== null ? formatMoney(p) : "—";
      btn.appendChild(priceEl);
      btn.addEventListener("click", function () {
        openPreviewModal(ent, cat, state, 0);
      });
      card.appendChild(btn);
      if (ent.sold === true) {
        const sold = document.createElement("span");
        sold.className = "thumb-card__sold";
        sold.textContent = "Sold";
        card.appendChild(sold);
      }
      const note = (ent.availabilityNote || "").trim();
      if (note) {
        const noteEl = document.createElement("p");
        noteEl.className = "thumb-card__note";
        noteEl.textContent = note.length > 140 ? note.slice(0, 137) + "…" : note;
        card.appendChild(noteEl);
      }
      strip.appendChild(card);
    });
  }

  function refreshCategoryThumbStrip(section, cat, state) {
    const strip = section.querySelector(".category__thumb-strip");
    if (!strip) return;
    fillRichThumbStrip(strip, cat.entries, cat, state);
  }

  function applyCategoryCollapsed(section, cat, state) {
    const compact = section.querySelector(".category__compact");
    const details = section.querySelector(".category__details");
    const btn = section.querySelector('[data-action="toggle-category-collapse"]');
    if (!compact || !details || !btn) return;
    const collapsed = !!cat.collapsed;
    compact.hidden = !collapsed;
    details.hidden = collapsed;
    btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    btn.textContent = collapsed ? "Details & prices" : "Thumbnails";
    btn.setAttribute(
      "aria-label",
      collapsed ? "Expand category to edit prices and full cards" : "Show category as thumbnails only"
    );
    if (collapsed) {
      syncCategoryCompactAside(section, cat);
      refreshCategoryThumbStrip(section, cat, state);
    }
  }

  function refreshStandaloneThumbStrip(state) {
    if (!standaloneThumbStrip) return;
    fillRichThumbStrip(standaloneThumbStrip, state.standalone, null, state);
  }

  function applyStandaloneCollapsed(state) {
    if (!standaloneThumbStrip || !standaloneDetails || !standaloneCollapseToggle) return;
    const has = state.standalone.length > 0;
    standaloneCollapseToggle.hidden = !has;
    if (!has) {
      if (state.ui.standaloneCollapsed) {
        state.ui.standaloneCollapsed = false;
        saveState(state);
      }
      standaloneThumbStrip.hidden = true;
      standaloneDetails.hidden = false;
      return;
    }
    const collapsed = !!state.ui.standaloneCollapsed;
    standaloneThumbStrip.hidden = !collapsed;
    standaloneDetails.hidden = collapsed;
    standaloneCollapseToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    standaloneCollapseToggle.textContent = collapsed ? "Details & prices" : "Thumbnails";
    standaloneCollapseToggle.setAttribute(
      "aria-label",
      collapsed ? "Expand single products to edit prices" : "Show single products as thumbnails only"
    );
    if (collapsed) {
      refreshStandaloneThumbStrip(state);
    }
  }

  function refreshThumbsForEntryGrid(grid, state) {
    if (!grid) return;
    if (grid === standaloneGrid) {
      if (state.ui.standaloneCollapsed) {
        refreshStandaloneThumbStrip(state);
      }
      return;
    }
    const section = grid.closest(".category");
    if (!section) return;
    const cid = section.dataset.categoryId;
    const cat = state.categories.find(function (c) {
      return c.id === cid;
    });
    if (cat && cat.collapsed) {
      refreshCategoryThumbStrip(section, cat, state);
    }
  }

  function bindEntry(el, entryId, state, grid, isStandalone, categoryId) {
    const carousel = el.querySelector(".entry__carousel");
    const img = el.querySelector(".entry__img");
    const viewport = el.querySelector(".entry__car-viewport");
    const frame = el.querySelector(".entry__frame");
    const placeholder = el.querySelector(".entry__placeholder");
    const imagesRows = el.querySelector(".entry__images-rows");
    const btnAddView = el.querySelector(".entry__add-view");
    const labelInput = el.querySelector(".entry__label");
    const priceInput = el.querySelector(".entry__price");
    const individual = el.querySelector(".entry__individual");
    const sold = el.querySelector(".entry__sold");
    const soldWrap = el.querySelector(".entry__sold-wrap");
    const individualWrap = el.querySelector(".entry__individual-wrap");
    const btnPrev = el.querySelector(".entry__car-btn--prev");
    const btnNext = el.querySelector(".entry__car-btn--next");
    const carCount = el.querySelector(".entry__car-count");

    const catHint = el.querySelector(".entry__sold-hint-category");
    const standHint = el.querySelector(".entry__sold-hint-standalone");
    if (isStandalone) {
      if (soldWrap) soldWrap.hidden = false;
      if (individualWrap) individualWrap.hidden = true;
      if (catHint) catHint.hidden = true;
      if (standHint) standHint.hidden = false;
    } else {
      if (soldWrap) soldWrap.hidden = false;
      if (individualWrap) individualWrap.hidden = false;
      if (catHint) catHint.hidden = false;
      if (standHint) standHint.hidden = true;
    }

    function getEntry() {
      if (isStandalone) return state.standalone.find(function (e) {
        return e.id === entryId;
      });
      const cat = state.categories.find(function (c) {
        return c.id === categoryId;
      });
      return cat && cat.entries.find(function (e) {
        return e.id === entryId;
      });
    }

    function commitRowsToEntry() {
      const ent = getEntry();
      if (!ent || !imagesRows) return;
      const inputs = imagesRows.querySelectorAll(".entry__url-per");
      const out = [];
      inputs.forEach(function (inp) {
        out.push(inp.value);
      });
      while (out.length > 1 && !String(out[out.length - 1]).trim()) {
        out.pop();
      }
      if (out.length === 1 && !String(out[0]).trim()) {
        ent.images = [];
      } else {
        ent.images = out.map(function (s) {
          return String(s);
        });
        while (ent.images.length > 1 && !ent.images[ent.images.length - 1].trim()) {
          ent.images.pop();
        }
      }
    }

    function getCarouselIndex() {
      if (!carousel) return 0;
      const v = parseInt(carousel.dataset.carIndex, 10);
      return isNaN(v) ? 0 : v;
    }

    function setCarouselIndex(idx) {
      if (carousel) carousel.dataset.carIndex = String(idx);
    }

    function renderCarousel() {
      const ent = getEntry();
      if (!ent || !img || !placeholder) return;
      let idx = getCarouselIndex();
      const n = entrySlideCount(ent);
      if (idx >= n) idx = 0;
      if (idx < 0) idx = n - 1;
      setCarouselIndex(idx);
      if (btnPrev) btnPrev.hidden = n <= 1;
      if (btnNext) btnNext.hidden = n <= 1;
      if (carCount) {
        if (n <= 1) {
          carCount.textContent = "";
          carCount.hidden = true;
        } else {
          carCount.hidden = false;
          carCount.textContent = idx + 1 + " / " + n;
        }
      }
      const row = imagesRows && imagesRows.querySelector('.entry__image-row-item[data-img-index="' + idx + '"]');
      const blob = row && row.dataset.blobUrl;
      let src = blob || null;
      if (!src && ent.images.length > 0 && ent.images[idx] !== undefined) {
        src = entryImageSrcAt(ent, idx);
      }
      if (src) {
        img.hidden = false;
        img.src = src;
        img.alt = labelInput.value.trim() || "Catalog image";
      } else {
        img.hidden = true;
        img.removeAttribute("src");
        placeholder.textContent = "No image";
      }
    }

    function rebuildImageRows() {
      const ent = getEntry();
      if (!ent || !imagesRows || !tplEntryImageRow) return;
      imagesRows.querySelectorAll(".entry__image-row-item").forEach(function (r) {
        const u = r.dataset.blobUrl;
        if (u) {
          try {
            URL.revokeObjectURL(u);
          } catch (x) {
            /* ignore */
          }
        }
      });
      imagesRows.replaceChildren();
      const n = Math.max(1, ent.images.length);
      for (let i = 0; i < n; i++) {
        const val = ent.images[i] !== undefined ? ent.images[i] : "";
        const row = tplEntryImageRow.content.cloneNode(true).firstElementChild;
        row.dataset.imgIndex = String(i);
        const inp = row.querySelector(".entry__url-per");
        const fileInp = row.querySelector(".entry__file-per");
        const rm = row.querySelector(".entry__remove-view");
        inp.value = val;
        const slideIdx = i;
        inp.addEventListener("input", function () {
          commitRowsToEntry();
          saveState(state);
          renderCarousel();
          afterEntryChange();
        });
        inp.addEventListener("blur", function () {
          const raw = inp.value.trim();
          if (raw && !isHttpLikeUrl(raw) && raw.indexOf("/") === -1 && raw.indexOf("\\") === -1) {
            inp.value = IMAGES_DIR + "/" + raw;
            commitRowsToEntry();
            saveState(state);
            renderCarousel();
            afterEntryChange();
          }
        });
        fileInp.addEventListener("change", function () {
          const f = fileInp.files && fileInp.files[0];
          fileInp.value = "";
          if (!f || !isImageFile(f)) return;
          const base = safeImageBasename(f.name);
          if (!base) return;
          const rel = IMAGES_DIR + "/" + base;
          const oldB = row.dataset.blobUrl;
          if (oldB) {
            try {
              URL.revokeObjectURL(oldB);
            } catch (x) {
              /* ignore */
            }
            delete row.dataset.blobUrl;
          }
          inp.value = rel;
          const ent2 = getEntry();
          if (!ent2) return;
          while (ent2.images.length <= slideIdx) {
            ent2.images.push("");
          }
          ent2.images[slideIdx] = rel;
          while (ent2.images.length > 1 && !ent2.images[ent2.images.length - 1].trim()) {
            ent2.images.pop();
          }
          saveState(state);
          row.dataset.blobUrl = URL.createObjectURL(f);
          renderCarousel();
          afterEntryChange();
        });
        rm.addEventListener("click", function () {
          const ent2 = getEntry();
          if (!ent2) return;
          const si = slideIdx;
          if (ent2.images.length <= 1) {
            ent2.images = [];
          } else {
            ent2.images.splice(si, 1);
          }
          saveState(state);
          rebuildImageRows();
          const newN = entrySlideCount(ent2);
          let ci = getCarouselIndex();
          if (ci >= newN) ci = Math.max(0, newN - 1);
          setCarouselIndex(ci);
          renderCarousel();
          afterEntryChange();
        });
        imagesRows.appendChild(row);
      }
    }

    function afterEntryChange() {
      const ent = getEntry();
      if (ent) updateEntryPublicDisplay(el, ent, isStandalone, null);
      if (!isStandalone) {
        const section = grid.closest(".category");
        const cat = state.categories.find(function (c) {
          return c.id === categoryId;
        });
        if (section && cat) updateCategorySetDisplay(section, cat);
      }
      refreshThumbsForEntryGrid(grid, state);
    }

    function assignImageToCurrentSlide(file) {
      if (!file || !isImageFile(file)) return;
      const base = safeImageBasename(file.name);
      if (!base) return;
      const rel = IMAGES_DIR + "/" + base;
      const ent = getEntry();
      if (!ent) return;
      const idx = getCarouselIndex();
      if (ent.images.length === 0) {
        ent.images = [rel];
      } else if (idx >= 0 && idx < ent.images.length) {
        ent.images[idx] = rel;
      } else {
        ent.images.push(rel);
      }
      saveState(state);
      rebuildImageRows();
      const row = imagesRows.querySelector('.entry__image-row-item[data-img-index="' + idx + '"]');
      if (row) {
        const oldB = row.dataset.blobUrl;
        if (oldB) {
          try {
            URL.revokeObjectURL(oldB);
          } catch (x) {
            /* ignore */
          }
        }
        row.dataset.blobUrl = URL.createObjectURL(file);
        const inp = row.querySelector(".entry__url-per");
        if (inp) inp.value = rel;
      }
      renderCarousel();
      afterEntryChange();
    }

    rebuildImageRows();
    renderCarousel();

    if (btnAddView) {
      btnAddView.addEventListener("click", function () {
        const ent = getEntry();
        if (!ent) return;
        ent.images.push("");
        saveState(state);
        rebuildImageRows();
        setCarouselIndex(ent.images.length - 1);
        renderCarousel();
        afterEntryChange();
      });
    }

    if (btnPrev) {
      btnPrev.addEventListener("click", function (e) {
        e.stopPropagation();
        const ent = getEntry();
        const n = entrySlideCount(ent);
        setCarouselIndex(getCarouselIndex() - 1);
        if (getCarouselIndex() < 0) setCarouselIndex(n - 1);
        renderCarousel();
      });
    }
    if (btnNext) {
      btnNext.addEventListener("click", function (e) {
        e.stopPropagation();
        const ent = getEntry();
        const n = entrySlideCount(ent);
        setCarouselIndex(getCarouselIndex() + 1);
        if (getCarouselIndex() >= n) setCarouselIndex(0);
        renderCarousel();
      });
    }

    if (viewport) {
      viewport.addEventListener("click", function () {
        if (isUnlocked()) return;
        const ent = getEntry();
        if (!ent) return;
        const cat = isStandalone
          ? null
          : state.categories.find(function (c) {
              return c.id === categoryId;
            });
        openPreviewModal(ent, cat, state, getCarouselIndex());
      });
    }

    if (frame) {
      frame.addEventListener("dragenter", function (e) {
        if (!isUnlocked() || !dataTransferMayHaveFiles(e.dataTransfer)) return;
        e.preventDefault();
      });
      frame.addEventListener("dragover", function (e) {
        if (!isUnlocked() || !dataTransferMayHaveFiles(e.dataTransfer)) return;
        e.preventDefault();
        try {
          e.dataTransfer.dropEffect = "copy";
        } catch (err) {
          /* ignore */
        }
        frame.classList.add("entry__frame--drag");
      });
      frame.addEventListener("dragleave", function (e) {
        if (!isUnlocked()) return;
        const related = e.relatedTarget;
        if (related && frame.contains(related)) return;
        frame.classList.remove("entry__frame--drag");
      });
      frame.addEventListener("drop", function (e) {
        if (!isUnlocked()) return;
        e.preventDefault();
        frame.classList.remove("entry__frame--drag");
        const f = firstImageFileFromDataTransfer(e.dataTransfer);
        if (f) assignImageToCurrentSlide(f);
      });
    }

    const availNote = el.querySelector(".entry__availability-note");
    if (availNote) {
      availNote.addEventListener("input", function () {
        const ent = getEntry();
        if (ent) ent.availabilityNote = availNote.value;
        saveState(state);
        afterEntryChange();
      });
    }

    labelInput.addEventListener("input", function () {
      const ent = getEntry();
      if (ent) ent.label = labelInput.value;
      saveState(state);
      img.alt = labelInput.value.trim() || "Catalog image";
      afterEntryChange();
    });

    priceInput.addEventListener("input", function () {
      const ent = getEntry();
      if (ent) ent.price = parseMoney(priceInput.value);
      saveState(state);
      afterEntryChange();
    });

    if (!isStandalone && individual) {
      individual.addEventListener("change", function () {
        const ent = getEntry();
        if (ent) ent.individual = individual.checked;
        saveState(state);
        afterEntryChange();
      });
    }

    if (sold) {
      sold.addEventListener("change", function () {
        const ent = getEntry();
        if (ent) ent.sold = sold.checked === true;
        saveState(state);
        afterEntryChange();
      });
    }

    img.addEventListener("error", function () {
      img.hidden = true;
      if (placeholder) {
        placeholder.textContent =
          "Image failed to load — add this file to the images folder in your project, then refresh.";
      }
    });

    el.querySelector('[data-action="remove-entry"]').addEventListener("click", function () {
      if (isStandalone) {
        state.standalone = state.standalone.filter(function (e) {
          return e.id !== entryId;
        });
      } else {
        const cat = state.categories.find(function (c) {
          return c.id === categoryId;
        });
        if (cat) cat.entries = cat.entries.filter(function (e) {
          return e.id !== entryId;
        });
      }
      saveState(state);
      revokeEntryImageBlobs(el);
      el.remove();
      updateEmptyAndStandalone(state);
      if (!isStandalone) {
        const section = grid.closest(".category");
        const cat = state.categories.find(function (c) {
          return c.id === categoryId;
        });
        if (section && cat) updateCategorySetDisplay(section, cat);
      }
      refreshThumbsForEntryGrid(grid, state);
    });

    setEntryViewportTooltip(viewport);
  }

  function renderEntry(data, state, grid, isStandalone, categoryId) {
    const node = tplEntry.content.cloneNode(true).firstElementChild;
    node.dataset.entryId = data.id;
    const carousel = node.querySelector(".entry__carousel");
    if (carousel) carousel.dataset.carIndex = "0";
    node.querySelector(".entry__label").value = data.label || "";
    const price = parseMoney(data.price);
    const priceInput = node.querySelector(".entry__price");
    priceInput.value = price !== null ? String(price) : "";

    const availInput = node.querySelector(".entry__availability-note");
    if (availInput) availInput.value = data.availabilityNote || "";

    if (!isStandalone) {
      const ind = node.querySelector(".entry__individual");
      ind.checked = data.individual !== false;
    }
    const soldCb = node.querySelector(".entry__sold");
    if (soldCb) soldCb.checked = data.sold === true;

    updateEntryPublicDisplay(node, data, isStandalone, null);
    grid.appendChild(node);
    bindEntry(node, data.id, state, grid, isStandalone, categoryId);
    refreshThumbsForEntryGrid(grid, state);
  }

  function bindCategory(section, cat, state) {
    const titleInput = section.querySelector(".category__title-input");
    const setOffer = section.querySelector(".category__set-offer");
    const badge = section.querySelector(".category__badge");
    const grid = section.querySelector(".category__grid");
    const setPriceInput = section.querySelector(".category__set-price-input");

    titleInput.value = cat.title || "";
    setOffer.checked = !!cat.offerAsSet;
    const sp = parseMoney(cat.setPrice);
    if (setPriceInput) setPriceInput.value = sp !== null ? String(sp) : "";

    function syncSetBadge() {
      badge.hidden = !setOffer.checked;
    }
    syncSetBadge();
    updateCategorySetDisplay(section, cat);

    titleInput.addEventListener("input", function () {
      cat.title = titleInput.value;
      saveState(state);
    });

    setOffer.addEventListener("change", function () {
      cat.offerAsSet = setOffer.checked;
      saveState(state);
      syncSetBadge();
      updateCategorySetDisplay(section, cat);
    });

    if (setPriceInput) {
      setPriceInput.addEventListener("input", function () {
        cat.setPrice = parseMoney(setPriceInput.value);
        saveState(state);
        updateCategorySetDisplay(section, cat);
        refreshAllDisplays(state);
      });
    }

    section.querySelector('[data-action="remove-category"]').addEventListener("click", function () {
      state.categories = state.categories.filter(function (c) {
        return c.id !== cat.id;
      });
      saveState(state);
      section.remove();
      updateEmptyAndStandalone(state);
    });

    section.querySelector('[data-action="add-entry"]').addEventListener("click", function () {
      const entry = {
        id: uid(),
        images: [],
        label: "",
        individual: true,
        price: null,
        sold: false,
        availabilityNote: "",
      };
      cat.entries.push(entry);
      saveState(state);
      renderEntry(entry, state, grid, false, cat.id);
      updateEmptyAndStandalone(state);
    });

    cat.entries.forEach(function (e) {
      renderEntry(e, state, grid, false, cat.id);
    });

    section.querySelector('[data-action="toggle-category-collapse"]').addEventListener("click", function () {
      cat.collapsed = !cat.collapsed;
      saveState(state);
      applyCategoryCollapsed(section, cat, state);
    });
    applyCategoryCollapsed(section, cat, state);
  }

  function addCategory(state, preset) {
    const cat = preset || {
      id: uid(),
      title: "",
      offerAsSet: false,
      setPrice: null,
      collapsed: false,
      entries: [],
    };
    if (!preset) state.categories.push(cat);
    const section = tplCategory.content.cloneNode(true).firstElementChild;
    section.dataset.categoryId = cat.id;
    root.appendChild(section);
    bindCategory(section, cat, state);
    updateEmptyAndStandalone(state);
  }

  function addStandaloneEntry(state) {
    const entry = { id: uid(), images: [], label: "", price: null, sold: false, availabilityNote: "" };
    state.standalone.push(entry);
    saveState(state);
    renderEntry(entry, state, standaloneGrid, true, null);
    updateEmptyAndStandalone(state);
    standaloneSection.hidden = false;
  }

  function openModal() {
    if (importCatalogModal && !importCatalogModal.hidden) {
      closeImportCatalogModal();
    }
    if (instructionsModal && !instructionsModal.hidden) {
      closeInstructionsModal();
    }
    authModal.hidden = false;
    authError.hidden = true;
    authPassword.value = "";
    authPassword.focus();
  }

  function closeModal() {
    authModal.hidden = true;
  }

  function init() {
    loadStateWithBootstrap().then(function (state) {
      catalogState = state;

      state.categories.forEach(function (c) {
        addCategory(state, c);
      });
      state.standalone.forEach(function (e) {
        renderEntry(e, state, standaloneGrid, true, null);
      });

      updateEmptyAndStandalone(state);

    if (standaloneCollapseToggle) {
      standaloneCollapseToggle.addEventListener("click", function () {
        if (!state.standalone.length) return;
        state.ui.standaloneCollapsed = !state.ui.standaloneCollapsed;
        saveState(state);
        applyStandaloneCollapsed(state);
      });
    }

    applyLockUI();

    document.addEventListener("dragend", function () {
      document.querySelectorAll(".entry__frame--drag").forEach(function (node) {
        node.classList.remove("entry__frame--drag");
      });
    });

    btnAddCategory.addEventListener("click", function () {
      addCategory(state, null);
      saveState(state);
      const title = root.querySelector(".category:last-of-type .category__title-input");
      if (title) title.focus();
    });

    function onAddStandalone() {
      addStandaloneEntry(state);
    }
    btnAddStandalone.addEventListener("click", onAddStandalone);
    btnAddStandaloneFooter.addEventListener("click", onAddStandalone);

    btnUnlock.addEventListener("click", openModal);
    btnLock.addEventListener("click", function () {
      setUnlocked(false);
    });

    if (btnInstructions) {
      btnInstructions.addEventListener("click", openInstructionsModal);
    }
    if (instructionsModal) {
      instructionsModal.querySelectorAll("[data-close-instructions]").forEach(function (el) {
        el.addEventListener("click", closeInstructionsModal);
      });
    }

    if (btnCopyCatalogJson) {
      btnCopyCatalogJson.addEventListener("click", function () {
        copyCatalogJsonToClipboard();
      });
    }
    if (btnDownloadCatalogJson) {
      btnDownloadCatalogJson.addEventListener("click", function () {
        downloadCatalogJsonFile();
      });
    }
    if (btnImportCatalog) {
      btnImportCatalog.addEventListener("click", function () {
        openImportCatalogModal();
      });
    }
    if (btnLoadLatestFromSite) {
      btnLoadLatestFromSite.addEventListener("click", function () {
        if (!isUnlocked()) return;
        if (
          !window.confirm(
            "Replace the catalog in this browser with the latest catalog.json from this website? (Use this after someone else published, or if refresh still shows old data.)"
          )
        ) {
          return;
        }
        btnLoadLatestFromSite.disabled = true;
        loadCatalogJsonFromWebsite(function (err) {
          btnLoadLatestFromSite.disabled = false;
          if (err) {
            window.alert(
              "Could not load catalog.json from this site. If you are opening the page as a file (file://), open the published GitHub Pages URL instead, or use Import JSON with a downloaded catalog.json."
            );
            return;
          }
          window.location.reload();
        });
      });
    }
    if (importCatalogModal) {
      importCatalogModal.querySelectorAll("[data-close-import-catalog]").forEach(function (el) {
        el.addEventListener("click", closeImportCatalogModal);
      });
    }
    if (importCatalogFile) {
      importCatalogFile.addEventListener("change", function () {
        if (!isUnlocked()) return;
        const f = importCatalogFile.files && importCatalogFile.files[0];
        importCatalogFile.value = "";
        if (!f) return;
        importCatalogFromChosenFile(f);
      });
    }
    if (btnImportCatalogApply && importCatalogTextarea) {
      btnImportCatalogApply.addEventListener("click", function () {
        const raw = importCatalogTextarea.value.trim();
        if (!raw) {
          if (importCatalogError) {
            importCatalogError.textContent = "Paste JSON first.";
            importCatalogError.hidden = false;
          }
          return;
        }
        if (
          !window.confirm(
            "Replace the catalog in this browser with this data? Copy JSON first if you need a backup."
          )
        ) {
          return;
        }
        applyImportedCatalogJsonString(raw, function (err) {
          if (err) {
            if (importCatalogError) {
              importCatalogError.textContent =
                "That text is not valid catalog JSON. Copy from Copy JSON or from a catalog.json created by this app.";
              importCatalogError.hidden = false;
            }
            return;
          }
          closeImportCatalogModal();
          window.location.reload();
        });
      });
    }

    if (btnPublishGithub) {
      btnPublishGithub.addEventListener("click", function () {
        openPublishGithubModal();
      });
    }
    if (publishGithubModal) {
      publishGithubModal.querySelectorAll("[data-close-publish-github]").forEach(function (el) {
        el.addEventListener("click", closePublishGithubModal);
      });
    }
    if (btnPublishGithubApply) {
      btnPublishGithubApply.addEventListener("click", function () {
        if (!isUnlocked()) return;
        const owner = publishGithubOwner ? publishGithubOwner.value : "";
        const repo = publishGithubRepo ? publishGithubRepo.value : "";
        const path = publishGithubPath ? publishGithubPath.value : "catalog.json";
        const token = resolveGithubTokenForPublish();
        if (publishGithubError) {
          publishGithubError.hidden = true;
          publishGithubError.textContent = "";
        }
        if (!token) {
          if (publishGithubError) {
            publishGithubError.textContent = "Paste a GitHub token, or set GITHUB_PUBLISH_TOKEN in app.js, or use Remember after a successful publish.";
            publishGithubError.hidden = false;
          }
          return;
        }
        if (
          !window.confirm(
            "Update the website for everyone?\n\n" +
              "This only saves your catalog (prices and names) to the site. It does not charge money or take payment.\n\n" +
              "Click OK to continue."
          )
        ) {
          return;
        }
        btnPublishGithubApply.disabled = true;
        btnPublishGithubApply.textContent = "Publishing…";
        publishCatalogToGithub(owner, repo, path, token).then(function (res) {
          btnPublishGithubApply.disabled = false;
          btnPublishGithubApply.textContent = "Publish now";
          if (res && res.ok) {
            if (publishGithubRemember && publishGithubRemember.checked) {
              localStorage.setItem(LOCAL_GH_TOKEN, token);
            }
            closePublishGithubModal();
            window.alert("Done. Give it a minute, then refresh the page if you do not see the update yet.");
          } else {
            if (publishGithubError) {
              publishGithubError.textContent = (res && res.msg) || "Could not publish.";
              publishGithubError.hidden = false;
            }
          }
        });
      });
    }
    if (btnClearGithubToken) {
      btnClearGithubToken.addEventListener("click", function () {
        clearStoredGithubTokens();
        if (publishGithubError) {
          publishGithubError.hidden = true;
          publishGithubError.textContent = "";
        }
      });
    }

    authSubmit.addEventListener("click", function () {
      if (authPassword.value === ADMIN_PASSWORD) {
        setUnlocked(true);
        closeModal();
        authError.hidden = true;
      } else {
        authError.hidden = false;
        authPassword.select();
      }
    });

    authModal.querySelectorAll("[data-close-modal]").forEach(function (el) {
      el.addEventListener("click", closeModal);
    });

    authPassword.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") {
        ev.preventDefault();
        authSubmit.click();
      }
    });

    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") {
        if (previewModal && !previewModal.hidden) {
          closePreviewModal();
          return;
        }
        if (instructionsModal && !instructionsModal.hidden) {
          closeInstructionsModal();
          return;
        }
        if (importCatalogModal && !importCatalogModal.hidden) {
          closeImportCatalogModal();
          return;
        }
        if (publishGithubModal && !publishGithubModal.hidden) {
          closePublishGithubModal();
          return;
        }
        if (!authModal.hidden) closeModal();
        return;
      }
      if (previewModal && !previewModal.hidden) {
        if (ev.key === "ArrowLeft") {
          ev.preventDefault();
          stepPreviewSlide(-1);
        } else if (ev.key === "ArrowRight") {
          ev.preventDefault();
          stepPreviewSlide(1);
        }
      }
    });

    if (previewModal) {
      previewModal.querySelectorAll("[data-close-preview]").forEach(function (el) {
        el.addEventListener("click", closePreviewModal);
      });
    }

    if (previewModalPrev) {
      previewModalPrev.addEventListener("click", function (e) {
        e.stopPropagation();
        stepPreviewSlide(-1);
      });
    }
    if (previewModalNext) {
      previewModalNext.addEventListener("click", function (e) {
        e.stopPropagation();
        stepPreviewSlide(1);
      });
    }

    if (previewModalGoEdit) {
      previewModalGoEdit.addEventListener("click", function () {
        const ctx = previewContext;
        const st = catalogState;
        closePreviewModal();
        if (!ctx || !st) return;
        if (ctx.isStandalone) {
          st.ui.standaloneCollapsed = false;
          saveState(st);
          applyStandaloneCollapsed(st);
          const card = standaloneGrid.querySelector('.entry[data-entry-id="' + ctx.entryId + '"]');
          if (card) {
            card.scrollIntoView({ behavior: "smooth", block: "nearest" });
            if (isUnlocked()) {
              const price = card.querySelector(".entry__price");
              if (price) window.setTimeout(function () { price.focus(); }, 350);
            }
          }
        } else {
          const cat = st.categories.find(function (c) {
            return c.id === ctx.categoryId;
          });
          const section = root.querySelector('.category[data-category-id="' + ctx.categoryId + '"]');
          if (cat && section) {
            cat.collapsed = false;
            saveState(st);
            applyCategoryCollapsed(section, cat, st);
            const card = section.querySelector('.entry[data-entry-id="' + ctx.entryId + '"]');
            if (card) {
              card.scrollIntoView({ behavior: "smooth", block: "nearest" });
              if (isUnlocked()) {
                const price = card.querySelector(".entry__price");
                if (price) window.setTimeout(function () { price.focus(); }, 350);
              }
            }
          }
        }
      });
    }
    });
  }

  init();
})();
