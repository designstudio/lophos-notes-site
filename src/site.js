const changelogSources = [
  "https://raw.githubusercontent.com/designstudio/lumina-notes/main/CHANGELOG.md",
  "https://raw.githubusercontent.com/designstudio/lumina-notes/main/changelog.md",
  "https://raw.githubusercontent.com/designstudio/lumina-notes/master/CHANGELOG.md",
  "https://raw.githubusercontent.com/designstudio/lumina-notes/master/changelog.md",
];

function setupPageBehavior() {
  const pageKind = document.body.dataset.pageKind;
  document.body.style.overflow = pageKind === "home" ? "hidden" : "auto";
}

function setupCarousel() {
  const carousel = document.querySelector("[data-carousel]");
  if (!carousel) return;

  const stage = carousel.querySelector(".carousel-stage");
  const slides = [...carousel.querySelectorAll("[data-slide]")];
  const dots = [...carousel.querySelectorAll(".carousel-dot")];

  if (!stage || slides.length < 2 || slides.length !== dots.length) return;

  let activeIndex = 0;
  let incomingIndex = null;
  let pointerId = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragDeltaX = 0;
  let dragLocked = false;

  const getWrappedIndex = (index) => {
    if (index < 0) return slides.length - 1;
    if (index >= slides.length) return 0;
    return index;
  };

  const setActive = (nextIndex) => {
    if (incomingIndex !== null) return;

    const wrappedIndex = getWrappedIndex(nextIndex);
    if (wrappedIndex === activeIndex) return;

    const current = slides[activeIndex];
    const next = slides[wrappedIndex];

    incomingIndex = wrappedIndex;
    current.className = "carousel-figure is-exiting";
    next.className = "carousel-figure is-entering";
    next.setAttribute("aria-hidden", "false");
    dots.forEach((dot, index) => {
      const isActive = index === wrappedIndex;
      dot.className = isActive ? "carousel-dot is-active" : "carousel-dot";
      dot.setAttribute("aria-pressed", String(isActive));
    });

    window.setTimeout(() => {
      current.className = "carousel-figure";
      current.setAttribute("aria-hidden", "true");
      next.className = "carousel-figure is-active";
      activeIndex = wrappedIndex;
      incomingIndex = null;
    }, 320);
  };

  const resetDrag = () => {
    pointerId = null;
    dragStartX = 0;
    dragStartY = 0;
    dragDeltaX = 0;
    dragLocked = false;
    stage.classList.remove("is-dragging");
  };

  const handleSwipeEnd = () => {
    const threshold = Math.min(96, stage.clientWidth * 0.12);

    if (Math.abs(dragDeltaX) >= threshold) {
      setActive(activeIndex + (dragDeltaX < 0 ? 1 : -1));
    }

    resetDrag();
  };

  dots.forEach((dot, index) => {
    dot.addEventListener("click", () => setActive(index));
  });

  stage.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || incomingIndex !== null) return;

    pointerId = event.pointerId;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    dragDeltaX = 0;
    dragLocked = false;
    stage.classList.add("is-dragging");
    stage.setPointerCapture(event.pointerId);
  });

  stage.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pointerId || dragLocked) return;

    const deltaX = event.clientX - dragStartX;
    const deltaY = event.clientY - dragStartY;

    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
      dragLocked = true;
      resetDrag();
      return;
    }

    dragDeltaX = deltaX;
  });

  stage.addEventListener("pointerup", (event) => {
    if (event.pointerId !== pointerId) return;
    handleSwipeEnd();
  });

  stage.addEventListener("pointercancel", (event) => {
    if (event.pointerId !== pointerId) return;
    resetDrag();
  });

  stage.addEventListener("lostpointercapture", () => {
    if (pointerId === null) return;
    resetDrag();
  });
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderInlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a class="inline-link" href="$2">$1</a>')
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function normalizeInline(text) {
  return text.replace(/\*\*(.*?)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1").trim();
}

function createCodeBlockMarkup(code, language = "") {
  const normalizedLanguage = language.trim().toLowerCase();
  const languageLabel = normalizedLanguage ? `<div class="code-block-label">${escapeHtml(normalizedLanguage)}</div>` : "";

  return `
    <div class="code-block">
      ${languageLabel}
      <pre><code>${escapeHtml(code)}</code></pre>
    </div>
  `;
}

function parseChangelog(markdown) {
  const lines = markdown.split(/\r?\n/);
  const parsed = {
    title: "Lumina Release Notes",
    releases: [],
  };

  let currentRelease = null;
  let currentSection = null;

  const getTargetContent = () => {
    if (currentSection) return currentSection.content;
    if (currentRelease) return currentRelease.content;
    return null;
  };

  const appendParagraph = (text) => {
    const target = getTargetContent();
    if (!target) return;
    target.push({ type: "paragraph", value: renderInlineMarkdown(text) });
  };

  const appendBullet = (text) => {
    const target = getTargetContent();
    if (!target) return;

    const lastItem = target[target.length - 1];
    if (lastItem?.type === "bullets") {
      lastItem.items.push(renderInlineMarkdown(text));
      return;
    }

    target.push({ type: "bullets", items: [renderInlineMarkdown(text)] });
  };

  const appendCodeBlock = (code, language = "") => {
    const target = getTargetContent();
    if (!target) return;
    target.push({ type: "code", value: code, language });
  };

  const ensureSection = (title = "") => {
    if (!currentRelease) return null;

    if (!currentSection || currentSection.title !== title) {
      currentSection = {
        title,
        content: [],
      };
      currentRelease.sections.push(currentSection);
    }

    return currentSection;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("# ")) {
      parsed.title = normalizeInline(line.slice(2)) || parsed.title;
      continue;
    }

    if (line.startsWith("## ")) {
      currentRelease = {
        date: normalizeInline(line.slice(3)),
        title: "",
        content: [],
        sections: [],
      };
      parsed.releases.push(currentRelease);
      currentSection = null;
      continue;
    }

    if (!currentRelease) continue;

    if (line.startsWith("### ")) {
      ensureSection(normalizeInline(line.slice(4)));
      continue;
    }

    if (line.startsWith("```")) {
      const language = line.slice(3).trim();
      const codeLines = [];

      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }

      appendCodeBlock(codeLines.join("\n"), language);
      continue;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      appendBullet(line.slice(2).trim());
      continue;
    }

    if (!currentRelease.title) {
      currentRelease.title = renderInlineMarkdown(line);
      continue;
    }

    appendParagraph(line);
  }

  return parsed;
}

function renderContentBlocks(content) {
  return content
    .map((item) => {
      if (item.type === "paragraph") return `<p>${item.value}</p>`;
      if (item.type === "bullets") return `<ul>${item.items.map((entry) => `<li>${entry}</li>`).join("")}</ul>`;
      if (item.type === "code") return createCodeBlockMarkup(item.value, item.language);
      return "";
    })
    .join("");
}

function renderChangelog(markdown, root, fallbackUrl) {
  const parsed = parseChangelog(markdown);

  const releasesMarkup = parsed.releases
    .map((release) => {
      const introContent = renderContentBlocks(release.content);

      const sectionsMarkup = release.sections
        .map((section) => {
          return `
            <section class="release-note-section">
              ${section.title ? `<h3>${section.title}</h3>` : ""}
              ${renderContentBlocks(section.content)}
            </section>
          `;
        })
        .join("");

      return `
        <article class="release-note-entry">
          <div class="release-note-date">${release.date}</div>
          <div class="release-note-body">
            ${release.title ? `<h2>${release.title}</h2>` : ""}
            ${introContent}
            ${sectionsMarkup}
          </div>
        </article>
      `;
    })
    .join("");

  root.innerHTML = `
    <section class="release-notes">
      <div class="release-notes-header">
        <h1>${parsed.title}</h1>
      </div>
      <div class="release-notes-list">
        ${releasesMarkup}
      </div>
      <p class="release-notes-footer"><a class="inline-link" href="${fallbackUrl}">Open on GitHub</a></p>
    </section>
  `;
}

function renderChangelogError(root, fallbackUrl) {
  root.innerHTML = `
    <section class="release-notes">
      <div class="release-notes-header">
        <h1>Lumina Release Notes</h1>
      </div>
      <div class="changelog-state">
        <h2>Could not load the changelog.</h2>
        <p>The GitHub file could not be fetched right now. You can still read the release notes on GitHub.</p>
        <a class="inline-link" href="${fallbackUrl}">Open changelog on GitHub</a>
      </div>
    </section>
  `;
}

async function setupChangelog() {
  const root = document.querySelector("[data-changelog-root]");
  if (!root) return;

  const fallbackUrl = root.dataset.fallbackUrl || "https://github.com/designstudio/lumina-notes/blob/main/CHANGELOG.md";

  for (const source of changelogSources) {
    try {
      const response = await fetch(source, { cache: "no-store" });
      if (!response.ok) continue;

      const markdown = await response.text();
      if (!markdown.trim()) continue;

      renderChangelog(markdown, root, fallbackUrl);
      return;
    } catch {
      continue;
    }
  }

  renderChangelogError(root, fallbackUrl);
}

setupPageBehavior();
setupCarousel();
setupChangelog();
