import { colors, mono } from "../../theme.js";
import { Clock, Radio, Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "../../context/ThemeContext";

const Header = () => {
  const [time, setTime] = useState(new Date());
  const { theme, toggleTheme, isDark } = useTheme();

  useEffect(() => {
    const timerId = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timerId);
  }, []);

  const antarcticaString = time.toLocaleTimeString("en-US", {
    timeZone: "Asia/Karachi",
  });

  return (
    <header
      className="flex items-center justify-between px-7 py-4 transition-colors"
      style={{ borderBottom: `1px solid ${colors.border}` }}
    >
      <div>
        <div className="text-sm font-semibold" style={{ color: colors.text }}>
          Bharati
        </div>
        <div className="text-xs" style={{ color: colors.textFaint }}>
          Research & Operations center in Antarctica
        </div>
      </div>
      <div
        className="flex items-center gap-5 text-xs"
        style={{ color: colors.textMuted, ...mono }}
      >
        <span className="flex items-center gap-1.5">
          <Clock size={13} />
          {antarcticaString}
        </span>
        <span>-42°C</span>
        <span>Wind 38 mph</span>
        <span className="flex items-center gap-1.5">
          <Radio size={13} color={colors.aurora} /> All systems normal
        </span>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          title={`Switch to ${isDark ? "light" : "dark"} mode`}
          aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full cursor-pointer transition-all hover:opacity-90 active:scale-95"
          style={{
            background: "transparent",
            color: colors.text,
            border: `1px solid ${colors.border}`,
          }}
        >
          {isDark ?
            <>
              <Sun size={15} color={colors.amber} />
            </>
          : <>
              <Moon size={15} color={colors.ice} />
            </>
          }
        </button>
      </div>
    </header>
  );
};

export default Header;
