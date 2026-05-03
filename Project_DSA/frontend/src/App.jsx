import { useEffect, useState } from "react";

import AuthPage from "./pages/AuthPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import ResultsPage from "./pages/ResultsPage.jsx";
import {
  analyzeAgreement,
  clearStoredToken,
  deleteSavedAnalysis,
  extractDocumentText,
  getCurrentUser,
  getSavedAnalysis,
  getStoredToken,
  listHistory,
  login,
  renameSavedAnalysis,
  saveAnalysis,
  setStoredToken,
  signup,
  updatePreferences,
} from "./services/api.js";

export default function App() {
  const [inputText, setInputText] = useState("");
  const [documentName, setDocumentName] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState("");
  const [authError, setAuthError] = useState("");
  const [token, setToken] = useState(getStoredToken());
  const [user, setUser] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);
  const [view, setView] = useState("home");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setHistoryItems([]);
      return;
    }

    let ignore = false;
    async function loadAccount() {
      try {
        const profile = await getCurrentUser(token);
        const saved = await listHistory(token);
        if (!ignore) {
          setUser(profile);
          setHistoryItems(saved);
          setAuthError("");
        }
      } catch (err) {
        if (!ignore) {
          clearStoredToken();
          setToken("");
          setUser(null);
          setHistoryItems([]);
          setAuthError(err.message);
        }
      }
    }

    loadAccount();
    return () => {
      ignore = true;
    };
  }, [token]);

  async function handleDocumentSelected(fileOrFiles) {
    const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
    const fallbackName = formatSelectedFileNames(files);

    setError("");
    setDocumentName(fallbackName);
    setIsExtracting(true);

    try {
      const result = await extractDocumentText(files);
      setInputText(result.text);
      setDocumentName(result.file_name || fallbackName);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsExtracting(false);
    }
  }

  async function handleAnalyze() {
    setError("");

    if (inputText.trim().length < 20) {
      setError("Paste agreement text or upload a supported document before analyzing.");
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await analyzeAgreement({
        text: inputText,
        document_name: documentName || "Pasted agreement",
        preferences: user?.preferences,
      });
      setAnalysis(result);
      setView("home");
      setSaveMessage("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleReset() {
    setAnalysis(null);
    setView("home");
    setError("");
  }

  function handleStartOver() {
    setInputText("");
    setDocumentName("");
    setAnalysis(null);
    setView("home");
    setError("");
    setSaveMessage("");
  }

  async function handleSignup(payload) {
    setAuthError("");
    try {
      const result = await signup(payload);
      setStoredToken(result.token);
      setToken(result.token);
      setUser(result.user);
    } catch (err) {
      setAuthError(err.message);
    }
  }

  async function handleLogin(payload) {
    setAuthError("");
    try {
      const result = await login(payload);
      setStoredToken(result.token);
      setToken(result.token);
      setUser(result.user);
    } catch (err) {
      setAuthError(err.message);
    }
  }

  function handleLogout() {
    clearStoredToken();
    setToken("");
    setUser(null);
    setHistoryItems([]);
    setAuthError("");
  }

  async function refreshHistory(activeToken = token) {
    if (!activeToken) {
      return;
    }
    const saved = await listHistory(activeToken);
    setHistoryItems(saved);
  }

  async function handleUpdatePreferences(preferences) {
    if (!token) {
      return;
    }

    try {
      const updatedUser = await updatePreferences(token, preferences);
      setUser(updatedUser);
    } catch (err) {
      setAuthError(err.message);
    }
  }

  async function handleSaveCurrentAnalysis() {
    if (!token || !analysis) {
      return;
    }

    setIsSaving(true);
    setSaveMessage("");
    try {
      const saved = await saveAnalysis(token, {
        analysis,
        document_name: analysis.document_name || documentName || "Untitled agreement",
      });
      setSaveMessage(`Saved as "${saved.document_name}".`);
      await refreshHistory();
    } catch (err) {
      setSaveMessage(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleOpenSaved(id) {
    if (!token) {
      return;
    }

    try {
      const saved = await getSavedAnalysis(token, id);
      setAnalysis(saved.analysis);
      setDocumentName(saved.document_name);
      setView("home");
      setSaveMessage("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setAuthError(err.message);
    }
  }

  async function handleRenameSaved(id, newName) {
    if (!token || !newName.trim()) {
      return;
    }

    try {
      await renameSavedAnalysis(token, id, newName.trim());
      await refreshHistory();
    } catch (err) {
      setAuthError(err.message);
    }
  }

  async function handleDeleteSaved(id) {
    if (!token) {
      return;
    }

    try {
      await deleteSavedAnalysis(token, id);
      await refreshHistory();
    } catch (err) {
      setAuthError(err.message);
    }
  }

  function handleOpenAccount() {
    setAuthError("");
    setView("auth");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleCloseAccount() {
    setView("home");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (view === "auth") {
    return (
      <AuthPage
        user={user}
        authError={authError}
        historyItems={historyItems}
        hasAnalysis={Boolean(analysis)}
        onBack={handleCloseAccount}
        onLogin={handleLogin}
        onSignup={handleSignup}
        onLogout={handleLogout}
        onOpenSaved={handleOpenSaved}
        onRenameSaved={handleRenameSaved}
        onDeleteSaved={handleDeleteSaved}
        onUpdatePreferences={handleUpdatePreferences}
      />
    );
  }

  if (analysis) {
    return (
      <ResultsPage
        analysis={analysis}
        user={user}
        isSaving={isSaving}
        saveMessage={saveMessage}
        onEditInput={handleReset}
        onStartOver={handleStartOver}
        onSaveAnalysis={handleSaveCurrentAnalysis}
        onOpenAccount={handleOpenAccount}
      />
    );
  }

  return (
    <HomePage
      inputText={inputText}
      documentName={documentName}
      error={error}
      isExtracting={isExtracting}
      isAnalyzing={isAnalyzing}
      onTextChange={setInputText}
      onDocumentNameChange={setDocumentName}
      onDocumentSelected={handleDocumentSelected}
      onAnalyze={handleAnalyze}
      user={user}
      onOpenAccount={handleOpenAccount}
    />
  );
}

function formatSelectedFileNames(files) {
  if (files.length === 0) {
    return "";
  }

  if (files.length === 1) {
    return files[0].name;
  }

  return `${files[0].name} + ${files.length - 1} more`;
}
