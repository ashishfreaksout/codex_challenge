export default function BrandLogo({ size = "md", className = "" }) {
  const sizeClass = size === "sm" ? "h-10 w-10" : "h-12 w-12";

  return (
    <div className={`brand-mark ${sizeClass} ${className}`} aria-hidden="true">
      <svg viewBox="0 0 48 48" className="h-full w-full" role="img">
        <path
          className="brand-shield"
          d="M24 8.75 35.5 12.9v9.45c0 7.6-4.45 13.4-11.5 16.9-7.05-3.5-11.5-9.3-11.5-16.9V12.9L24 8.75Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
        />
        <path
          className="brand-check"
          d="m18.65 24.2 4.1 4.15 7.9-9.1"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
        />
        <path
          className="brand-line"
          d="M16.7 33.1h14.6"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2.25"
        />
      </svg>
    </div>
  );
}
