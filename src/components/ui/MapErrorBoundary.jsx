import React from "react";
import {AlertCircle, RefreshCw} from "lucide-react";
import {colors} from "../../theme";

export class MapErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {hasError: false, error: null};
  }

  static getDerivedStateFromError(error) {
    return {hasError: true, error};
  }

  componentDidCatch(error, errorInfo) {
    console.error("Map render caught by boundary:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({hasError: false, error: null});
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="rounded-lg p-4 text-xs flex flex-col items-center justify-center text-center gap-2 my-2"
          style={{
            background: colors.panelAlt,
            color: colors.textMuted,
            border: `1px solid ${colors.border}`,
          }}
        >
          <AlertCircle size={20} style={{color: colors.amber}}/>
          <div className="font-semibold text-xs" style={{color: colors.text}}>
            Interactive Map Temporarily Unavailable
          </div>
          <div className="text-[11px] max-w-sm" style={{color: colors.textFaint}}>
            {this.state.error?.message || "Could not initialize graphics surface for this map."}
          </div>
          <button
            type="button"
            onClick={this.handleRetry}
            className="mt-1 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded cursor-pointer transition-opacity hover:opacity-85"
            style={{
              background: colors.panel,
              color: colors.text,
              border: `1px solid ${colors.border}`,
            }}
          >
            <RefreshCw size={12}/>
            <span>Reload map</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default MapErrorBoundary;
