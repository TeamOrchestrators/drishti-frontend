import {useEffect, useState} from "react";
import { getInitialTheme, updateBodyBackground } from "../index.js";
import {ThemeContext} from "./themeContextValue.js";

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    updateBodyBackground(theme);
    localStorage.setItem("drishti-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark: theme === "dark" }}>
      {children}
    </ThemeContext.Provider>
  );
}
