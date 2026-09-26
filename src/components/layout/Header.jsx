import {colors, font, mono} from "../../theme.js";
import { Clock, Radio, Sun, Moon, Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "../../context/ThemeContext";

const Header = ({ onMenuClick }) => {
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
      className="flex items-center justify-between px-4 sm:px-7 py-3 sm:py-4 transition-colors gap-3"
      style={{ borderBottom: `1px solid ${colors.border}` }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          className="md:hidden p-1.5 rounded-md cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
          style={{
            color: colors.text,
            background: colors.panelAlt,
            border: `1px solid ${colors.border}`,
          }}
          aria-label="Open navigation menu"
        >
          <Menu size={18} />
        </button>
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate" style={{ color: colors.text }}>
            Bharati
          </div>
          <div className="text-xs truncate hidden sm:block" style={{ color: colors.textFaint }}>
            Research & Operations center in Antarctica
          </div>
        </div>
      </div>
      <div
        className="flex items-center gap-2 sm:gap-4 md:gap-5 text-sm flex-shrink-0"
        style={{ color: colors.textMuted, ...font }}
      >
        <span className="flex items-center gap-1.5">
          <Clock size={13} />
          {antarcticaString}
        </span>
        <span className="hidden lg:flex items-center gap-1.5">
          <Radio size={13} color={colors.aurora} /> All systems normal
        </span>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          title={`Switch to ${isDark ? "light" : "dark"} mode`}
          aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
          className="flex items-center gap-1.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-full cursor-pointer transition-all hover:opacity-90 active:scale-95"
          style={{
            background: "transparent",
            color: colors.text,
            border: `1px solid ${colors.border}`,
          }}
        >
          {isDark ?
            <Sun size={15} color={colors.amber} />
          : <Moon size={15} color={colors.ice} />
          }
        </button>
      </div>
    </header>
  );
};

export default Header;
