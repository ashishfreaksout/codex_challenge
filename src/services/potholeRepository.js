import { fetchSanJose311Potholes } from "./sanJose311Api";

let remotePotholes = [];
let localReports = [];
const listeners = new Set();

let hasHydrated = false;

export function subscribeToPotholes(listener) {
  listeners.add(listener);
  listener(currentSnapshot());

  if (!hasHydrated) {
    hasHydrated = true;
    hydrateFromSanJose311();
  }

  return () => {
    listeners.delete(listener);
  };
}

export function createPotholeReport({ coordinate, severity, notes }) {
  const report = {
    id: `local-${Date.now()}`,
    source: "Local report",
    title: "New pothole report",
    status: "reported",
    severity,
    notes: notes.trim(),
    address: "Current GPS location",
    requestedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    coordinate: {
      latitude: coordinate.latitude,
      longitude: coordinate.longitude
    },
    raw: {
      firestoreCollection: "potholeReports",
      syncStatus: "pending"
    }
  };

  localReports = [report, ...localReports];
  notify();
  return report;
}

async function hydrateFromSanJose311() {
  remotePotholes = await fetchSanJose311Potholes();
  notify();
}

function currentSnapshot() {
  return [...localReports, ...remotePotholes];
}

function notify() {
  const snapshot = currentSnapshot();
  listeners.forEach((listener) => listener(snapshot));
}

// Firestore can replace this file with the same interface:
// subscribeToPotholes(listener) => onSnapshot(collection(db, "potholeReports"), ...)
// createPotholeReport(report) => addDoc(collection(db, "potholeReports"), report)
