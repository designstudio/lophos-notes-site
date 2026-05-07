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

  const slides = [...carousel.querySelectorAll("[data-slide]")];
  const dots = [...carousel.querySelectorAll(".carousel-dot")];

  if (slides.length < 2 || slides.length !== dots.length) return;

  let activeIndex = 0;
  let incomingIndex = null;

  const setActive = (nextIndex) => {
    if (nextIndex === activeIndex || incomingIndex !== null || nextIndex < 0 || nextIndex >= slides.length) return;

    const current = slides[activeIndex];
    const next = slides[nextIndex];

    incomingIndex = nextIndex;
    current.className = "carousel-figure is-exiting";
    next.className = "carousel-figure is-entering";
    next.setAttribute("aria-hidden", "false");
    dots.forEach((dot, index) => {
      const isActive = index === nextIndex;
      dot.className = isActive ? "carousel-dot is-active" : "carousel-dot";
      dot.setAttribute("aria-pressed", String(isActive));
    });

    window.setTimeout(() => {
      current.className = "carousel-figure";
      current.setAttribute("aria-hidden", "true");
      next.className = "carousel-figure is-active";
      activeIndex = nextIndex;
      incomingIndex = null;
    }, 320);
  };

  dots.forEach((dot, index) => {
    dot.addEventListener("click", () => setActive(index));
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

function parseChangelog(markdown) {
  const lines = markdown.split(/\r?\n/);
  const parsed = {
    title: "Lumina Release Notes",
    releases: [],
  };

  let currentRelease = null;
  let currentSection = null;

  const ensureSection = (title = "") => {
    if (!currentRelease) return null;

    if (!currentSection || currentSection.title !== title) {
      currentSection = {
        title,
        paragraphs: [],
        bullets: [],
      };
      currentRelease.sections.push(currentSection);
    }

    return currentSection;
  };

  for (const rawLine of lines) {
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
        paragraphs: [],
        bullets: [],
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

    if (line.startsWith("- ") || line.startsWith("* ")) {
      const value = renderInlineMarkdown(line.slice(2).trim());

      if (currentSection) {
        currentSection.bullets.push(value);
      } else {
        currentRelease.bullets.push(value);
      }
      continue;
    }

    if (!currentRelease.title) {
      currentRelease.title = renderInlineMarkdown(line);
      continue;
    }

    if (currentSection) {
      currentSection.paragraphs.push(renderInlineMarkdown(line));
    } else {
      currentRelease.paragraphs.push(renderInlineMarkdown(line));
    }
  }

  return parsed;
}

function renderChangelog(markdown, root, fallbackUrl) {
  const parsed = parseChangelog(markdown);

  const releasesMarkup = parsed.releases
    .map((release) => {
      const introParagraphs = release.paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("");
      const introBullets = release.bullets.length
        ? `<ul>${release.bullets.map((item) => `<li>${item}</li>`).join("")}</ul>`
        : "";

      const sectionsMarkup = release.sections
        .map((section) => {
          const sectionParagraphs = section.paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("");
          const sectionBullets = section.bullets.length
            ? `<ul>${section.bullets.map((item) => `<li>${item}</li>`).join("")}</ul>`
            : "";

          return `
            <section class="release-note-section">
              ${section.title ? `<h3>${section.title}</h3>` : ""}
              ${sectionParagraphs}
              ${sectionBullets}
            </section>
          `;
        })
        .join("");

      return `
        <article class="release-note-entry">
          <div class="release-note-date">${release.date}</div>
          <div class="release-note-body">
            ${release.title ? `<h2>${release.title}</h2>` : ""}
            ${introParagraphs}
            ${introBullets}
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
