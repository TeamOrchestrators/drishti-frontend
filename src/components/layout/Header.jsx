import {colors, mono} from "../../theme.js";
import { Clock, Radio } from "lucide-react";
import {useEffect, useState} from "react";

const Header = () => {
  const [time, setTime] = useState(new Date());
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
    <header className="flex items-center justify-between px-7 py-4" style={{ borderBottom: `1px solid ${colors.border}` }}>
      <div>
        <div className="text-sm font-semibold" style={{ color: colors.text }}>
          Bharati
        </div>
        <div className="text-xs" style={{ color: colors.textFaint }}>Research & Operations center in Antarctica</div>
      </div>
      <div className="flex items-center gap-5 text-xs" style={{ color: colors.textMuted, ...mono }}>
        <span className="flex items-center gap-1.5"><Clock size={13} />{antarcticaString}</span>
        <span>-42°C</span>
        <span>Wind 38 mph</span>
        <span className="flex items-center gap-1.5"><Radio size={13} color={colors.aurora} /> All systems normal</span>
      </div>
    </header>

  )
}

export default Header;