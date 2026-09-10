/**
 * Synchronizes index.html body background and theme attributes on theme changes.
 */

const THEME_STORAGE_KEY = "drishti-theme";

export const themeColors = {
  dark: "#0A0E15",
  light: "#F1F5F9",
};

/**
 * Resolves the initial theme from localStorage or system preference.
 */
export function getInitialTheme() {
  if (typeof window === "undefined") return "dark";
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === "light" || saved === "dark") {
    return saved;
  }
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/**
 * Updates the documentElement data-theme attribute and index.html body background.
 * @param {"light" | "dark"} theme
 */
export function updateBodyBackground(theme) {
  if (typeof document === "undefined") return;

  const activeTheme = theme === "light" ? "light" : "dark";
  const bgColor = themeColors[activeTheme];

  document.documentElement.setAttribute("data-theme", activeTheme);

  if (document.body) {
    document.body.style.backgroundColor = bgColor;
  }
}

// Apply initial theme immediately to prevent flashing on page load
if (typeof window !== "undefined") {
  const initialTheme = getInitialTheme();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      updateBodyBackground(initialTheme);
    });
  } else {
    updateBodyBackground(initialTheme);
  }

  // Observe data-theme changes on documentElement so body background stays in sync
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes" && mutation.attributeName === "data-theme") {
        const currentTheme = document.documentElement.getAttribute("data-theme") || "dark";
        const bgColor = themeColors[currentTheme] || themeColors.dark;
        if (document.body && document.body.style.backgroundColor !== bgColor) {
          document.body.style.backgroundColor = bgColor;
        }
      }
    }
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
}
