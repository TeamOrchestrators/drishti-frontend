import { colors } from "../../theme";

export const Skeleton = ({ className = "", style = {}, width, height }) => {
  return (
    <div
      className={`animate-pulse rounded ${className}`}
      style={{
        background: colors.border,
        opacity: 0.6,
        width,
        height,
        ...style,
      }}
    />
  );
};

export const TableSkeleton = ({ rows = 4, cols = 6 }) => {
  return (
    <div className="flex flex-col gap-3 py-2">
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex items-center justify-between gap-4 py-3"
          style={{ borderTop: `1px solid ${colors.borderSoft}` }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              height={16}
              className="flex-1"
              style={{ maxWidth: c === 0 ? "140px" : c === cols - 1 ? "70px" : "100px" }}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

export const CardSkeleton = ({ count = 3 }) => {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg p-5 flex flex-col gap-4"
          style={{ background: colors.panel, border: `1px solid ${colors.border}` }}
        >
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-2">
              <Skeleton width="180px" height="20px" />
              <Skeleton width="120px" height="14px" />
              <Skeleton width="220px" height="12px" />
            </div>
            <Skeleton width="80px" height="24px" className="rounded-full" />
          </div>
          <div
            className="grid grid-cols-3 gap-4 pt-3"
            style={{ borderTop: `1px solid ${colors.borderSoft}` }}
          >
            <Skeleton height="32px" />
            <Skeleton height="32px" />
            <Skeleton height="32px" />
          </div>
        </div>
      ))}
    </div>
  );
};

export const ListSkeleton = ({ rows = 4 }) => {
  return (
    <div className="flex flex-col gap-3 py-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between py-2.5 gap-3"
          style={{ borderBottom: `1px solid ${colors.borderSoft}` }}
        >
          <div className="flex flex-col gap-1.5 flex-1">
            <Skeleton width="45%" height="16px" />
            <Skeleton width="30%" height="12px" />
          </div>
          <Skeleton width="75px" height="24px" className="rounded-full" />
        </div>
      ))}
    </div>
  );
};

export const StatCardSkeleton = () => {
  return (
    <div
      className="rounded-lg p-5 flex flex-col gap-3"
      style={{ background: colors.panel, border: `1px solid ${colors.border}` }}
    >
      <div className="flex items-center justify-between">
        <Skeleton width="110px" height="16px" />
        <Skeleton width="18px" height="18px" className="rounded" />
      </div>
      <div className="flex items-baseline gap-1.5 my-0.5">
        <Skeleton width="48px" height="28px" />
      </div>
      <Skeleton width="130px" height="12px" />
    </div>
  );
};

export const OverviewSkeleton = () => {
  return (
    <div className="flex flex-col gap-5 sm:gap-6 animate-pulse">
      {/* Heading skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton width="180px" height="24px" />
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      {/* Expeditions & Personnel Movement Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Active expeditions panel */}
        <div className="lg:col-span-2">
          <div
            className="rounded-lg"
            style={{ background: colors.panel, border: `1px solid ${colors.border}` }}
          >
            <div
              className="flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4"
              style={{ borderBottom: `1px solid ${colors.borderSoft}` }}
            >
              <Skeleton width="140px" height="18px" />
              <Skeleton width="60px" height="14px" />
            </div>
            <div className="p-4 sm:p-5 flex flex-col gap-4">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-0"
                  style={{
                    borderBottom: i < 2 ? `1px solid ${colors.borderSoft}` : "none",
                  }}
                >
                  <div className="flex-1 flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <Skeleton width="130px" height="16px" />
                      <Skeleton width="55px" height="14px" />
                    </div>
                    <Skeleton width="170px" height="12px" />
                  </div>
                  <div className="flex items-center gap-3 justify-between sm:justify-start">
                    <div className="w-28 flex-1 sm:flex-none">
                      <Skeleton height="8px" className="rounded-full" />
                    </div>
                    <Skeleton width="70px" height="24px" className="rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Personnel movement panel */}
        <div
          className="rounded-lg"
          style={{ background: colors.panel, border: `1px solid ${colors.border}` }}
        >
          <div
            className="flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4"
            style={{ borderBottom: `1px solid ${colors.borderSoft}` }}
          >
            <Skeleton width="150px" height="18px" />
            <Skeleton width="60px" height="14px" />
          </div>
          <div className="p-4 sm:p-5 flex flex-col gap-3.5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                  <Skeleton width="105px" height="15px" />
                  <Skeleton width="125px" height="12px" />
                </div>
                <Skeleton width="75px" height="22px" className="rounded-full flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Inventory & Dispatch Batches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Critical inventory panel */}
        <div
          className="rounded-lg"
          style={{ background: colors.panel, border: `1px solid ${colors.border}` }}
        >
          <div
            className="flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4"
            style={{ borderBottom: `1px solid ${colors.borderSoft}` }}
          >
            <Skeleton width="130px" height="18px" />
            <Skeleton width="60px" height="14px" />
          </div>
          <div className="p-4 sm:p-5 flex flex-col gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton width="140px" height="15px" />
                  <Skeleton width="60px" height="14px" />
                </div>
                <Skeleton height="8px" className="rounded-full" />
                <Skeleton width="85px" height="11px" />
              </div>
            ))}
          </div>
        </div>

        {/* Active dispatch batches panel */}
        <div
          className="rounded-lg"
          style={{ background: colors.panel, border: `1px solid ${colors.border}` }}
        >
          <div
            className="flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4"
            style={{ borderBottom: `1px solid ${colors.borderSoft}` }}
          >
            <Skeleton width="170px" height="18px" />
            <Skeleton width="60px" height="14px" />
          </div>
          <div className="p-4 sm:p-5 flex flex-col gap-3.5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                  <Skeleton width="90px" height="15px" />
                  <Skeleton width="140px" height="12px" />
                </div>
                <Skeleton width="75px" height="22px" className="rounded-full flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Skeleton;
