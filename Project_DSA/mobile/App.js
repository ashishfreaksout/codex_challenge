import { StatusBar } from "expo-status-bar";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  analyzeAgreement,
  deleteSavedAnalysis,
  extractDocumentText,
  getCurrentUser,
  getDefaultApiBaseUrl,
  getSavedAnalysis,
  listHistory,
  login,
  saveAnalysis,
  signup,
  updatePreferences,
} from "./src/services/api";

const TOKEN_KEY = "dont-sign-anything-mobile-token";

const supportedDocumentTypes = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.text",
  "application/rtf",
  "text/rtf",
  "text/plain",
  "text/markdown",
  "image/*",
];

const preferenceOptions = [
  ["privacy", "Privacy"],
  ["hidden_fees", "Hidden fees"],
  ["employment_restrictions", "Employment restrictions"],
  ["cancellation_refunds", "Cancellation/refunds"],
];

export default function App() {
  const [screen, setScreen] = useState("review");
  const [apiBaseUrl, setApiBaseUrl] = useState(getDefaultApiBaseUrl());
  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);
  const [documentName, setDocumentName] = useState("");
  const [inputText, setInputText] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function loadStoredSession() {
      const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!ignore && storedToken) {
        setToken(storedToken);
      }
    }
    loadStoredSession();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setHistoryItems([]);
      return;
    }

    let ignore = false;
    async function loadAccount() {
      try {
        const profile = await getCurrentUser(apiBaseUrl, token);
        const saved = await listHistory(apiBaseUrl, token);
        if (!ignore) {
          setUser(profile);
          setHistoryItems(saved);
          setError("");
        }
      } catch (err) {
        if (!ignore) {
          await SecureStore.deleteItemAsync(TOKEN_KEY);
          setToken("");
          setUser(null);
          setHistoryItems([]);
          setError(err.message);
        }
      }
    }

    loadAccount();
    return () => {
      ignore = true;
    };
  }, [apiBaseUrl, token]);

  const canAnalyze = inputText.trim().length >= 20 && !isBusy;

  async function handlePickDocuments() {
    setError("");
    setStatusMessage("");

    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: true,
        type: supportedDocumentTypes,
      });

      if (result.canceled) {
        return;
      }

      await extractSelectedFiles(result.assets.map(normalizeDocumentAsset));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handlePickImages() {
    setError("");
    setStatusMessage("");

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Photo library permission is needed to select scanned pages.");
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsMultipleSelection: true,
        quality: 0.9,
      });

      if (result.canceled) {
        return;
      }

      await extractSelectedFiles(result.assets.map(normalizeImageAsset));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleScanWithCamera() {
    setError("");
    setStatusMessage("");

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError("Camera permission is needed to scan a paper document.");
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.9,
      });

      if (result.canceled) {
        return;
      }

      await extractSelectedFiles(result.assets.map(normalizeImageAsset));
    } catch (err) {
      setError(err.message);
    }
  }

  async function extractSelectedFiles(files) {
    if (!files.length) {
      return;
    }

    setIsBusy(true);
    setDocumentName(formatFileNames(files));
    try {
      const extracted = await extractDocumentText(apiBaseUrl, files);
      setDocumentName(extracted.file_name || formatFileNames(files));
      setInputText(extracted.text);
      setStatusMessage(`${extracted.page_count} page${extracted.page_count === 1 ? "" : "s"} extracted. Review the text before analyzing.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleAnalyze() {
    setError("");
    setStatusMessage("");

    if (!canAnalyze) {
      setError("Paste text or extract a document with at least 20 characters first.");
      return;
    }

    setIsBusy(true);
    try {
      const result = await analyzeAgreement(apiBaseUrl, token, {
        text: inputText,
        document_name: documentName || "Mobile agreement",
        preferences: user?.preferences,
      });
      setAnalysis(result);
      setScreen("report");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleAuth(email, password, mode) {
    setError("");
    setIsBusy(true);
    try {
      const result = mode === "signup"
        ? await signup(apiBaseUrl, { email, password })
        : await login(apiBaseUrl, { email, password });
      await SecureStore.setItemAsync(TOKEN_KEY, result.token);
      setToken(result.token);
      setUser(result.user);
      setStatusMessage("Signed in. You can save reports now.");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleLogout() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken("");
    setUser(null);
    setHistoryItems([]);
    setStatusMessage("Signed out.");
  }

  async function handlePreferenceChange(key, value) {
    if (!token || !user) {
      return;
    }

    const nextPreferences = {
      ...user.preferences,
      [key]: value,
    };
    setUser({ ...user, preferences: nextPreferences });

    try {
      const updatedUser = await updatePreferences(apiBaseUrl, token, nextPreferences);
      setUser(updatedUser);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSaveReport() {
    if (!token || !analysis) {
      setError("Sign in before saving reports.");
      setScreen("account");
      return;
    }

    setIsBusy(true);
    try {
      await saveAnalysis(apiBaseUrl, token, {
        analysis,
        document_name: analysis.document_name || documentName || "Mobile agreement",
      });
      const saved = await listHistory(apiBaseUrl, token);
      setHistoryItems(saved);
      setStatusMessage("Report saved to history.");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleOpenSaved(id) {
    if (!token) {
      return;
    }

    setIsBusy(true);
    try {
      const saved = await getSavedAnalysis(apiBaseUrl, token, id);
      setAnalysis(saved.analysis);
      setDocumentName(saved.document_name);
      setScreen("report");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDeleteSaved(id) {
    if (!token) {
      return;
    }

    try {
      await deleteSavedAnalysis(apiBaseUrl, token, id);
      const saved = await listHistory(apiBaseUrl, token);
      setHistoryItems(saved);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleShareReport() {
    if (!analysis) {
      return;
    }

    await Share.share({
      message: buildShareReport(analysis),
    });
  }

  function handleNewReview() {
    setAnalysis(null);
    setDocumentName("");
    setInputText("");
    setStatusMessage("");
    setError("");
    setScreen("review");
  }

  const renderedScreen = useMemo(() => {
    if (screen === "account") {
      return (
        <AccountScreen
          apiBaseUrl={apiBaseUrl}
          setApiBaseUrl={setApiBaseUrl}
          user={user}
          historyItems={historyItems}
          isBusy={isBusy}
          onAuth={handleAuth}
          onLogout={handleLogout}
          onOpenSaved={handleOpenSaved}
          onDeleteSaved={handleDeleteSaved}
          onPreferenceChange={handlePreferenceChange}
        />
      );
    }

    if (screen === "report" && analysis) {
      return (
        <ReportScreen
          analysis={analysis}
          user={user}
          isBusy={isBusy}
          onSave={handleSaveReport}
          onShare={handleShareReport}
          onNewReview={handleNewReview}
          onAccount={() => setScreen("account")}
        />
      );
    }

    return (
      <ReviewScreen
        apiBaseUrl={apiBaseUrl}
        setApiBaseUrl={setApiBaseUrl}
        documentName={documentName}
        inputText={inputText}
        isBusy={isBusy}
        canAnalyze={canAnalyze}
        onDocumentNameChange={setDocumentName}
        onTextChange={setInputText}
        onPickDocuments={handlePickDocuments}
        onPickImages={handlePickImages}
        onScanWithCamera={handleScanWithCamera}
        onAnalyze={handleAnalyze}
      />
    );
  }, [
    analysis,
    apiBaseUrl,
    canAnalyze,
    documentName,
    historyItems,
    inputText,
    isBusy,
    screen,
    user,
  ]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.app}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <View style={styles.logoMark}>
            <Text style={styles.logoText}>DSA</Text>
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.appTitle}>Don't Sign Anything!</Text>
            <Text style={styles.appSubtitle}>Educational document risk assistant</Text>
          </View>
        </View>

        {(error || statusMessage) && (
          <View style={[styles.message, error ? styles.errorMessage : styles.successMessage]}>
            <Text style={[styles.messageText, error ? styles.errorText : styles.successText]}>
              {error || statusMessage}
            </Text>
          </View>
        )}

        {isBusy && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#0f766e" />
            <Text style={styles.loadingText}>Working...</Text>
          </View>
        )}

        {renderedScreen}

        <View style={styles.bottomNav}>
          <NavButton active={screen === "review"} label="Review" onPress={() => setScreen("review")} />
          <NavButton
            active={screen === "report"}
            label="Report"
            disabled={!analysis}
            onPress={() => analysis && setScreen("report")}
          />
          <NavButton active={screen === "account"} label={user ? "Account" : "Sign in"} onPress={() => setScreen("account")} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ReviewScreen({
  apiBaseUrl,
  setApiBaseUrl,
  documentName,
  inputText,
  isBusy,
  canAnalyze,
  onDocumentNameChange,
  onTextChange,
  onPickDocuments,
  onPickImages,
  onScanWithCamera,
  onAnalyze,
}) {
  const wordCount = inputText.trim() ? inputText.trim().split(/\s+/).length : 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
      <View style={styles.heroPanel}>
        <Text style={styles.eyebrow}>Mobile scan workflow</Text>
        <Text style={styles.heroTitle}>Scan, upload, or paste before signing.</Text>
        <Text style={styles.bodyText}>
          This mobile MVP reuses the same FastAPI analysis engine. OCR text appears here first so
          you can fix mistakes before analysis.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Backend URL</Text>
        <TextInput
          value={apiBaseUrl}
          onChangeText={setApiBaseUrl}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
        <Text style={styles.helperText}>
          Use your computer LAN IP on a real phone, such as http://192.168.1.25:8000.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Add a document</Text>
        <View style={styles.buttonGrid}>
          <ActionButton label="Camera scan" onPress={onScanWithCamera} disabled={isBusy} />
          <ActionButton label="Photo pages" onPress={onPickImages} disabled={isBusy} secondary />
          <ActionButton label="Files/PDFs" onPress={onPickDocuments} disabled={isBusy} secondary />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Document name</Text>
        <TextInput
          value={documentName}
          onChangeText={onDocumentNameChange}
          placeholder="Mobile agreement"
          style={styles.input}
        />
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Extracted or pasted text</Text>
          <Text style={styles.wordCount}>{wordCount} words</Text>
        </View>
        <TextInput
          value={inputText}
          onChangeText={onTextChange}
          placeholder="Paste agreement text or extract it from a file..."
          multiline
          textAlignVertical="top"
          style={styles.textArea}
        />
      </View>

      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          This is not legal advice. Use the results for education and ask a licensed attorney for
          legal decisions.
        </Text>
      </View>

      <ActionButton label="Analyze" onPress={onAnalyze} disabled={!canAnalyze} />
    </ScrollView>
  );
}

function ReportScreen({ analysis, user, isBusy, onSave, onShare, onNewReview, onAccount }) {
  const topRisks = [...(analysis.detected_risks || [])]
    .sort((first, second) => severityRank(first.severity) - severityRank(second.severity))
    .slice(0, 5);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
      <View style={styles.scorePanel}>
        <Text style={styles.eyebrow}>Risk score</Text>
        <View style={styles.scoreRow}>
          <Text style={styles.scoreNumber}>{analysis.risk_score}</Text>
          <View style={styles.scoreMeta}>
            <SeverityBadge severity={analysis.risk_level} />
            <Text style={styles.bodyText}>{analysis.document_type || "Unknown document"}</Text>
          </View>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.max(8, analysis.risk_score)}%` }]} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Plain-English summary</Text>
        <Text style={styles.bodyText}>{analysis.summary}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Top risks</Text>
        {topRisks.length === 0 ? (
          <Text style={styles.bodyText}>No configured risk clauses were detected.</Text>
        ) : (
          topRisks.map((risk) => <RiskRow key={risk.id} risk={risk} />)
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Questions before signing</Text>
        {(analysis.questions_to_ask || []).slice(0, 6).map((question) => (
          <Text key={question} style={styles.listItem}>- {question}</Text>
        ))}
      </View>

      <View style={styles.buttonGrid}>
        <ActionButton label={user ? "Save report" : "Sign in to save"} onPress={user ? onSave : onAccount} disabled={isBusy} />
        <ActionButton label="Share report" onPress={onShare} secondary />
        <ActionButton label="New review" onPress={onNewReview} secondary />
      </View>
    </ScrollView>
  );
}

function AccountScreen({
  apiBaseUrl,
  setApiBaseUrl,
  user,
  historyItems,
  isBusy,
  onAuth,
  onLogout,
  onOpenSaved,
  onDeleteSaved,
  onPreferenceChange,
}) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (!user) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Optional account</Text>
          <Text style={styles.sectionTitle}>Save reports and preferences</Text>
          <Text style={styles.bodyText}>
            Email sign-in connects to the same local backend as the web app. Social sign-in is not
            enabled in this MVP.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Backend URL</Text>
          <TextInput value={apiBaseUrl} onChangeText={setApiBaseUrl} autoCapitalize="none" style={styles.input} />
          <Text style={styles.label}>Email</Text>
          <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input} />
          <Text style={styles.label}>Password</Text>
          <TextInput value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
          <ActionButton
            label={mode === "signup" ? "Create account" : "Sign in"}
            disabled={isBusy || email.length < 5 || password.length < 8}
            onPress={() => onAuth(email, password, mode)}
          />
          <Pressable onPress={() => setMode(mode === "signup" ? "login" : "signup")} style={styles.linkButton}>
            <Text style={styles.linkText}>
              {mode === "signup" ? "I already have an account" : "Create an account"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Signed in</Text>
        <Text style={styles.sectionTitle}>{user.email}</Text>
        <ActionButton label="Sign out" onPress={onLogout} secondary />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Risk preferences</Text>
        {preferenceOptions.map(([key, label]) => (
          <View key={key} style={styles.preferenceRow}>
            <Text style={styles.preferenceLabel}>{label}</Text>
            <Switch
              value={Boolean(user.preferences?.[key])}
              onValueChange={(value) => onPreferenceChange(key, value)}
              trackColor={{ false: "#cbd5e1", true: "#99f6e4" }}
              thumbColor={user.preferences?.[key] ? "#0f766e" : "#f8fafc"}
            />
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Saved history</Text>
        {historyItems.length === 0 ? (
          <Text style={styles.bodyText}>Save a report after analysis and it will appear here.</Text>
        ) : (
          historyItems.map((item) => (
            <View key={item.id} style={styles.historyItem}>
              <View style={styles.historyHeader}>
                <View style={styles.historyCopy}>
                  <Text style={styles.historyTitle}>{item.document_name}</Text>
                  <Text style={styles.helperText}>
                    {item.document_type} - {item.risk_level} - {item.finding_count} findings
                  </Text>
                </View>
                <Text style={styles.historyScore}>{item.risk_score}</Text>
              </View>
              <View style={styles.historyActions}>
                <SmallButton label="Open" onPress={() => onOpenSaved(item.id)} />
                <SmallButton label="Delete" onPress={() => confirmDelete(() => onDeleteSaved(item.id))} danger />
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function RiskRow({ risk }) {
  return (
    <View style={styles.riskRow}>
      <View style={styles.rowBetween}>
        <Text style={styles.riskTitle}>{risk.title}</Text>
        <SeverityBadge severity={risk.severity} />
      </View>
      <Text style={styles.helperText}>{risk.category}</Text>
      <Text style={styles.bodyText}>{risk.plain_english}</Text>
    </View>
  );
}

function SeverityBadge({ severity }) {
  return (
    <View style={[styles.badge, severity === "High" ? styles.badgeHigh : severity === "Medium" ? styles.badgeMedium : styles.badgeLow]}>
      <Text style={[styles.badgeText, severity === "High" ? styles.badgeHighText : severity === "Medium" ? styles.badgeMediumText : styles.badgeLowText]}>
        {severity}
      </Text>
    </View>
  );
}

function ActionButton({ label, onPress, disabled, secondary }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionButton,
        secondary && styles.secondaryButton,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressedButton,
      ]}
    >
      <Text style={[styles.actionButtonText, secondary && styles.secondaryButtonText]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SmallButton({ label, onPress, danger }) {
  return (
    <Pressable onPress={onPress} style={[styles.smallButton, danger && styles.dangerButton]}>
      <Text style={[styles.smallButtonText, danger && styles.dangerButtonText]}>{label}</Text>
    </Pressable>
  );
}

function NavButton({ label, active, disabled, onPress }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.navButton, active && styles.navButtonActive, disabled && styles.navButtonDisabled]}>
      <Text style={[styles.navButtonText, active && styles.navButtonTextActive, disabled && styles.navButtonTextDisabled]}>
        {label}
      </Text>
    </Pressable>
  );
}

function normalizeDocumentAsset(asset) {
  return {
    uri: asset.uri,
    name: asset.name || "mobile-document",
    type: asset.mimeType || "application/octet-stream",
  };
}

function normalizeImageAsset(asset, index) {
  return {
    uri: asset.uri,
    name: asset.fileName || `scan-page-${index + 1}.jpg`,
    type: asset.mimeType || "image/jpeg",
  };
}

function formatFileNames(files) {
  if (files.length === 1) {
    return files[0].name;
  }
  return `${files[0].name} + ${files.length - 1} more`;
}

function severityRank(severity) {
  if (severity === "High") return 0;
  if (severity === "Medium") return 1;
  return 2;
}

function buildShareReport(analysis) {
  const risks = (analysis.detected_risks || [])
    .slice(0, 5)
    .map((risk) => `- ${risk.title} (${risk.severity}): ${risk.plain_english}`)
    .join("\n");

  return [
    "Don't Sign Anything! mobile report",
    "",
    `Document: ${analysis.document_name || "Agreement"}`,
    `Risk score: ${analysis.risk_score}/100 (${analysis.risk_level})`,
    "",
    "Summary:",
    analysis.summary,
    "",
    "Top risks:",
    risks || "No configured risks detected.",
    "",
    "This is not legal advice. Consult a licensed attorney for legal decisions.",
  ].join("\n");
}

function confirmDelete(onConfirm) {
  Alert.alert("Delete saved report?", "This removes the saved analysis from your history.", [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: onConfirm },
  ]);
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f7f9fb",
  },
  app: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  logoMark: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f172a",
  },
  logoText: {
    color: "#5eead4",
    fontSize: 13,
    fontWeight: "900",
  },
  headerCopy: {
    flex: 1,
  },
  appTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "900",
  },
  appSubtitle: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 13,
    fontWeight: "600",
  },
  screen: {
    flex: 1,
  },
  screenContent: {
    gap: 14,
    padding: 16,
    paddingBottom: 110,
  },
  heroPanel: {
    borderRadius: 10,
    padding: 18,
    backgroundColor: "#0f172a",
  },
  eyebrow: {
    color: "#0f766e",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  heroTitle: {
    marginTop: 8,
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 36,
  },
  card: {
    borderWidth: 1,
    borderColor: "#dbe3ef",
    borderRadius: 10,
    padding: 16,
    backgroundColor: "#ffffff",
  },
  sectionTitle: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 28,
  },
  bodyText: {
    marginTop: 8,
    color: "#475569",
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 24,
  },
  helperText: {
    marginTop: 6,
    color: "#64748b",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  label: {
    marginBottom: 8,
    color: "#334155",
    fontSize: 14,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
    fontSize: 16,
  },
  textArea: {
    minHeight: 220,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    padding: 12,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
    fontSize: 16,
    lineHeight: 24,
  },
  buttonGrid: {
    gap: 10,
  },
  actionButton: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    paddingHorizontal: 18,
    backgroundColor: "#0f766e",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
  },
  disabledButton: {
    backgroundColor: "#94a3b8",
    borderColor: "#94a3b8",
  },
  pressedButton: {
    transform: [{ scale: 0.985 }],
  },
  actionButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
  secondaryButtonText: {
    color: "#0f172a",
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  wordCount: {
    color: "#0f766e",
    fontSize: 14,
    fontWeight: "900",
  },
  disclaimer: {
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 10,
    padding: 14,
    backgroundColor: "#fffbeb",
  },
  disclaimerText: {
    color: "#78350f",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  scorePanel: {
    borderRadius: 10,
    padding: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbe3ef",
  },
  scoreRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  scoreNumber: {
    color: "#0f172a",
    fontSize: 58,
    fontWeight: "900",
  },
  scoreMeta: {
    flex: 1,
  },
  progressTrack: {
    marginTop: 14,
    height: 14,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "#e2e8f0",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#0f766e",
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeHigh: {
    backgroundColor: "#fee2e2",
  },
  badgeMedium: {
    backgroundColor: "#fef3c7",
  },
  badgeLow: {
    backgroundColor: "#ccfbf1",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "900",
  },
  badgeHighText: {
    color: "#b91c1c",
  },
  badgeMediumText: {
    color: "#b45309",
  },
  badgeLowText: {
    color: "#0f766e",
  },
  riskRow: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 14,
    marginTop: 14,
  },
  riskTitle: {
    flex: 1,
    color: "#0f172a",
    fontSize: 17,
    fontWeight: "900",
  },
  listItem: {
    marginTop: 10,
    color: "#475569",
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 24,
  },
  preferenceRow: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  preferenceLabel: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "800",
  },
  historyItem: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 14,
    marginTop: 14,
  },
  historyHeader: {
    flexDirection: "row",
    gap: 12,
  },
  historyCopy: {
    flex: 1,
  },
  historyTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "900",
  },
  historyScore: {
    color: "#0f172a",
    fontSize: 24,
    fontWeight: "900",
  },
  historyActions: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  smallButton: {
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    paddingHorizontal: 14,
    backgroundColor: "#f1f5f9",
  },
  smallButtonText: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "900",
  },
  dangerButton: {
    backgroundColor: "#fee2e2",
  },
  dangerButtonText: {
    color: "#b91c1c",
  },
  linkButton: {
    marginTop: 14,
    alignItems: "center",
  },
  linkText: {
    color: "#0f766e",
    fontSize: 16,
    fontWeight: "900",
  },
  message: {
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 8,
    padding: 12,
  },
  errorMessage: {
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  successMessage: {
    backgroundColor: "#ccfbf1",
    borderWidth: 1,
    borderColor: "#99f6e4",
  },
  messageText: {
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
  },
  errorText: {
    color: "#991b1b",
  },
  successText: {
    color: "#115e59",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  loadingText: {
    color: "#0f766e",
    fontSize: 14,
    fontWeight: "800",
  },
  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 24 : 14,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  navButton: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#f8fafc",
  },
  navButtonActive: {
    backgroundColor: "#0f172a",
  },
  navButtonDisabled: {
    opacity: 0.45,
  },
  navButtonText: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "900",
  },
  navButtonTextActive: {
    color: "#ffffff",
  },
  navButtonTextDisabled: {
    color: "#94a3b8",
  },
});
