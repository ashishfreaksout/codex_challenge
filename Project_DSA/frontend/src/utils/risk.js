export const severityClasses = {
  Low: "bg-teal-50 text-teal-800 border border-teal-200",
  Medium: "bg-amber-50 text-amber-800 border border-amber-200",
  High: "bg-red-50 text-red-800 border border-red-200",
};

export function riskColorClasses(level) {
  if (level === "High") {
    return {
      badge: "bg-red-50 text-red-800 border border-red-200",
      bar: "bg-red-600",
    };
  }

  if (level === "Medium") {
    return {
      badge: "bg-amber-50 text-amber-800 border border-amber-200",
      bar: "bg-amber-500",
    };
  }

  return {
    badge: "bg-teal-50 text-teal-800 border border-teal-200",
    bar: "bg-teal-600",
  };
}
