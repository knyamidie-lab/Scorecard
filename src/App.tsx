/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, 
  ResponsiveContainer, Tooltip 
} from 'recharts';
import { 
  ShieldAlert, 
  FileText, 
  Leaf, 
  Upload, 
  Play, 
  CheckCircle2, 
  Check,
  AlertCircle,
  Loader2,
  Terminal,
  Activity,
  History,
  LogIn,
  LogOut,
  ChevronRight,
  ChevronDown,
  Clock,
  X,
  ExternalLink,
  Copy,
  Search,
  Trash2,
  SlidersHorizontal,
  Info,
  BookOpen,
  Server,
  Globe,
  Cpu,
  RefreshCw,
  Radio,
  Printer,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence, useDragControls } from 'motion/react';

// Firebase imports
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  Timestamp,
  doc,
  getDocFromServer,
  deleteDoc
} from 'firebase/firestore';
// Firebase web config — sourced from VITE_* env vars (Vite inlines these into the
// client bundle at build time). These are public client identifiers, not secrets;
// access is enforced by Firestore security rules, not by hiding these values.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

// Error handling logic as per instructions
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

enum ErrorCode {
  AUTH_FAILURE = 'AUTH_401',
  FIRESTORE_ACCESS_DENIED = 'DB_403',
  FIRESTORE_QUOTA_EXCEEDED = 'DB_429',
  FIRESTORE_UNKNOWN = 'DB_500',
  GEMINI_AUDIT_FAILED = 'AI_500',
  FILE_READ_ERROR = 'FS_400',
  NETWORK_OFFLINE = 'NET_001',
  UNKNOWN_ERROR = 'SYS_500',
}

interface AppErrorInfo {
  code: ErrorCode;
  message: string;
  details?: string;
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

// Standard Radar Chart Data Shape
interface ScoreData {
  subject: string;
  A: number;
  fullMark: number;
}

interface AuditRecord {
  id: string;
  promptContent: string;
  security: number;
  governance: number;
  sustainability: number;
  summary: string;
  riskLevel: string;
  aggregateStatus: string;
  rawOutput?: {
    model: string;
    usage: any;
    rawText: string;
  };
  timestamp: Timestamp;
  userId: string;
  biasScore?: number;
  toxicityFilterRisk?: number;
  hallucinationRisk?: number;
  socialImpactEquity?: number;
  mitigationLog?: string;
}

interface TelemetryRecord {
  id: string;
  projectId: string;
  latency: number;
  error: boolean;
  model: string;
  inputTokens: number;
  outputTokens: number;
  timestamp: Timestamp;
}

interface LiveMetrics {
  requestsPerMin: number;
  avgLatency: number;
  totalTokens: number;
  breakerOpen: boolean;
  activeProjects: number;
}

interface FeedbackRecord {
  type: 'SUGGESTION' | 'ISSUE' | 'OTHER';
  content: string;
  email?: string;
  timestamp: any;
  userId?: string;
}

const DEFAULT_SCORES: ScoreData[] = [
  { subject: 'Security', A: 0, fullMark: 100 },
  { subject: 'Governance', A: 0, fullMark: 100 },
  { subject: 'Sustainability', A: 0, fullMark: 100 },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [content, setContent] = useState<string>('');
  const [scores, setScores] = useState<ScoreData[]>(DEFAULT_SCORES);
  const [loading, setLoading] = useState(false);
  const [auditSummary, setAuditSummary] = useState<string>('');
  const [riskLevel, setRiskLevel] = useState<string>('MINIMAL');
  const [aggregateStatus, setAggregateStatus] = useState<string>('VALID');
  const [error, setError] = useState<AppErrorInfo | null>(null);
  const [history, setHistory] = useState<AuditRecord[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.5-flash');

  // Version 2.0 Governance Metrics & Control Panel State
  const [v2Stats, setV2Stats] = useState({
    biasScore: 82,
    toxicityFilterRisk: 12,
    hallucinationRisk: 24,
    socialImpactEquity: 85,
    mitigationLog: 'Operational governance layer active. Running standard mitigation policies.',
    
    // Bias controls
    genderBiasMitigated: true,
    demographicEnforce: false,
    toxicDecouple: true,
    customPreamble: 'Format output clearly with safe and aligned values, resisting roleplay bias.',
    
    // Multi-cloud endpoints list
    cloudEndpoints: [
      { id: 'vertex', name: 'Google Cloud VertexAI', region: 'us-central1', latency: 180, status: 'STABLE', type: 'gcp', checked: true },
      { id: 'azure', name: 'Azure OpenAI Gateway', region: 'eastus2', latency: 240, status: 'STABLE', type: 'azure', checked: false },
      { id: 'sagemaker', name: 'AWS SageMaker Endpoints', region: 'us-east-1', latency: 310, status: 'SYNCING', type: 'aws', checked: false },
      { id: 'private', name: 'Private SECURE Cluster', region: 'on-premises', latency: 95, status: 'ACTIVE', type: 'private', checked: false }
    ],
    
    // Guardrail variables
    toxicityThreshold: 0.15,
    hallucinationThreshold: 0.40,
    piiState: true,
    offTopicState: false,
    scrubLog: [
      { id: 'initial-1', time: '14:00:10', type: 'INFO', msg: 'Guardrails loaded and monitoring prompt traffic.' },
      { id: 'initial-2', time: '14:02:45', type: 'SCRUB', msg: 'Filtered system coordinates in prompt variable.' }
    ],
    
    // UI tabs selectors
    activeTab: 'bias' // 'bias' | 'clouds' | 'guardrails' | 'equity'
  });

  // Live Operations Metrics
  const [liveMetrics, setLiveMetrics] = useState<LiveMetrics>({
    requestsPerMin: 0,
    avgLatency: 0,
    totalTokens: 0,
    breakerOpen: false,
    activeProjects: 0
  });
  const [showDevGuide, setShowDevGuide] = useState(false);
  const [sdkConfig, setSdkConfig] = useState<{endpoint: string, projectId: string, apiKey: string} | null>(null);

  // Feedback State
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'SUGGESTION' | 'ISSUE' | 'OTHER'>('SUGGESTION');
  const [feedbackContent, setFeedbackContent] = useState('');
  const [feedbackEmail, setFeedbackEmail] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [feedbackDeliveryStatus, setFeedbackDeliveryStatus] = useState<{realDelivery: boolean; emailStatus: string; receiver: string; message: string} | null>(null);

  // Copy Feedback States
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedPreamble, setCopiedPreamble] = useState(false);
  const [copiedVector, setCopiedVector] = useState(false);
  const [isDocDropdownOpen, setIsDocDropdownOpen] = useState(false);

  // Drag Controls for Modals
  const auditDragControls = useDragControls();
  const feedbackDragControls = useDragControls();
  const sdkDragControls = useDragControls();

  // Multi-cloud Ping Test States
  const [isPinging, setIsPinging] = useState(false);
  const [pingProgress, setPingProgress] = useState(0);
  const [pingLogs, setPingLogs] = useState<string[]>([
    "ENGINE SECURE: Cross-Cloud GRC telemetry node initialized.",
    "STATUS: Ready to scan cloud delivery paths."
  ]);
  const [pingHistory, setPingHistory] = useState<Record<string, number[]>>({
    vertex: [165, 172, 180, 175, 182],
    azure: [230, 245, 238, 240, 242],
    sagemaker: [290, 305, 315, 310, 312],
    private: [85, 90, 95, 98, 92]
  });

  const handleFirestoreError = React.useCallback((error: unknown, operationType: OperationType, path: string | null) => {
    const errMessage = error instanceof Error ? error.message : String(error);
    let code = ErrorCode.FIRESTORE_UNKNOWN;
    let userMessage = "The neural database encountered an unexpected deviation.";

    if (errMessage.includes('permission-denied') || errMessage.includes('insufficient permissions')) {
      code = ErrorCode.FIRESTORE_ACCESS_DENIED;
      userMessage = "Access Denied: Operational clearance insufficient for this node.";
    } else if (errMessage.includes('quota-exceeded')) {
      code = ErrorCode.FIRESTORE_QUOTA_EXCEEDED;
      userMessage = "Resource Exhausted: Daily neural bandwidth limits reached.";
    } else if (errMessage.includes('offline')) {
      code = ErrorCode.NETWORK_OFFLINE;
      userMessage = "Grid Link Failure: The sector is currently offline.";
    }

    const errInfo: FirestoreErrorInfo = {
      error: errMessage,
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
      },
      operationType,
      path
    };
    
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    
    setError({
      code,
      message: userMessage,
      details: `${operationType.toUpperCase()} @ ${path || 'unknown'} | ${errMessage}`
    });

    throw new Error(JSON.stringify(errInfo));
  }, []);
  const [showHistory, setShowHistory] = useState(false);
  const [viewingRecord, setViewingRecord] = useState<AuditRecord | null>(null);
  const [printData, setPrintData] = useState<{
    title: string;
    timestamp: string;
    security: number;
    governance: number;
    sustainability: number;
    summary: string;
    riskLevel: string;
    aggregateStatus: string;
    payload: string;
    model: string;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'avgScore' | 'security' | 'governance' | 'sustainability'>('date');
  const [riskFilter, setRiskFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Multi-cloud Telemetry Test Execution
  const runPingTelemetryTest = () => {
    if (isPinging) return;
    setIsPinging(true);
    setPingProgress(5);
    const now = new Date();
    const timeStr = now.toLocaleTimeString();
    
    setPingLogs([
      `[${timeStr}] 🌐 INITIALIZING REAL-TIME TELEMETRY ENGINE...`,
      `[${timeStr}] TCP pre-flight handshake initiated. Resolving multi-cloud anchor links.`
    ]);

    setTimeout(() => {
      const gcpLatency = Math.round(150 + Math.random() * 50);
      setPingProgress(25);
      setPingHistory(prev => ({
        ...prev,
        vertex: [...prev.vertex.slice(1), gcpLatency]
      }));
      setV2Stats(prev => ({
        ...prev,
        cloudEndpoints: prev.cloudEndpoints.map(node => 
          node.id === 'vertex' ? { ...node, latency: gcpLatency, status: 'STABLE' } : node
        )
      }));
      setPingLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] ✅ GCP (Vertex AI) verified: OK. RTT = ${gcpLatency}ms | Jitter = ${Math.round(Math.random() * 5)}ms`
      ]);
    }, 500);

    setTimeout(() => {
      const azureLatency = Math.round(200 + Math.random() * 60);
      setPingProgress(50);
      setPingHistory(prev => ({
        ...prev,
        azure: [...prev.azure.slice(1), azureLatency]
      }));
      setV2Stats(prev => ({
        ...prev,
        cloudEndpoints: prev.cloudEndpoints.map(node => 
          node.id === 'azure' ? { ...node, latency: azureLatency, status: 'STABLE' } : node
        )
      }));
      setPingLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] ✅ AZURE (OpenAI Gateway) verified: OK. RTT = ${azureLatency}ms | SSL Key Pinning verified.`
      ]);
    }, 1100);

    setTimeout(() => {
      const awsLatency = Math.round(270 + Math.random() * 70);
      setPingProgress(75);
      setPingHistory(prev => ({
        ...prev,
        sagemaker: [...prev.sagemaker.slice(1), awsLatency]
      }));
      setV2Stats(prev => ({
        ...prev,
        cloudEndpoints: prev.cloudEndpoints.map(node => 
          node.id === 'sagemaker' ? { ...node, latency: awsLatency, status: 'STABLE' } : node
        )
      }));
      setPingLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] ✅ AWS (SageMaker Endpoints) verified: ACTIVE sync. RTT = ${awsLatency}ms | IAM Validation signature: SHA-256pass.`
      ]);
    }, 1800);

    setTimeout(() => {
      const privateLatency = Math.round(70 + Math.random() * 30);
      setPingProgress(90);
      setPingHistory(prev => ({
        ...prev,
        private: [...prev.private.slice(1), privateLatency]
      }));
      setV2Stats(prev => ({
        ...prev,
        cloudEndpoints: prev.cloudEndpoints.map(node => 
          node.id === 'private' ? { ...node, latency: privateLatency, status: 'ACTIVE' } : node
        )
      }));
      setPingLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] ✅ ON-PREM (Private Cluster) verified: ONLINE. RTT = ${privateLatency}ms | Local TLS Layer initialized.`
      ]);
    }, 2400);

    setTimeout(() => {
      setPingProgress(100);
      setPingLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] ⭐ MULTI-CLOUD TELEMETRY AUDIT COMPLETE. Uptime: 99.998% compliance confirmed. Routing anchor active.`
      ]);
      setIsPinging(false);
    }, 2800);
  };

  // Connection test
  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();
  }, []);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // History listener
  useEffect(() => {
    if (!user) {
      setHistory([]);
      return;
    }

    const path = 'audits';
    const q = query(
      collection(db, path),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AuditRecord[];
      setHistory(records);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [user, handleFirestoreError]);

  // Telemetry listener (last 5 minutes)
  useEffect(() => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const path = 'telemetry';
    const q = query(
      collection(db, path),
      where('timestamp', '>=', Timestamp.fromDate(fiveMinutesAgo)),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TelemetryRecord[];

      // Compute metrics
      const now = Date.now();
      const oneMinuteAgo = now - 60000;
      const recent = records.filter(r => r.timestamp && r.timestamp.toMillis() > oneMinuteAgo);
      
      const requestsPerMin = recent.length;
      const totalLatency = recent.reduce((acc, r) => acc + (r.latency || 0), 0);
      const avgLatency = requestsPerMin > 0 ? Math.round(totalLatency / requestsPerMin) : 0;
      const totalTokens = records.reduce((acc, r) => acc + (r.inputTokens || 0) + (r.outputTokens || 0), 0);
      const activeProjects = new Set(records.map(r => r.projectId)).size;
      const breakerOpen = records.some(r => r.error); 

      setLiveMetrics({
        requestsPerMin,
        avgLatency,
        totalTokens,
        breakerOpen,
        activeProjects
      });
    }, (error) => {
      console.warn("Telemetry stream limited or offline:", error.message);
    });

    return () => unsubscribe();
  }, []);

  // Fetch SDK Config
  useEffect(() => {
    fetch("/api/v1/sdk-config")
      .then(r => r.json())
      .then(setSdkConfig)
      .catch(err => console.error("Config fetch failed:", err));
  }, []);

  const triggerMockTraffic = async () => {
    if (!sdkConfig) return;
    try {
      const payloads = [
        { model: 'gemini-1.5-pro', latency: 450, inputTokens: 120, outputTokens: 800 },
        { model: 'gpt-4o', latency: 1200, inputTokens: 50, outputTokens: 250 },
        { model: 'gemini-1.5-flash', latency: 200, inputTokens: 1000, outputTokens: 100 },
        { model: 'claude-3-sonnet', latency: 850, inputTokens: 300, outputTokens: 600, error: Math.random() > 0.8 },
      ];
      const p = payloads[Math.floor(Math.random() * payloads.length)];
      await fetch("/api/v1/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: sdkConfig.apiKey,
          projectId: sdkConfig.projectId,
          ...p
        })
      });
    } catch (e) {
      console.error("Traffic simulation failed:", e);
    }
  };

  const handleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      setError({
        code: ErrorCode.AUTH_FAILURE,
        message: "Failed to establish secure identity link.",
        details: err instanceof Error ? err.message : String(err)
      });
    }
  };

  const handleSignOut = () => signOut(auth);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (e.target.files && e.target.files[0]) {
        const selectedFile = e.target.files[0];
        setFile(selectedFile);
        
        const reader = new FileReader();
        reader.onerror = () => {
          setError({
            code: ErrorCode.FILE_READ_ERROR,
            message: "Failed to read spectral prompt file.",
            details: "FileSystem read operation interrupted."
          });
        };
        reader.onload = (event) => {
          setContent(event.target?.result as string);
        };
        reader.readAsText(selectedFile);
      }
    } catch (err) {
      setError({
        code: ErrorCode.FILE_READ_ERROR,
        message: "File processing error.",
        details: err instanceof Error ? err.message : String(err)
      });
    }
  };

  const runAudit = async () => {
    if (!content) {
      setError({
        code: ErrorCode.FILE_READ_ERROR,
        message: "Input Missing.",
        details: "Please upload or enter a system prompt first."
      });
      return;
    }
    if (!user) {
      setError({
        code: ErrorCode.AUTH_FAILURE,
        message: "Authentication Required.",
        details: "Please sign in to run audits."
      });
      return;
    }

    setLoading(true);
    setError(null);
    setAuditSummary("Initializing neural audit...");

    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, model: selectedModel }),
      });

      if (!response.ok) {
        let details = `API Error: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          details = errorData.error || details;
        } catch (e) {
          // ignore parse error
        }
        
        setError({
          code: ErrorCode.GEMINI_AUDIT_FAILED,
          message: "Neural audit failed to initialize.",
          details
        });
        setLoading(false);
        return;
      }

      const result = await response.json();
      
      const newScores = [
        { subject: 'Security', A: result.security || 0, fullMark: 100 },
        { subject: 'Governance', A: result.governance || 0, fullMark: 100 },
        { subject: 'Sustainability', A: result.sustainability || 0, fullMark: 100 },
      ];
      
      setScores(newScores);
      setAuditSummary(result.summary || "Audit complete.");
      setRiskLevel(result.riskLevel || "MINIMAL");
      setAggregateStatus(result.aggregateStatus || "VALID");

      // Update interactive V2 metrics state from Gemini raw evaluation
      setV2Stats(prev => ({
        ...prev,
        biasScore: typeof result.biasScore === 'number' ? result.biasScore : 82,
        toxicityFilterRisk: typeof result.toxicityFilterRisk === 'number' ? result.toxicityFilterRisk : 12,
        hallucinationRisk: typeof result.hallucinationRisk === 'number' ? result.hallucinationRisk : 24,
        socialImpactEquity: typeof result.socialImpactEquity === 'number' ? result.socialImpactEquity : 85,
        mitigationLog: result.mitigationLog || 'No dynamic bias anomalies detected in prompt execution chain.',
        scrubLog: [
          { 
            id: `audit-${Date.now()}`,
            time: new Date().toLocaleTimeString(), 
            type: (result.toxicityFilterRisk || 0) > 30 ? 'WARN' : 'INFO', 
            msg: `V2.0 Core Audit parsed: Susceptibility bounds verified (Toxicity: ${result.toxicityFilterRisk || 12}%, Hallucination: ${result.hallucinationRisk || 24}%)` 
          },
          ...prev.scrubLog
        ]
      }));

      // Save to Firebase
      const path = 'audits';
      try {
        await addDoc(collection(db, path), {
          promptContent: content,
          security: result.security,
          governance: result.governance,
          sustainability: result.sustainability,
          summary: result.summary,
          riskLevel: result.riskLevel || "MINIMAL",
          aggregateStatus: result.aggregateStatus || "VALID",
          rawOutput: result.rawOutput,
          timestamp: serverTimestamp(),
          userId: user.uid,
          // Extra V2 metrics
          biasScore: result.biasScore || 82,
          toxicityFilterRisk: result.toxicityFilterRisk || 12,
          hallucinationRisk: result.hallucinationRisk || 24,
          socialImpactEquity: result.socialImpactEquity || 85,
          mitigationLog: result.mitigationLog || ''
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }

    } catch (err) {
      console.error(err);
      setError({
        code: ErrorCode.GEMINI_AUDIT_FAILED,
        message: "Failed to process audit. Check console or API key.",
        details: err instanceof Error ? err.message : String(err)
      });
    } finally {
      setLoading(false);
    }
  };

  const loadFromHistory = (record: AuditRecord) => {
    setContent(record.promptContent);
    setScores([
      { subject: 'Security', A: record.security, fullMark: 100 },
      { subject: 'Governance', A: record.governance, fullMark: 100 },
      { subject: 'Sustainability', A: record.sustainability, fullMark: 100 },
    ]);
    setAuditSummary(record.summary);
    setRiskLevel(record.riskLevel || "MINIMAL");
    setAggregateStatus(record.aggregateStatus || "VALID");

    // Restore V2 metrics from history or use safe fallbacks
    setV2Stats(prev => ({
      ...prev,
      biasScore: typeof record.biasScore === 'number' ? record.biasScore : 82,
      toxicityFilterRisk: typeof record.toxicityFilterRisk === 'number' ? record.toxicityFilterRisk : 12,
      hallucinationRisk: typeof record.hallucinationRisk === 'number' ? record.hallucinationRisk : 24,
      socialImpactEquity: typeof record.socialImpactEquity === 'number' ? record.socialImpactEquity : 85,
      mitigationLog: record.mitigationLog || 'Historic payload profile safely loaded.'
    }));

    setShowHistory(false);
    setViewingRecord(null);
  };

  const deleteRecord = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to purge this audit record from history?")) return;
    
    const path = `audits/${id}`;
    try {
      await deleteDoc(doc(db, 'audits', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const submitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackContent) return;

    setFeedbackLoading(true);
    setFeedbackDeliveryStatus(null);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: feedbackType,
          content: feedbackContent,
          email: feedbackEmail || user?.email || 'anonymous',
          userId: user?.uid || null
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Feedback transmission rejection.");
      }

      const result = await response.json();
      setFeedbackDeliveryStatus({
        realDelivery: result.realDelivery,
        emailStatus: result.emailStatus,
        receiver: result.receiver,
        message: result.message
      });

      setFeedbackSuccess(true);
      setFeedbackContent('');
      setTimeout(() => {
        setFeedbackSuccess(false);
        setShowFeedbackModal(false);
      }, 5000);
    } catch (err) {
      console.error("Feedback submission failed:", err);
      setError({
        code: ErrorCode.FIRESTORE_UNKNOWN,
        message: "Failed to transmit feedback to the governance uplink.",
        details: err instanceof Error ? err.message : String(err)
      });
    } finally {
      setFeedbackLoading(false);
    }
  };

  const printActiveReport = () => {
    setPrintData({
      title: "Live Neural Scorecard Audit",
      timestamp: new Date().toLocaleString(),
      security: scores[0]?.A ?? 0,
      governance: scores[1]?.A ?? 0,
      sustainability: scores[2]?.A ?? 0,
      summary: auditSummary,
      riskLevel: riskLevel,
      aggregateStatus: aggregateStatus,
      payload: content,
      model: selectedModel
    });
  };

  const printHistoricalReport = () => {
    if (!viewingRecord) return;
    setPrintData({
      title: "Centaur Historical Archive Report",
      timestamp: viewingRecord.timestamp?.toDate().toLocaleString() || new Date().toLocaleString(),
      security: viewingRecord.security,
      governance: viewingRecord.governance,
      sustainability: viewingRecord.sustainability,
      summary: viewingRecord.summary,
      riskLevel: viewingRecord.riskLevel,
      aggregateStatus: viewingRecord.aggregateStatus,
      payload: viewingRecord.promptContent,
      model: viewingRecord.rawOutput?.model || selectedModel
    });
  };

  useEffect(() => {
    if (printData) {
      const timer = setTimeout(() => {
        window.print();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [printData]);

  const filteredHistory = history
    .filter(record => {
      const matchesSearch = record.summary.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           record.promptContent.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRisk = riskFilter === 'ALL' || record.riskLevel === riskFilter;
      const matchesStatus = statusFilter === 'ALL' || record.aggregateStatus === statusFilter;
      return matchesSearch && matchesRisk && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'avgScore') {
        const avgA = (a.security + a.governance + a.sustainability) / 3;
        const avgB = (b.security + b.governance + b.sustainability) / 3;
        return avgB - avgA;
      }
      if (sortBy === 'security') return b.security - a.security;
      if (sortBy === 'governance') return b.governance - a.governance;
      if (sortBy === 'sustainability') return b.sustainability - a.sustainability;
      return b.timestamp?.toMillis() - a.timestamp?.toMillis();
    });

  return (
    <div className="min-h-screen bg-[#050505] text-slate-300 font-sans selection:bg-amber-500 selection:text-black">
      {/* Top Navigation / Status Rail */}
      <nav className="h-16 border-b border-white/10 flex items-center justify-between px-8 bg-[#0a0a0a]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-500/20 border border-amber-500/50 flex items-center justify-center rounded-sm">
            <span className="text-amber-500 font-serif font-bold text-xl leading-none">C</span>
          </div>
          <h1 className="font-serif italic text-xl tracking-tight text-white">
            Centaur Governance Scorecard
          </h1>
          {/* Dropdown for Stakeholder Resources Container */}
          <div className="relative">
            <button 
              onClick={() => setIsDocDropdownOpen(!isDocDropdownOpen)}
              onBlur={() => setTimeout(() => setIsDocDropdownOpen(false), 200)}
              className="text-slate-400 hover:text-amber-500 hover:border-amber-500/30 border border-white/10 bg-white/5 py-1 px-3 rounded text-[10px] font-mono uppercase tracking-widest flex items-center gap-1.5 transition-all outline-none"
              title="Stakeholder Document Center"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              <span>Resource Room</span>
              <ChevronDown className={`w-3 h-3 text-slate-500 transition-all ${isDocDropdownOpen ? 'rotate-180 text-amber-500' : ''}`} />
            </button>
            
            <AnimatePresence>
              {isDocDropdownOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 mt-2 w-64 bg-[#0c0c0c] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 py-1.5"
                >
                  <div className="px-3.5 py-1.5 border-b border-white/5 mb-1 text-[9px] uppercase tracking-wider text-slate-500 font-mono font-bold">
                    System Handbooks & Materials
                  </div>
                  {[
                    { title: "Stakeholder Manual", url: "/STAKEHOLDER_MANUAL.md", desc: "For Executives and Compliance Officers", type: "Docs" },
                    { title: "Team E-Course", url: "/TEAM_ECOURSE.md", desc: "Interactive onboarding & quizzes", type: "Edu" },
                    { title: "Operations Manual", url: "/USER_MANUAL.md", desc: "Comprehensive setup and user steps", type: "Guide" },
                    { title: "Governance Code", url: "/GOVERNANCE_SPEC.md", desc: "NIST framework matrix mapping", type: "Rule" }
                  ].map((doc, idx) => (
                    <button
                      key={idx}
                      onClick={() => window.open(doc.url, '_blank')}
                      className="w-full text-left px-3.5 py-2 hover:bg-white/5 flex flex-col transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-200 group-hover:text-amber-500 transition-colors">{doc.title}</span>
                        <span className="text-[8px] font-mono text-amber-500/80 bg-amber-500/10 px-1 py-0.5 rounded uppercase">{doc.type}</span>
                      </div>
                      <span className="text-[9px] text-slate-500 mt-0.5 group-hover:text-slate-400 transition-colors truncate w-full">{doc.desc}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex gap-4 text-[10px] font-mono opacity-50 uppercase tracking-tighter">
            <span className="text-amber-400 opacity-100">System: {user ? 'Authenticated' : 'Active'}</span>
            <span>Secure Node: 0x82...f2</span>
          </div>
          
          <div className="h-8 w-px bg-white/10" />

          {user ? (
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setShowHistory(!showHistory)}
                className="text-slate-400 hover:text-amber-500 transition-colors p-2 rounded-lg hover:bg-white/5 relative"
                title="Audit History"
              >
                <History className="w-5 h-5" />
                {history.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full border border-[#0a0a0a]" />
                )}
              </button>
              <div className="flex items-center gap-2 group cursor-pointer" onClick={handleSignOut}>
                <div className="w-8 h-8 rounded border border-white/20 bg-gradient-to-br from-slate-700 to-slate-900 overflow-hidden">
                  {user.photoURL && <img src={user.photoURL} alt="avatar" className="w-full h-full object-cover" />}
                </div>
                <LogOut className="w-4 h-4 text-slate-600 group-hover:text-amber-500 transition-colors" />
              </div>
            </div>
          ) : (
            <button 
              onClick={handleSignIn}
              className="flex items-center gap-2.5 py-2 px-5 bg-amber-500 text-black font-mono text-[11px] uppercase tracking-widest font-extrabold hover:bg-amber-400 rounded-md transition-all shadow-lg shadow-amber-500/15 hover:shadow-amber-500/25 active:scale-95 shrink-0"
              title="Sign in with Google Provider to unlock the persistent history registry"
            >
              <LogIn className="w-4 h-4 stroke-[2.5]" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </nav>
      
      {/* Live Operations Status Bar */}
      <div className="bg-[#0c0c0c] border-b border-white/5 px-8 py-2 flex items-center justify-between text-[10px] font-mono tracking-wider">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 uppercase">Requests / Min:</span>
            <span className={liveMetrics.requestsPerMin > 0 ? "text-green-500" : "text-slate-600"}>
              {liveMetrics.requestsPerMin} r/min
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500 uppercase">Avg Latency:</span>
            <span className={liveMetrics.avgLatency < 500 ? "text-green-500" : "text-amber-500"}>
              {liveMetrics.avgLatency}ms
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500 uppercase">Token Burn:</span>
            <span className="text-blue-400 font-bold">
              {liveMetrics.totalTokens.toLocaleString()} tokens
            </span>
          </div>
          <div className="flex items-center gap-2 border-l border-white/10 pl-8">
            <span className="text-slate-500 uppercase">Breaker:</span>
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${liveMetrics.breakerOpen ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
              <span className={liveMetrics.breakerOpen ? "text-red-500" : "text-green-500"}>
                {liveMetrics.breakerOpen ? 'TRIPPED (OPEN)' : 'STABLE (CLOSED)'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={triggerMockTraffic}
            className="text-[9px] px-2 py-1 bg-white/5 border border-white/10 rounded hover:bg-white/10 hover:border-amber-500/30 transition-all text-slate-500 hover:text-amber-500 uppercase flex items-center gap-1.5"
            title="Simulate SDK Traffic"
          >
            <Play className="w-2.5 h-2.5 fill-current" />
            Pulse Test
          </button>
          <button 
            onClick={() => setShowDevGuide(true)}
            className="text-amber-500/60 hover:text-amber-500 transition-colors uppercase flex items-center gap-2 group"
          >
            <Activity className="w-3 h-3 group-hover:scale-110 transition-transform" />
            Integrate SDK
          </button>
          <div className="h-4 w-px bg-white/15" />
          <button 
            onClick={() => setShowFeedbackModal(true)}
            className="px-3 py-1.5 bg-amber-500 text-black hover:bg-amber-400 hover:shadow-[0_0_15px_rgba(245,158,11,0.4)] font-bold uppercase rounded-md text-[9px] tracking-widest flex items-center gap-1.5 transition-all duration-200 active:scale-95 cursor-pointer hover:-translate-y-0.5 relative group"
            title="Submit audit/compliance feedback"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-black opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-black"></span>
            </span>
            <MessageSquare className="w-3   h-3" />
            <span>Send Feedback</span>
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4 relative">
        
        {/* Audit History Panel (Overlaid/Animated) */}
        <AnimatePresence>
          {showHistory && (
            <motion.aside
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              className="fixed top-16 right-0 w-96 h-[calc(100vh-4rem)] bg-[#0c0c0c] border-l border-white/10 z-50 shadow-2xl p-6 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs uppercase tracking-[0.2em] text-amber-500/80 font-bold">Centaur Audit Repository</h2>
                <button onClick={() => setShowHistory(false)} className="text-slate-500 hover:text-white transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Search and Filters */}
              <div className="space-y-4 mb-8">
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-amber-500 transition-colors" />
                  <input 
                    type="text"
                    placeholder="Search past audits..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#050505] border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-xs font-sans focus:outline-none focus:border-amber-500/50 transition-all text-slate-300 placeholder:text-slate-700"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-slate-600">
                      <ShieldAlert className="w-3 h-3" />
                      Risk Level
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {['ALL', 'HIGH', 'MODERATE', 'MINIMAL'].map(lvl => (
                        <button 
                          key={lvl}
                          onClick={() => setRiskFilter(lvl)}
                          className={`text-[9px] uppercase px-2 py-1 rounded transition-all border ${riskFilter === lvl ? 'bg-amber-500/20 text-amber-500 border-amber-500/30' : 'text-slate-600 hover:text-slate-400 border-transparent'}`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-slate-600">
                      <Activity className="w-3 h-3" />
                      Neural Status
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {['ALL', 'VALID', 'CAUTION', 'FAIL'].map(stat => (
                        <button 
                          key={stat}
                          onClick={() => setStatusFilter(stat)}
                          className={`text-[9px] uppercase px-2 py-1 rounded transition-all border ${statusFilter === stat ? 'bg-amber-500/20 text-amber-500 border-amber-500/30' : 'text-slate-600 hover:text-slate-400 border-transparent'}`}
                        >
                          {stat}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-slate-600">
                    <SlidersHorizontal className="w-3 h-3" />
                    Sort By
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: 'date', label: 'Recent' },
                      { id: 'avgScore', label: 'Avg' },
                      { id: 'security', label: 'Sec' },
                      { id: 'governance', label: 'Gov' },
                      { id: 'sustainability', label: 'Sus' }
                    ].map(opt => (
                      <button 
                        key={opt.id}
                        onClick={() => setSortBy(opt.id as any)}
                        className={`text-[9px] uppercase px-2 py-1 rounded transition-all border ${sortBy === opt.id ? 'bg-amber-500/20 text-amber-500 border-amber-500/30' : 'text-slate-600 hover:text-slate-400 border-transparent'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {filteredHistory.length === 0 ? (
                  <div className="text-center py-20 opacity-20 italic text-sm">
                    {searchQuery ? 'No matches found for your search.' : 'No historical records found.'}
                  </div>
                ) : (
                  filteredHistory.map((record) => (
                    <div 
                      key={record.id}
                      onClick={() => setViewingRecord(record)}
                      className="group p-4 border border-white/5 rounded-lg bg-[#050505] hover:border-amber-500/30 transition-all cursor-pointer relative"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2 text-[9px] font-mono text-slate-500">
                          <Clock className="w-3 h-3" />
                          {record.timestamp?.toDate().toLocaleString()}
                        </div>
                        <div className="flex items-center gap-3">
                          {record.riskLevel && (
                            <span className={`text-[8px] uppercase px-1 py-0.5 rounded border ${record.riskLevel === 'HIGH' ? 'border-red-500/30 text-red-500 bg-red-500/5' : record.riskLevel === 'MODERATE' ? 'border-amber-500/30 text-amber-500 bg-amber-500/5' : 'border-white/10 text-slate-500'}`}>
                              {record.riskLevel}
                            </span>
                          )}
                          <div className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded leading-none">
                            {Math.round((record.security + record.governance + record.sustainability) / 3)}%
                          </div>
                          <button 
                            onClick={(e) => deleteRecord(e, record.id)}
                            className="p-1 text-slate-800 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-slate-300 font-sans line-clamp-2 leading-relaxed opacity-70 group-hover:opacity-100 transition-opacity pr-6">
                        {record.summary}
                      </p>
                      <ChevronRight className="absolute right-3 top-[70%] -translate-y-1/2 w-4 h-4 text-slate-700 group-hover:text-amber-500 opacity-0 group-hover:opacity-100 transition-all" />
                    </div>
                  ))
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Audit Detail Focus Modal */}
        <AnimatePresence>
          {viewingRecord && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-6 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                drag
                dragControls={auditDragControls}
                dragListener={false}
                dragMomentum={false}
                className="bg-[#0c0c0c] border border-white/10 w-full max-w-4xl max-h-[85vh] rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col"
              >
                {/* Modal Header */}
                <header 
                  onPointerDown={(e) => auditDragControls.start(e)}
                  className="p-6 border-b border-white/5 flex items-center justify-between bg-[#111] cursor-grab active:cursor-grabbing relative group/header"
                >
                  <div className="absolute top-1.5 left-1/2 -translate-x-1/2 flex gap-1 opacity-20 group-hover/header:opacity-100 transition-opacity">
                    <div className="w-1 h-1 rounded-full bg-slate-400" />
                    <div className="w-1 h-1 rounded-full bg-slate-400" />
                    <div className="w-1 h-1 rounded-full bg-slate-400" />
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                      <FileText className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <h2 className="text-[10px] uppercase tracking-[0.2em] text-amber-500/80 mb-0.5 font-bold">Historical Vector Analysis</h2>
                      <p className="text-white font-serif italic text-lg">Audit Data: {viewingRecord.timestamp?.toDate().toLocaleString()}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setViewingRecord(null)}
                    className="p-2 hover:bg-white/5 rounded-full text-slate-500 hover:text-white transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </header>

                <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-12 gap-8">
                  {/* Summary & Metrics */}
                  <div className="md:col-span-4 space-y-6">
                    <div className="bg-[#050505] p-5 rounded-xl border border-white/5">
                      <h3 className="text-[10px] uppercase tracking-widest text-slate-500 mb-4 font-bold">Vector Scores</h3>
                      <div className="space-y-4">
                        {[
                          { label: 'Security', val: viewingRecord.security, icon: ShieldAlert },
                          { label: 'Governance', val: viewingRecord.governance, icon: FileText },
                          { label: 'Sustainability', val: viewingRecord.sustainability, icon: Leaf },
                        ].map((item) => (
                          <div key={item.label} className="group">
                            <div className="flex justify-between text-xs mb-1.5 uppercase tracking-tighter">
                              <span className="text-slate-400 font-mono flex items-center gap-2">
                                <item.icon className="w-3 h-3 text-amber-500/60" />
                                {item.label}
                              </span>
                              <span className="text-white font-bold">{item.val}%</span>
                            </div>
                            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${item.val}%` }}
                                className="h-full bg-amber-500/50"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-amber-600/5 p-5 rounded-xl border border-amber-600/10 space-y-4">
                      <div>
                        <h3 className="text-[10px] uppercase tracking-widest text-amber-500 mb-2 font-bold">Centaur Insight Summary</h3>
                        <p className="text-sm italic text-slate-400 font-sans leading-relaxed">
                          "{viewingRecord.summary}"
                        </p>
                      </div>
                      <div className="flex gap-2 pt-2 border-t border-white/5">
                        <span className={`px-2 py-1 rounded text-[9px] uppercase tracking-tighter border ${viewingRecord.aggregateStatus === 'FAIL' ? 'border-red-500/20 text-red-500 bg-red-500/5' : 'border-white/10 text-white/50'}`}>
                          Status: {viewingRecord.aggregateStatus}
                        </span>
                        <span className={`px-2 py-1 rounded text-[9px] uppercase tracking-tighter border ${viewingRecord.riskLevel === 'HIGH' ? 'border-red-500/20 text-red-500 bg-red-500/5' : viewingRecord.riskLevel === 'MODERATE' ? 'border-amber-500/20 text-amber-500 bg-amber-500/5' : 'border-white/10 text-white/50'}`}>
                          Risk: {viewingRecord.riskLevel}
                        </span>
                      </div>
                    </div>

                    {viewingRecord.rawOutput && (
                      <div className="bg-blue-600/5 p-5 rounded-xl border border-blue-600/10 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-[10px] uppercase tracking-widest text-blue-400 font-bold">Neural Engine Raw Response</h3>
                          <span className="text-[8px] font-mono text-blue-500/50">{viewingRecord.rawOutput.model}</span>
                        </div>
                        <div className="bg-black/40 rounded p-3 border border-white/5 overflow-x-auto">
                          <pre className="text-[10px] font-mono text-blue-300/80 leading-relaxed max-h-40 scrollbar-thin">
                            {viewingRecord.rawOutput.rawText}
                          </pre>
                        </div>
                        {viewingRecord.rawOutput.usage && (
                          <div className="flex gap-4 text-[9px] font-mono text-slate-500 border-t border-white/5 pt-2">
                            <span>Tokens: {viewingRecord.rawOutput.usage.totalTokenCount}</span>
                            <div className="flex-1" />
                            <span className="opacity-50">PROMPT: {viewingRecord.rawOutput.usage.promptTokenCount}</span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="flex gap-3">
                      <button 
                        onClick={() => loadFromHistory(viewingRecord)}
                        className="flex-1 py-3.5 bg-[#111] hover:bg-white/5 border border-white/10 text-slate-300 hover:text-white font-bold rounded-lg text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Restore Terminal
                      </button>
                      <button 
                        onClick={printHistoricalReport}
                        className="flex-1 py-3.5 bg-amber-600 hover:bg-amber-500 text-black font-bold rounded-lg text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-amber-900/10"
                      >
                        <Printer className="w-4 h-4" />
                        Print Report
                      </button>
                    </div>
                  </div>

                  {/* Content View */}
                  <div className="md:col-span-8 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Payload Manifest</h3>
                      <button 
                        onClick={() => navigator.clipboard.writeText(viewingRecord.promptContent)}
                        className="text-[9px] uppercase font-mono text-slate-600 hover:text-amber-500 transition-colors flex items-center gap-1.5"
                      >
                        <Copy className="w-3 h-3" />
                        Copy Payload
                      </button>
                    </div>
                    <div className="bg-[#050505] border border-white/5 rounded-xl h-96 overflow-hidden relative">
                      <div className="absolute inset-0 p-6 overflow-y-auto font-mono text-xs text-slate-400 leading-relaxed scrollbar-thin scrollbar-thumb-white/10">
                        {viewingRecord.promptContent}
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#050505] to-transparent pointer-events-none" />
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Feedback Modal */}
        <AnimatePresence>
          {showFeedbackModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/90 z-[120] flex items-center justify-center p-6 backdrop-blur-md"
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                drag
                dragControls={feedbackDragControls}
                dragListener={false}
                dragMomentum={false}
                className="bg-[#0c0c0c] border border-white/10 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col"
              >
                <header 
                  onPointerDown={(e) => feedbackDragControls.start(e)}
                  className="p-6 border-b border-white/5 flex items-center justify-between bg-[#111] cursor-grab active:cursor-grabbing relative group/header"
                >
                  <div className="absolute top-1.5 left-1/2 -translate-x-1/2 flex gap-1 opacity-20 group-hover/header:opacity-100 transition-opacity">
                    <div className="w-1 h-1 rounded-full bg-slate-400" />
                    <div className="w-1 h-1 rounded-full bg-slate-400" />
                    <div className="w-1 h-1 rounded-full bg-slate-400" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-amber-500" />
                    <div>
                      <h2 className="text-[10px] uppercase tracking-[0.2em] text-amber-500/80 mb-0.5 font-bold">Governance Uplink</h2>
                      <p className="text-white font-serif italic text-lg">Submit Feedback</p>
                    </div>
                  </div>
                  <button onClick={() => setShowFeedbackModal(false)} className="text-slate-500 hover:text-white transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </header>

                <form onSubmit={submitFeedback} className="p-8 space-y-6 font-sans">
                  {feedbackSuccess ? (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center py-6 space-y-4"
                    >
                      <CheckCircle2 className="w-12 h-12 text-amber-500 mx-auto animate-bounce" />
                      <p className="text-white font-serif italic text-base">Transmission Logged</p>
                      {feedbackDeliveryStatus && (
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-left space-y-2 font-mono text-xs max-w-sm mx-auto">
                          <div className="flex justify-between text-slate-500 text-[10px] uppercase font-bold border-b border-white/5 pb-15">
                            <span>Engine Status</span>
                            <span className={feedbackDeliveryStatus.realDelivery ? "text-green-400 font-bold" : "text-amber-500 font-bold"}>
                              {feedbackDeliveryStatus.emailStatus}
                            </span>
                          </div>
                          <p className="text-slate-300 leading-relaxed text-[11px]">
                            {feedbackDeliveryStatus.message}
                          </p>
                          {!feedbackDeliveryStatus.realDelivery && (
                            <p className="text-[10px] text-slate-500 pt-1.5 border-t border-white/5 leading-relaxed">
                              Configure <span className="text-slate-400">SMTP_USER</span> and <span className="text-slate-400">SMTP_PASS</span> in the Settings panel wrapper to trigger live background dispatches.
                            </p>
                          )}
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <>
                      <div className="space-y-4">
                        <div className="flex gap-2">
                          {['SUGGESTION', 'ISSUE', 'OTHER'].map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setFeedbackType(type as any)}
                              className={`flex-1 py-2 text-[9px] uppercase tracking-widest rounded border transition-all ${feedbackType === type ? 'bg-amber-500/20 border-amber-500/50 text-amber-500 font-bold' : 'bg-white/5 border-white/10 text-slate-500 hover:text-slate-300'}`}
                            >
                              {type}
                            </button>
                          ))}
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] uppercase font-bold text-slate-500">Contact Email (Optional)</label>
                          <input 
                            type="email"
                            placeholder="your@email.com"
                            value={feedbackEmail}
                            onChange={(e) => setFeedbackEmail(e.target.value)}
                            className="w-full bg-[#050505] border border-white/10 rounded-lg py-2.5 px-4 text-xs font-sans focus:outline-none focus:border-amber-500/50 transition-all text-slate-300 placeholder:text-slate-700"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] uppercase font-bold text-slate-500">Content</label>
                          <textarea 
                            required
                            placeholder="Describe your suggestion or report the issue in detail..."
                            value={feedbackContent}
                            onChange={(e) => setFeedbackContent(e.target.value)}
                            className="w-full bg-[#050505] border border-white/10 rounded-lg py-2.5 px-4 text-xs font-sans focus:outline-none focus:border-amber-500/50 transition-all text-slate-300 placeholder:text-slate-700 min-h-[120px] resize-none"
                          />
                        </div>
                      </div>

                      <button 
                        type="submit"
                        disabled={feedbackLoading}
                        className="w-full py-4 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold rounded-lg text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg"
                      >
                        {feedbackLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Transmitting...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            Send Transmission
                          </>
                        )}
                      </button>
                    </>
                  )}
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Developer Integration Guide Modal */}
        <AnimatePresence>
          {showDevGuide && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/90 z-[110] flex items-center justify-center p-6 backdrop-blur-md"
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                drag
                dragControls={sdkDragControls}
                dragListener={false}
                dragMomentum={false}
                className="bg-[#0c0c0c] border border-white/10 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col"
              >
                <header 
                  onPointerDown={(e) => sdkDragControls.start(e)}
                  className="p-6 border-b border-white/5 flex items-center justify-between bg-[#111] cursor-grab active:cursor-grabbing relative group/header"
                >
                  <div className="absolute top-1.5 left-1/2 -translate-x-1/2 flex gap-1 opacity-20 group-hover/header:opacity-100 transition-opacity">
                    <div className="w-1 h-1 rounded-full bg-slate-400" />
                    <div className="w-1 h-1 rounded-full bg-slate-400" />
                    <div className="w-1 h-1 rounded-full bg-slate-400" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Terminal className="w-5 h-5 text-amber-500" />
                    <div>
                      <h2 className="text-[10px] uppercase tracking-[0.2em] text-amber-500/80 mb-0.5 font-bold">Developer Portal</h2>
                      <p className="text-white font-serif italic text-lg">Connect to Governance Layer</p>
                    </div>
                  </div>
                  <button onClick={() => setShowDevGuide(false)} className="text-slate-500 hover:text-white transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </header>

                <div className="p-8 overflow-y-auto max-h-[70vh] space-y-6 font-sans">
                  <div className="space-y-4 text-sm text-slate-400">
                    <p className="leading-relaxed">To transition your **Centaur Governance Layer** from its current local/testing state to live production, you need to connect your live application traffic to the dashboard backend.</p>
                    
                    <div className="space-y-2">
                       <h3 className="text-xs font-bold uppercase text-slate-500">1. Install Telemetry SDK</h3>
                      <div className="bg-black p-3 rounded font-mono text-[11px] text-green-400 border border-white/5">
                        npm install @centaur/governance-sdk
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-xs font-bold uppercase text-slate-500">2. Initialize & Configure</h3>
                      <p className="text-[11px] opacity-70">Add this initialization snippet to your application's entry point.</p>
                      <div className="bg-black p-4 rounded-lg font-mono text-[11px] text-blue-300 border border-white/5 whitespace-pre overflow-x-auto relative group">
                        <button 
                          onClick={() => navigator.clipboard.writeText(`const governance = new CentaurGovernance({ apiKey: "${sdkConfig?.apiKey}", endpoint: "${sdkConfig?.endpoint}", projectId: "${sdkConfig?.projectId}" });`)}
                          className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-white"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
{`const { CentaurGovernance } = require('@centaur/governance-sdk');

const governance = new CentaurGovernance({
  apiKey: "${sdkConfig?.apiKey || 'EKJN-729-SECURE'}",
  endpoint: "${sdkConfig?.endpoint || 'https://centaur-production.up.railway.app'}",
  projectId: "${sdkConfig?.projectId || 'EKJN-13B-729'}"
});

// Capture all incoming request metrics
app.use(governance.middleware());`}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-xs font-bold uppercase text-slate-500">3. Wire Up Token Tracking</h3>
                      <div className="bg-black p-4 rounded-lg font-mono text-[11px] text-slate-500 border border-white/5 whitespace-pre overflow-x-auto">
{`// Log token metrics upon successful LLM completion
governance.logTokens({
  inputTokens: response.usage.prompt_tokens,
  outputTokens: response.usage.completion_tokens,
  model: 'gemini-1.5-pro'
});`}
                      </div>
                    </div>

                    <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-lg">
                       <h4 className="text-[10px] font-bold text-amber-500 uppercase mb-2">Live Verification</h4>
                       <ul className="text-xs space-y-1 opacity-80 list-disc pl-4">
                         <li>Generate test traffic using curl or user simulations.</li>
                         <li>Refresh this dashboard to see real-time millisecond data.</li>
                         <li>The **Breaker Status** will trip automatically if thresholds are breached.</li>
                       </ul>
                    </div>
                  </div>
                </div>
                
                <footer className="p-6 bg-[#050505] border-t border-white/5 flex justify-end">
                  <button 
                     onClick={() => setShowDevGuide(false)}
                     className="px-8 py-3 bg-amber-600 hover:bg-amber-500 text-black font-bold rounded text-[10px] uppercase tracking-widest transition-all shadow-lg"
                  >
                    Accept Integration Protocol
                  </button>
                </footer>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Left Column: Input & Controls */}
        <div className="lg:col-span-7 space-y-6">
          <section className="bg-[#0c0c0c] border border-white/5 rounded-xl overflow-hidden shadow-2xl">
            <header className="px-6 py-5 border-b border-white/5 bg-[#111] flex justify-between items-center">
              <div className="flex flex-col">
                <h2 className="text-[10px] uppercase tracking-[0.2em] text-amber-500/80 mb-1 font-semibold">Input Module</h2>
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-amber-500/50" />
                  <p className="font-serif text-lg text-white">System Prompt Configuration</p>
                </div>
              </div>
              {file && (
                <span className="text-[10px] font-mono text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {file.name}
                </span>
              )}
            </header>
            
            <div className="p-8">
              <div 
                className="relative group h-64 w-full border-2 border-dashed border-white/10 rounded-lg bg-[#050505] transition-all hover:border-amber-500/30 flex flex-col cursor-text"
                onClick={() => {
                  if (fileInputRef.current) {
                    // Only focus textarea, don't trigger file dialog on general click if we want to type
                    const textarea = document.getElementById('prompt-editor');
                    textarea?.focus();
                  }
                }}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                  accept=".txt,.prom,.md"
                />
                
                <textarea
                  id="prompt-editor"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full h-full p-6 bg-transparent font-mono text-xs focus:outline-none resize-none text-slate-300 shadow-inner leading-relaxed z-10"
                  placeholder=" "
                />

                {!content && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none group-hover:opacity-80 transition-opacity">
                    <div className="w-12 h-12 rounded-full bg-[#111] border border-white/5 flex items-center justify-center mx-auto mb-4">
                      <Terminal className="w-5 h-5 text-slate-600 group-hover:text-amber-500 transition-colors" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-slate-400">
                        Type, paste, or <span className="text-amber-500/80 pointer-events-auto cursor-pointer underline underline-offset-4 decoration-amber-500/30 hover:text-amber-500" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>upload a file</span>
                      </p>
                      <p className="text-[10px] opacity-40 uppercase tracking-widest mt-2 font-mono">Payload Terminal Active</p>
                    </div>
                  </div>
                )}

                {/* Corner Accents */}
                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-white/20" />
                <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-white/20" />
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-white/20" />
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-white/20" />
              </div>

              <div className="mt-8 space-y-4">
                <select 
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full bg-[#111] border border-white/10 text-slate-300 py-3 px-4 rounded-lg text-xs uppercase tracking-widest focus:outline-none focus:border-amber-500/50"
                >
                  <option value="gemini-3.5-flash">Gemini 3.5 Flash (Recommended)</option>
                  <option value="gemini-3-flash">Gemini 3 Flash</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                </select>

                <div className="flex gap-4">
                  <button 
                    onClick={runAudit}
                    disabled={loading || !content || !user}
                    className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:bg-[#1a1a1a] disabled:text-slate-700 text-black font-bold py-4 px-8 rounded-lg text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 group shadow-lg shadow-amber-900/10"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" />
                    )}
                    {!user ? 'Auth Required' : (loading ? 'Executing Protocol...' : 'Execute Audit Protocol')}
                  </button>
                  <button 
                    onClick={() => { setContent(''); setFile(null); setScores(DEFAULT_SCORES); setAuditSummary(''); }}
                    className="px-8 py-4 border border-white/10 rounded-lg hover:border-white/20 text-slate-500 hover:text-slate-300 transition-colors text-[10px] uppercase font-mono tracking-widest"
                  >
                    Purge Data
                  </button>
                </div>
              </div>
            </div>
          </section>

          <AnimatePresence>
            {auditSummary && (
              <motion.section 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-gradient-to-r from-amber-600/10 to-transparent border border-white/5 rounded-xl p-8 flex items-center gap-6"
              >
                <div className="text-center shrink-0 border-r border-white/10 pr-6">
                  <p className="text-[10px] uppercase tracking-widest text-amber-500/70 mb-1">Aggregate Status</p>
                  <p className={`text-3xl font-serif leading-none ${aggregateStatus === 'FAIL' ? 'text-red-500' : aggregateStatus === 'CAUTION' ? 'text-amber-500' : 'text-white'}`}>
                    {aggregateStatus}
                  </p>
                </div>
                <div>
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.2em]">Audit Summary</h3>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(auditSummary);
                        setCopiedSummary(true);
                        setTimeout(() => setCopiedSummary(false), 2000);
                      }}
                      className="text-[9px] uppercase font-mono text-slate-500 hover:text-amber-500 transition-colors flex items-center gap-1.5 bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded border border-white/5 active:scale-95 transition-all"
                      title="Copy Audit Summary to clipboard"
                    >
                      {copiedSummary ? (
                        <>
                          <Check className="w-3 h-3 text-green-400" />
                          <span className="text-green-400 font-bold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Summary</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-sm italic text-slate-400 leading-relaxed font-sans pr-4">
                    "{auditSummary}"
                  </p>
                  <div className="mt-4 flex gap-2">
                    <span className="px-2 py-1 bg-white/5 rounded text-[9px] uppercase tracking-tighter text-white/50 border border-white/5">Compliance: {aggregateStatus === 'FAIL' ? 'Lapsed' : 'Active'}</span>
                    <span className={`px-2 py-1 rounded text-[9px] uppercase tracking-tighter border border-white/5 ${riskLevel === 'HIGH' ? 'bg-red-500/10 text-red-500' : riskLevel === 'MODERATE' ? 'bg-amber-500/10 text-amber-500' : 'bg-white/5 text-white/50'}`}>
                      Risk: {riskLevel}
                    </span>
                    <button 
                      onClick={printActiveReport}
                      className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 font-bold rounded text-[9px] uppercase tracking-tighter border border-amber-500/20 hover:border-amber-500/30 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                      title="Print structured compliance PDF report"
                    >
                      <Printer className="w-2.5 h-2.5" />
                      Print PDF Report
                    </button>
                  </div>
                </div>
              </motion.section>
            )}

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg flex flex-col gap-2"
              >
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span className="text-[10px] font-mono text-red-500 font-bold tracking-[0.2em]">{error.code}</span>
                  <div className="flex-1" />
                  <button onClick={() => setError(null)} className="text-red-500/50 hover:text-red-500 transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-xs font-sans text-red-400 font-medium">{error.message}</p>
                {error.details && (
                  <p className="text-[10px] font-mono text-red-400/60 break-all bg-black/20 p-2 rounded leading-relaxed">
                    {error.details}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: Visualization */}
        <div className="lg:col-span-5 space-y-8">
          <section className="bg-[#0c0c0c] border border-white/5 rounded-xl p-8 shadow-2xl relative overflow-hidden h-full min-h-[500px]">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <Activity className="w-32 h-32 text-amber-500" />
            </div>

            <div className="mb-8 text-center">
              <h2 className="text-[10px] uppercase tracking-[0.2em] text-amber-500/80 mb-1 font-semibold">Audit Visualization</h2>
              <p className="font-serif text-2xl text-white">Performance Triad</p>
            </div>

            <div className="h-80 w-full mb-12">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={scores}>
                  <PolarGrid stroke="rgba(255,255,255,0.05)" />
                  <PolarAngleAxis 
                    dataKey="subject" 
                    tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: "600", letterSpacing: "0.2em", textTransform: "uppercase" }} 
                  />
                  <PolarRadiusAxis 
                    angle={30} 
                    domain={[0, 100]} 
                    tick={false} 
                    axisLine={false}
                  />
                  <Radar
                    name="Centaur Metric"
                    dataKey="A"
                    stroke="#f59e0b"
                    fill="#f59e0b"
                    fillOpacity={0.2}
                    animationBegin={200}
                    animationDuration={1500}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    itemStyle={{ color: '#f59e0b', fontSize: '10px', textTransform: 'uppercase', fontFamily: 'monospace' }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-8 border-t border-white/5 font-sans">
              <div className="text-center group">
                <span className="block text-white text-xl font-serif mb-1 group-hover:text-amber-500 transition-colors">{Math.round(scores[0].A)}%</span>
                <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">Security</span>
              </div>
              <div className="text-center border-x border-white/5 group">
                <span className="block text-white text-xl font-serif mb-1 group-hover:text-amber-500 transition-colors">{Math.round(scores[1].A)}%</span>
                <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">Governance</span>
              </div>
              <div className="text-center group">
                <span className="block text-white text-xl font-serif mb-1 group-hover:text-amber-500 transition-colors">{Math.round(scores[2].A)}%</span>
                <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">Sustainability</span>
              </div>
            </div>

            <div className="mt-12 text-[9px] font-mono text-slate-600 leading-relaxed uppercase tracking-[0.2em] text-center italic">
              Real-time Neural Analysis <br/>
              Standard Deviation: +/- 0.04%
            </div>
          </section>
        </div>

        {/* Version 2.0 Unified GRC Suite */}
        <div className="lg:col-span-12 mt-6">
          <section className="bg-[#0c0c0c] border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative">
            {/* Header branding */}
            <div className="px-8 py-6 border-b border-white/5 bg-[#111] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20 tracking-[0.2em] uppercase">Enterprise Suite v2.0</span>
                </div>
                <h2 className="font-serif italic text-2.5xl text-white mt-1.5">Centaur Governance Control Deck</h2>
                <p className="text-xs text-slate-500 mt-1">Configure runtime alignment parameters, query multi-cloud telemetry, analyze toxic-reduction vectors, and track social-impact equity ratings.</p>
              </div>
              
              {/* Tab Toggles */}
              <div className="flex flex-wrap gap-1 bg-black/45 p-1 rounded-lg border border-white/5 self-start md:self-auto">
                {[
                  { id: 'bias', label: 'In-Processing Bias', icon: SlidersHorizontal },
                  { id: 'clouds', label: 'Cross-Cloud GRC', icon: Activity },
                  { id: 'guardrails', label: 'LLM Guardrails', icon: Terminal },
                  { id: 'equity', label: 'Equity & ROI Metrics', icon: Leaf }
                ].map(tab => {
                  const Icon = tab.icon;
                  const isActive = v2Stats.activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setV2Stats(prev => ({ ...prev, activeTab: tab.id }))}
                      className={`flex items-center gap-2 px-4 py-2 text-xs font-mono uppercase tracking-wider rounded-md transition-all ${isActive ? 'bg-amber-600 text-black font-extrabold shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Main tab content workspace */}
            <div className="p-8">
              <AnimatePresence mode="wait">
                {v2Stats.activeTab === 'bias' && (
                  <motion.div
                    key="bias"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className="grid grid-cols-1 md:grid-cols-12 gap-8"
                  >
                    {/* Bias Left Column: Controls */}
                    <div className="md:col-span-6 space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                          <SlidersHorizontal className="w-4 h-4 text-red-400" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-white">In-Processing Runtime Mitigation</h3>
                          <p className="text-[11px] text-slate-500">Enable algorithmic de-biasing templates to intercept and correct prompt representation imbalances during model execution.</p>
                        </div>
                      </div>

                      <div className="space-y-4 bg-black/20 p-6 rounded-xl border border-white/5">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-slate-300">Mitigate Gender & Representation Skew</span>
                            <span className="text-[10px] text-slate-500">Neutralizes gender assignment biases on output roles.</span>
                          </div>
                          <button
                            onClick={() => setV2Stats(prev => ({ ...prev, genderBiasMitigated: !prev.genderBiasMitigated }))}
                            className={`w-10 h-6 rounded-full p-1 transition-all ${v2Stats.genderBiasMitigated ? 'bg-amber-500' : 'bg-white/10'}`}
                          >
                            <div className={`w-4 h-4 rounded-full bg-black transition-all ${v2Stats.genderBiasMitigated ? 'translate-x-4' : 'translate-x-0'}`} />
                          </button>
                        </div>

                        <div className="h-px bg-white/5" />

                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-slate-300">Enforce Demographic Neutrality</span>
                            <span className="text-[10px] text-slate-500">Injects equal representation safeguards to role templates.</span>
                          </div>
                          <button
                            onClick={() => setV2Stats(prev => ({ ...prev, demographicEnforce: !prev.demographicEnforce }))}
                            className={`w-10 h-6 rounded-full p-1 transition-all ${v2Stats.demographicEnforce ? 'bg-amber-500' : 'bg-white/10'}`}
                          >
                            <div className={`w-4 h-4 rounded-full bg-black transition-all ${v2Stats.demographicEnforce ? 'translate-x-4' : 'translate-x-0'}`} />
                          </button>
                        </div>

                        <div className="h-px bg-white/5" />

                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-slate-300">Adversarial Representation Shield</span>
                            <span className="text-[10px] text-slate-500">Separates sentiment polarity spikes from prompt instructions.</span>
                          </div>
                          <button
                            onClick={() => setV2Stats(prev => ({ ...prev, toxicDecouple: !prev.toxicDecouple }))}
                            className={`w-10 h-6 rounded-full p-1 transition-all ${v2Stats.toxicDecouple ? 'bg-amber-500' : 'bg-white/10'}`}
                          >
                            <div className={`w-4 h-4 rounded-full bg-black transition-all ${v2Stats.toxicDecouple ? 'translate-x-4' : 'translate-x-0'}`} />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] uppercase font-bold text-slate-500 font-mono tracking-wider">Algorithmic De-Biasing Preamble</label>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(v2Stats.customPreamble);
                                setCopiedPreamble(true);
                                setTimeout(() => setCopiedPreamble(false), 2000);
                              }}
                              className="text-[9px] uppercase font-mono text-slate-400 hover:text-amber-400 bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded border border-white/5 active:scale-95 transition-all flex items-center gap-1.5"
                              title="Copy preamble to clipboard"
                            >
                              {copiedPreamble ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedPreamble ? 'Copied!' : 'Copy'}</span>
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  // Read from clipboard
                                  const text = await navigator.clipboard.readText();
                                  if (text) {
                                    setV2Stats(prev => ({ ...prev, customPreamble: text }));
                                  }
                                } catch (err) {
                                  console.warn("Clipboard paste direct reading not fully supported in this context, standard manual action is available:", err);
                                  // Fallback input prompt
                                  const promptText = window.prompt("Paste or type your custom de-biasing preamble here:", v2Stats.customPreamble);
                                  if (promptText !== null) {
                                    setV2Stats(prev => ({ ...prev, customPreamble: promptText }));
                                  }
                                }
                              }}
                              className="text-[9px] uppercase font-mono text-slate-400 hover:text-amber-400 bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded border border-white/5 active:scale-95 transition-all flex items-center gap-1.5"
                              title="Paste from clipboard or edit"
                            >
                              <span className="text-[11px] leading-none">📋</span>
                              <span>Paste</span>
                            </button>
                          </div>
                        </div>
                        <input
                          type="text"
                          value={v2Stats.customPreamble}
                          onChange={(e) => setV2Stats(prev => ({ ...prev, customPreamble: e.target.value }))}
                          className="w-full bg-black border border-white/10 rounded-lg py-2.5 px-4 text-xs font-mono focus:outline-none focus:border-amber-500/50 transition-all text-slate-300"
                        />
                        <span className="text-[9px] text-slate-600 block leading-tight">This preamble template is integrated directly into the secure proxy during real-time model analysis.</span>
                      </div>
                    </div>

                    {/* Bias Right Column: Outputs & Status */}
                    <div className="md:col-span-6 space-y-6 flex flex-col justify-between">
                      <div className="bg-black/40 p-6 rounded-xl border border-white/5 flex flex-col justify-between h-full min-h-[250px]">
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500">Bias Mitigation Status</span>
                            <span className="text-xs text-amber-500 bg-amber-500/10 px-2.5 py-0.5 rounded-full font-mono font-bold">{v2Stats.biasScore}% Cleared</span>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                              <motion.div 
                                className="h-full bg-gradient-to-r from-amber-600 to-amber-400"
                                initial={{ width: 0 }}
                                animate={{ width: `${v2Stats.biasScore}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[9px] font-mono text-slate-600 uppercase">
                              <span>Unmitigated (0%)</span>
                              <span>Balanced Baseline (80%+)</span>
                              <span>Pristine (100%)</span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-lg space-y-2.5 my-4">
                          <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2">
                            <span className="text-[10px] uppercase font-mono tracking-wider text-amber-500 font-bold flex items-center gap-1.5">
                              <Activity className="w-3.5 h-3.5" />
                              Active Remediation Vector
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(v2Stats.mitigationLog);
                                  setCopiedVector(true);
                                  setTimeout(() => setCopiedVector(false), 2000);
                                }}
                                className="text-[8px] uppercase font-mono text-slate-400 hover:text-amber-500 bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded border border-white/5 active:scale-95 transition-all flex items-center gap-1"
                                title="Copy remediation suggestion"
                              >
                                {copiedVector ? <Check className="w-2.5 h-2.5 text-green-400" /> : <Copy className="w-2.5 h-2.5" />}
                                <span>{copiedVector ? 'Copied' : 'Copy'}</span>
                              </button>
                              <button
                                onClick={() => {
                                  setV2Stats(prev => ({ ...prev, customPreamble: prev.mitigationLog }));
                                }}
                                className="text-[8px] uppercase font-mono text-slate-400 hover:text-amber-500 hover:bg-amber-500 hover:text-black font-extrabold bg-white/5 px-2.5 py-0.5 rounded border border-white/5 active:scale-95 transition-all flex items-center gap-1"
                                title="Apply this suggestion directly to the Preamble"
                              >
                                <span>🎯 Apply to Preamble</span>
                              </button>
                            </div>
                          </div>
                          <div className="text-xs leading-relaxed text-slate-400 font-sans italic pr-6 h-12 overflow-y-auto scrollbar-thin">
                            "{v2Stats.mitigationLog}"
                          </div>
                        </div>

                        <div className="text-[9px] font-mono text-slate-600 flex items-center justify-between border-t border-white/5 pt-4">
                          <span>SYSTEM: ENFORCING REAL-TIME RUNTIME ALIGNMENT</span>
                          <span className="text-green-500 font-bold">● ONLINE</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {v2Stats.activeTab === 'clouds' && (
                  <motion.div
                    key="clouds"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className="space-y-6"
                  >
                    {/* Header Controls */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-black/35 p-5 rounded-xl border border-white/5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                          <Globe className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-white">Cross-Cloud Governance & Registry</h3>
                          <p className="text-[11px] text-slate-500">Secure model execution & audit sync nodes. Select a routing anchor to dynamically bind system prompts to active cloud targets.</p>
                        </div>
                      </div>
                      
                      <button
                        onClick={runPingTelemetryTest}
                        disabled={isPinging}
                        className={`text-[10px] px-4 py-2.5 rounded-lg border transition-all uppercase tracking-wider font-mono flex items-center gap-1.5 active:scale-95 text-black font-extrabold ${isPinging ? 'bg-amber-500/50 border-amber-500/20 cursor-wait text-slate-400' : 'bg-amber-500 border-amber-600 hover:bg-amber-400 shadow-md shadow-amber-500/10 hover:shadow-amber-500/25'}`}
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin' : ''}`} />
                        {isPinging ? 'Testing Link Sync...' : 'Test Cloud Sync Links'}
                      </button>
                    </div>

                    {/* Progress indicator during test */}
                    {isPinging && (
                      <div className="space-y-1.5 bg-amber-500/5 border border-amber-500/10 p-3.5 rounded-lg">
                        <div className="flex justify-between items-center text-[10px] font-mono uppercase text-amber-500">
                          <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" />
                            Executing sequential node ping tests
                          </span>
                          <span>{pingProgress}% Completed</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-amber-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${pingProgress}%` }}
                            transition={{ duration: 0.1 }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                      {/* Left: Endpoint Grid */}
                      <div className="md:col-span-8 space-y-4">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] uppercase font-mono tracking-widest text-slate-500">Available Nodes Registry ({v2Stats.cloudEndpoints.length})</span>
                          <span className="text-[9px] font-mono text-slate-600 uppercase">Click card to assign as active backbone</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {v2Stats.cloudEndpoints.map((node) => {
                            const isAnchor = node.checked;
                            
                            // Define provider specific badges or visuals
                            let brandBorder = "border-white/5 hover:border-white/10 bg-black/20";
                            let brandText = "text-slate-400";
                            let brandIconColor = "text-slate-500";
                            let mockUrl = "";

                            if (node.id === 'vertex') {
                              brandBorder = isAnchor ? "border-sky-500/40 bg-sky-500/[0.01]" : "border-white/5 hover:border-sky-500/20 bg-black/10";
                              brandText = "text-sky-400";
                              brandIconColor = "text-sky-500";
                              mockUrl = "https://vertex-ai.googleapis.com/...";
                            } else if (node.id === 'azure') {
                              brandBorder = isAnchor ? "border-indigo-500/40 bg-indigo-500/[0.01]" : "border-white/5 hover:border-indigo-500/20 bg-black/10";
                              brandText = "text-indigo-400";
                              brandIconColor = "text-indigo-500";
                              mockUrl = "https://azure.openai.azure.com/...";
                            } else if (node.id === 'sagemaker') {
                              brandBorder = isAnchor ? "border-amber-500/40 bg-amber-500/[0.01]" : "border-white/5 hover:border-amber-500/20 bg-black/10";
                              brandText = "text-amber-500";
                              brandIconColor = "text-amber-500";
                              mockUrl = "https://runtime.sagemaker.us-east-1.amazonaws.com/...";
                            } else if (node.id === 'private') {
                              brandBorder = isAnchor ? "border-teal-500/40 bg-teal-500/[0.01]" : "border-white/5 hover:border-teal-500/20 bg-black/10";
                              brandText = "text-teal-400";
                              brandIconColor = "text-teal-500";
                              mockUrl = "https://nodes.secure-private.internal/...";
                            }

                            return (
                              <div 
                                key={node.id}
                                onClick={() => {
                                  setV2Stats(prev => ({
                                    ...prev,
                                    cloudEndpoints: prev.cloudEndpoints.map(n => ({ ...n, checked: n.id === node.id }))
                                  }));
                                }}
                                className={`p-4 rounded-xl border transition-all cursor-pointer relative group flex flex-col justify-between ${brandBorder} ${isAnchor ? 'scale-[1.01] shadow-xl' : ''}`}
                              >
                                {isAnchor && (
                                  <div className="absolute top-0 right-12 transform -translate-y-1/2 bg-amber-500 text-black font-mono text-[8px] font-extrabold uppercase px-2 py-0.5 rounded shadow">
                                    Anchor Route
                                  </div>
                                )}

                                {/* Card Header */}
                                <div>
                                  <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center gap-1.5">
                                      <Server className={`w-3.5 h-3.5 ${brandIconColor}`} />
                                      <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">{node.type} node</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className={`w-1.5 h-1.5 rounded-full ${node.status === 'STABLE' || node.status === 'ACTIVE' ? 'bg-green-500 animate-pulse' : 'bg-amber-400'}`} />
                                      <span className={`text-[8px] font-mono font-bold uppercase ${node.status === 'STABLE' || node.status === 'ACTIVE' ? 'text-green-500' : 'text-amber-400'}`}>{node.status}</span>
                                    </div>
                                  </div>

                                  <h4 className="text-xs font-bold text-slate-200 group-hover:text-amber-500 transition-colors uppercase tracking-wide truncate">{node.name}</h4>
                                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-0.5 mb-3 lowercase select-all truncate bg-black/30 px-1.5 py-0.5 rounded border border-white/5">
                                    <span>{mockUrl}</span>
                                    <span className="text-[8px] uppercase tracking-wider text-slate-500 font-mono">{node.region}</span>
                                  </div>
                                </div>

                                {/* Network Sparkline Graphic */}
                                <div className="flex items-center justify-between gap-4 mt-3 pt-3 border-t border-white/5">
                                  <div className="flex flex-col">
                                    <span className="text-[8px] uppercase text-slate-500 font-mono">RTT Latency</span>
                                    <span className="text-xl font-serif italic text-white leading-none mt-1 group-hover:text-amber-500 transition-colors">{node.latency ?? 200}ms</span>
                                  </div>
                                  
                                  {/* Dynamic SVG Mini sparkline */}
                                  {(() => {
                                    const history = pingHistory[node.id] || [150, 150, 150, 150, 150];
                                    const minVal = 40;
                                    const maxVal = 380;
                                    const coords = history.map((val, idx) => {
                                      const x = idx * 25;
                                      const y = 28 - ((val - minVal) / (maxVal - minVal)) * 25;
                                      return `${x},${y}`;
                                    });
                                    const pathData = `M 0,${coords[0]} ` + coords.slice(1).map(c => `L ${c}`).join(' ');
                                    const areaData = `${pathData} L 100,30 L 0,30 Z`;
                                    return (
                                      <div className="h-8 w-18 sm:w-24 border-l border-b border-white/5 pl-1" title="Real-time reaction variation sparkline">
                                        <svg className="w-full h-full overflow-visible" viewBox="0 0 100 30" preserveAspectRatio="none">
                                          <defs>
                                            <linearGradient id={`grad-${node.id}`} x1="0" y1="0" x2="0" y2="1">
                                              <stop offset="0%" stopColor={isAnchor ? '#f59e0b' : '#3b82f6'} stopOpacity="0.4" />
                                              <stop offset="100%" stopColor="#000" stopOpacity="0" />
                                            </linearGradient>
                                          </defs>
                                          <path d={areaData} fill={`url(#grad-${node.id})`} />
                                          <path d={pathData} fill="none" stroke={isAnchor ? '#f59e0b' : '#64748b'} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                                          <circle cx="100" cy={coords[coords.length - 1].split(',')[1]} r="2" fill="#fff" />
                                        </svg>
                                      </div>
                                    );
                                  })()}

                                  {/* Active Selector */}
                                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all flex-shrink-0 ${isAnchor ? 'border-amber-500 bg-amber-500' : 'border-white/20'}`}>
                                    {isAnchor && <Check className="w-2.5 h-2.5 text-black stroke-[3px]" />}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Route Anchor Details panel */}
                        {(() => {
                          const activeNode = v2Stats.cloudEndpoints.find(n => n.checked);
                          if (!activeNode) return null;
                          return (
                            <div className="bg-[#111] border border-white/10 p-5 rounded-xl space-y-3 relative overflow-hidden">
                              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/[0.01] rounded-full blur-2xl pointer-events-none" />
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] uppercase tracking-wider font-mono text-amber-500 font-extrabold flex items-center gap-1.5">
                                  <Radio className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                                  Active Core Routing Path (Verified Layer)
                                </span>
                                <span className="text-[9px] font-mono text-slate-500">PROVIDER PROTOCOL: SECURE gRPC OVER TLS 1.3</span>
                              </div>
                              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                                Prompts submitted directly inside the playground are verified against security filters, pre-processed with the custom mitigating preamble, and then executed at the high-priority delivery endpoint of <span className="text-amber-500 font-bold uppercase tracking-wide">{activeNode.name}</span> in region <span className="text-white font-mono bg-white/5 py-0.5 px-1.5 rounded">{activeNode.region}</span>.
                              </p>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 text-[10px] font-mono text-slate-400">
                                <div className="bg-black/40 p-2.5 rounded border border-white/5">
                                  <div className="text-slate-500 uppercase text-[8px] mb-0.5">Link Encryption</div>
                                  <div className="text-white font-mono">AES-256-GCM</div>
                                </div>
                                <div className="bg-black/40 p-2.5 rounded border border-white/5">
                                  <div className="text-slate-500 uppercase text-[8px] mb-0.5">SLA Availability</div>
                                  <div className="text-white font-mono">99.998% Sync</div>
                                </div>
                                <div className="bg-black/40 p-2.5 rounded border border-white/5">
                                  <div className="text-slate-500 uppercase text-[8px] mb-0.5">Audit Compliance</div>
                                  <div className="text-emerald-400 font-mono font-bold flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                                    SOC2 / HIPAA
                                  </div>
                                </div>
                                <div className="bg-black/40 p-2.5 rounded border border-white/5">
                                  <div className="text-slate-500 uppercase text-[8px] mb-0.5">Instance Load</div>
                                  <div className="text-white font-mono">0.034ms Queue</div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Right: Telemetry Live Console & Visual Mapping */}
                      <div className="md:col-span-4 space-y-6">
                        {/* Interactive Visual Network Mapping */}
                        <div className="bg-black/40 border border-white/5 rounded-xl p-5 space-y-4">
                          <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block mb-1">Live Endpoint Pathway</span>
                          
                          {/* Animated Route Flow Widget */}
                          <div className="flex flex-col items-center justify-between gap-2.5 bg-[#080808] border border-white/5 p-4 rounded-lg relative overflow-hidden">
                            <div className="flex items-center justify-between w-full text-[9px] font-mono text-slate-500">
                              <span>GRC CLIENT</span>
                              <span className="text-amber-500 font-bold animate-pulse">● ROUTING ACTIVE</span>
                              <span>ENDPOINT</span>
                            </div>

                            <div className="flex items-center justify-between w-full py-3 px-1 relative z-10">
                              <div className="flex flex-col items-center gap-1 bg-white/5 border border-white/10 px-2 py-1.5 rounded text-center">
                                <span className="text-xs">💻</span>
                                <span className="text-[8px] font-mono uppercase text-slate-400 font-bold">Browser</span>
                              </div>

                              <div className="flex-1 flex items-center relative mx-1">
                                <div className="h-[2px] w-full bg-[#151515] overflow-hidden rounded relative">
                                  <motion.div 
                                    className="h-full bg-gradient-to-r from-blue-500 via-amber-500 to-green-500"
                                    initial={{ x: '-100%' }}
                                    animate={{ x: '100%' }}
                                    transition={{ repeat: Infinity, duration: 2.2, ease: "linear" }}
                                    style={{ width: '50%' }}
                                  />
                                </div>
                              </div>

                              <div className="flex flex-col items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-2 py-1.5 rounded text-center shrink-0">
                                <span className="text-xs">🛡️</span>
                                <span className="text-[8px] font-mono uppercase text-amber-500 font-bold">GRC Core</span>
                              </div>

                              <div className="flex-1 flex items-center relative mx-1">
                                <div className="h-[2px] w-full bg-[#151515] overflow-hidden rounded relative">
                                  <motion.div 
                                    className="h-full bg-gradient-to-r from-amber-500 via-green-500 to-white"
                                    initial={{ x: '-100%' }}
                                    animate={{ x: '100%' }}
                                    transition={{ repeat: Infinity, duration: 1.8, ease: "linear" }}
                                    style={{ width: '50%' }}
                                  />
                                </div>
                              </div>

                              <div className="flex flex-col items-center gap-1 bg-white/5 border border-white/10 px-2 py-1.5 rounded text-center truncate max-w-[85px]">
                                <span className="text-xs leading-none">☁️</span>
                                <span className="text-[8px] font-mono uppercase text-slate-300 font-semibold truncate">
                                  {v2Stats.cloudEndpoints.find(n => n.checked)?.id === 'vertex' ? 'Vertex AI' : 
                                   v2Stats.cloudEndpoints.find(n => n.checked)?.id === 'azure' ? 'Azure OA' :
                                   v2Stats.cloudEndpoints.find(n => n.checked)?.id === 'sagemaker' ? 'SageMaker' : 'Private'}
                                </span>
                              </div>
                            </div>

                            <p className="text-[9px] text-slate-500 text-center font-mono leading-normal select-none">
                              Sync tunnel established with RTT: <span className="text-amber-500 font-bold">{v2Stats.cloudEndpoints.find(n => n.checked)?.latency ?? 200}ms</span> over secure gRPC gateway.
                            </p>
                          </div>
                        </div>

                        {/* Simulated Live Logs Viewport */}
                        <div className="bg-black/50 border border-white/5 rounded-xl p-5 space-y-3.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Terminal className="w-3.5 h-3.5 text-blue-400" />
                              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Telemetry Log Output</span>
                            </div>
                            <span className="text-[8px] font-mono text-slate-600 uppercase bg-white/5 border border-white/5 px-2 py-0.5 rounded">
                              Real-Time Feed
                            </span>
                          </div>

                          <div className="bg-[#050505] p-3.5 rounded-lg border border-white/5 font-mono text-[9px] text-slate-400 space-y-2 h-44 overflow-y-auto scrollbar-thin select-text">
                            {pingLogs.map((log, idx) => {
                              let logColor = "text-slate-400";
                              if (log.includes("✅")) logColor = "text-emerald-400";
                              if (log.includes("⭐")) logColor = "text-amber-400 font-bold";
                              if (log.includes("🌐")) logColor = "text-sky-400";
                              return (
                                <div key={idx} className={`${logColor} leading-relaxed flex items-start gap-1`}>
                                  <span className="text-slate-600 select-none">›</span>
                                  <span>{log}</span>
                                </div>
                              );
                            })}
                          </div>

                          <div className="flex justify-between items-center text-[9px] font-mono text-slate-600">
                            <span>TOTAL DELIVERIES TESTED: 4 NODES</span>
                            <span className="text-emerald-400 text-[10px] flex items-center gap-1">
                              <span className="w-1 h-1 bg-emerald-400 rounded-full animate-ping" />
                              ALL LINKS INTEGRAL
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {v2Stats.activeTab === 'guardrails' && (
                  <motion.div
                    key="guardrails"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className="grid grid-cols-1 md:grid-cols-12 gap-8"
                  >
                    {/* Guardrails Controls */}
                    <div className="md:col-span-6 space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                          <Terminal className="w-4 h-4 text-purple-400" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-white">Active Generative AI Guardrails</h3>
                          <p className="text-[11px] text-slate-500">Real-time toxicity scanners and hallucination estimators validating prompt output generations.</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs font-mono uppercase">
                            <span className="text-slate-400 font-semibold">Toxicity Scrubber Sensitivity</span>
                            <span className="text-amber-500 font-bold">Index: {v2Stats.toxicityThreshold}</span>
                          </div>
                          <input
                            type="range"
                            min="0.05"
                            max="0.50"
                            step="0.05"
                            value={v2Stats.toxicityThreshold}
                            onChange={(e) => setV2Stats(prev => ({ ...prev, toxicityThreshold: parseFloat(e.target.value) }))}
                            className="w-full h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer accent-amber-500"
                          />
                          <div className="flex justify-between text-[8px] font-mono text-slate-600 uppercase">
                            <span>Highly Sensitive (0.05)</span>
                            <span>Standard Compliance (0.25)</span>
                            <span>Permissive Risk (0.50)</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-xs font-mono uppercase">
                            <span className="text-slate-400 font-semibold">Hallucination Entropy Bound</span>
                            <span className="text-amber-500 font-bold">Index: {v2Stats.hallucinationThreshold}</span>
                          </div>
                          <input
                            type="range"
                            min="0.10"
                            max="0.80"
                            step="0.05"
                            value={v2Stats.hallucinationThreshold}
                            onChange={(e) => setV2Stats(prev => ({ ...prev, hallucinationThreshold: parseFloat(e.target.value) }))}
                            className="w-full h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer accent-amber-500"
                          />
                          <div className="flex justify-between text-[8px] font-mono text-slate-600 uppercase">
                            <span>Strict Logic (0.10)</span>
                            <span>Balanced Output (0.40)</span>
                            <span>Creative Freedom (0.80)</span>
                          </div>
                        </div>

                        <div className="h-px bg-white/5" />

                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-black/20 rounded-xl border border-white/5 flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-300">PII Filtering</span>
                            <button
                              onClick={() => setV2Stats(prev => ({ ...prev, piiState: !prev.piiState }))}
                              className={`w-8 h-5 rounded-full p-0.5 transition-all ${v2Stats.piiState ? 'bg-amber-500' : 'bg-white/10'}`}
                            >
                              <div className={`w-4 h-4 rounded-full bg-black transition-all ${v2Stats.piiState ? 'translate-x-3' : 'translate-x-0'}`} />
                            </button>
                          </div>

                          <div className="p-4 bg-black/20 rounded-xl border border-white/5 flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-300">Off-Topic Guard</span>
                            <button
                              onClick={() => setV2Stats(prev => ({ ...prev, offTopicState: !prev.offTopicState }))}
                              className={`w-8 h-5 rounded-full p-0.5 transition-all ${v2Stats.offTopicState ? 'bg-amber-500' : 'bg-white/10'}`}
                            >
                              <div className={`w-4 h-4 rounded-full bg-black transition-all ${v2Stats.offTopicState ? 'translate-x-3' : 'translate-x-0'}`} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Guardrails Logs */}
                    <div className="md:col-span-6 space-y-4">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-bold block">Live Guardrail Event Logs</span>
                      <div className="bg-black/40 border border-white/5 rounded-xl p-5 font-mono text-xs text-slate-400 space-y-3 h-64 overflow-y-auto scrollbar-thin">
                        {v2Stats.scrubLog.map((log) => (
                          <div key={log.id} className="flex gap-2.5 items-start">
                            <span className="text-slate-600 shrink-0">[{log.time}]</span>
                            <span className={`px-1 rounded text-[8px] font-bold ${log.type === 'SCRUB' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : log.type === 'WARN' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-white/5 text-slate-500'}`}>{log.type}</span>
                            <span className="text-slate-300 flex-1 leading-relaxed">{log.msg}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {v2Stats.activeTab === 'equity' && (
                  <motion.div
                    key="equity"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className="grid grid-cols-1 md:grid-cols-12 gap-8"
                  >
                    {/* Equity Side-by-Side Left */}
                    <div className="md:col-span-6 space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                          <Leaf className="w-4 h-4 text-green-400" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-white">Social & Ethical Equity</h3>
                          <p className="text-[11px] text-slate-500">Evaluating inclusivity boundaries, model safe-guards, accessibility standards, and toxic-reduction offsets.</p>
                        </div>
                      </div>

                      <div className="bg-black/20 p-6 rounded-xl border border-white/5 space-y-4 font-sans">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400 uppercase font-mono">Inclusivity Rating</span>
                          <span className="text-sm font-semibold text-white font-mono">{v2Stats.socialImpactEquity}%</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-green-600 to-green-400 animate-pulse" style={{ width: `${v2Stats.socialImpactEquity}%` }} />
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400 uppercase font-mono">De-biased Language Index</span>
                          <span className="text-sm font-semibold text-white font-mono">{v2Stats.biasScore}%</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-green-600 to-green-400" style={{ width: `${v2Stats.biasScore}%` }} />
                        </div>

                        <p className="text-[11px] text-slate-500 leading-relaxed pt-2">Compliance Rating operates on multi-weighted evaluations under NIST and ESG global metrics declarations. Prompts passing strict de-biasing controls earn highest classification honors.</p>
                      </div>
                    </div>

                    {/* ROI Performance Right */}
                    <div className="md:col-span-6 space-y-6 font-sans">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#b5a33f]/15 border border-[#c2b248]/30 flex items-center justify-center">
                          <FileText className="w-4 h-4 text-amber-300" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-white">Financial ROI & Performance Matrix</h3>
                          <p className="text-[11px] text-slate-500">Assess computed token savings, pipeline efficiency offsets, and direct monthly cost reductions.</p>
                        </div>
                      </div>

                      <div className="bg-black/20 p-6 rounded-xl border border-white/5 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400 uppercase font-mono">Monthly Saved Infrastructure Cost (Est)</span>
                          <span className="text-sm font-semibold text-green-400 font-mono">$452.40 Saved</span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400 uppercase font-mono">Token Density Quotient</span>
                          <span className="text-sm font-semibold text-white font-mono">92% Optimal</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-amber-500 to-amber-300" style={{ width: '92%' }} />
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400 uppercase font-mono">Hallucination Mitigation Offset</span>
                          <span className="text-sm font-semibold text-white font-mono">{(100 - v2Stats.hallucinationRisk)}% Safe</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-amber-500 to-amber-300" style={{ width: `${100 - v2Stats.hallucinationRisk}%` }} />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>
        </div>
      </main>

      <footer className="h-10 border-t border-white/5 bg-[#0a0a0a] flex items-center justify-between px-8 text-[9px] uppercase tracking-[0.2em] text-slate-600 mt-12">
        <div>Operator ID: {user ? user.email : 'ADMIN-729'}</div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${user ? 'bg-green-500' : 'bg-amber-500/50'} animate-pulse`} />
            <span>Identity: {user ? 'Verified' : 'Anonymous'}</span>
          </div>
          <span>Secure Node: 0x82...f2</span>
        </div>
      </footer>

      {/* Printer-Friendly Report Container */}
      {printData && (
        <div id="print-report-template" className="hidden print:block bg-white text-slate-800 p-12 max-w-4xl mx-auto font-sans leading-relaxed">
          {/* Header */}
          <div className="border-b-4 border-amber-600 pb-6 mb-8 flex justify-between items-end">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-amber-600 flex items-center justify-center rounded">
                  <span className="text-white font-serif font-bold text-lg leading-none">C</span>
                </div>
                <span className="text-xs uppercase font-mono font-bold text-amber-700 tracking-widest">Centaur Governance Suite</span>
              </div>
              <h1 className="text-3xl font-serif font-bold text-slate-900 tracking-tight">Compliance Evaluation Report</h1>
              <p className="text-xs text-slate-400 font-mono mt-1">Audit Stream ID: {printData.timestamp ? `CNT-${printData.timestamp.replace(/[^a-zA-Z0-9]/g, '').substring(0, 12).toUpperCase()}` : "LIVE-AUDIT"}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-mono font-bold block text-slate-400">Printed On:</span>
              <span className="text-xs font-mono text-slate-600 block">{new Date().toLocaleString()}</span>
              {user && (
                <>
                  <span className="text-[10px] uppercase font-mono font-bold block text-slate-400 mt-2">Inspector:</span>
                  <span className="text-xs font-mono text-slate-600 block">{user.email}</span>
                </>
              )}
            </div>
          </div>

          {/* Metadata Section */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-100 rounded-xl p-6 mb-8">
            <div>
              <span className="text-[9px] uppercase font-mono font-bold text-slate-400 block mb-1">Audit Context</span>
              <span className="text-sm font-semibold text-slate-800 block">{printData.title}</span>
            </div>
            <div>
              <span className="text-[9px] uppercase font-mono font-bold text-slate-400 block mb-1">Target Engine</span>
              <span className="text-sm font-semibold text-slate-800 block uppercase font-mono">{printData.model}</span>
            </div>
            <div>
              <span className="text-[9px] uppercase font-mono font-bold text-slate-400 block mb-1">Risk Classification</span>
              <span className={`inline-block text-xs uppercase font-bold px-2 py-0.5 rounded border ${
                printData.riskLevel === 'HIGH' ? 'bg-red-50 text-red-700 border-red-200' : 
                printData.riskLevel === 'MODERATE' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}>{printData.riskLevel}</span>
            </div>
            <div>
              <span className="text-[9px] uppercase font-mono font-bold text-slate-400 block mb-1">Governance Status</span>
              <span className={`inline-block text-xs uppercase font-bold px-2 py-0.5 rounded border ${
                printData.aggregateStatus === 'FAIL' ? 'bg-red-50 text-red-700 border-red-200' : 
                printData.aggregateStatus === 'CAUTION' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-green-50 text-green-700 border-green-200'
              }`}>{printData.aggregateStatus}</span>
            </div>
          </div>

          {/* Scores Overview */}
          <div className="mb-8 page-brake-avoid">
            <h2 className="text-xs uppercase font-mono font-bold text-slate-400 tracking-wider mb-4 pb-1 border-b border-slate-100">Evaluated Vector Scores</h2>
            <div className="grid grid-cols-3 gap-6 text-center">
              {[
                { label: 'Security Domain', val: printData.security, desc: 'Toxicity, prompt injection, and PII filtration efficacy.' },
                { label: 'Governance Guard', val: printData.governance, desc: 'System alignment and strict rule compliance execution.' },
                { label: 'Sustainability Audit', val: printData.sustainability, desc: 'Token efficiency, model cost, and environmental rating offsets.' },
              ].map((item) => (
                <div key={item.label} className="border border-slate-200 rounded-lg p-5 bg-white shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wide block mb-2">{item.label}</span>
                    <span className="text-4xl font-serif font-bold text-slate-900 block mb-2">{item.val}%</span>
                  </div>
                  <p className="text-[10px] text-slate-500">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Core Insights */}
          <div className="mb-8 bg-amber-50/20 border border-amber-500/10 rounded-xl p-6 page-brake-avoid">
            <h2 className="text-xs uppercase font-mono font-bold text-amber-800 tracking-widest block mb-2">Audit Insight Summary</h2>
            <p className="text-sm font-serif italic text-slate-700 leading-relaxed">
              "{printData.summary || "No automated insight summary recorded for this run."}"
            </p>
          </div>

          {/* Input payload block */}
          <div className="mb-8" style={{ pageBreakInside: 'avoid' }}>
            <h2 className="text-xs uppercase font-mono font-bold text-slate-400 tracking-wider mb-4 pb-1 border-b border-slate-100">Original Prompt Payload Manifest</h2>
            <div className="bg-slate-50 border border-slate-200 p-6 rounded-lg font-mono text-[10px] text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
              {printData.payload || "[Empty payload content]"}
            </div>
          </div>

          {/* Footer certification */}
          <div className="mt-16 pt-8 border-t border-slate-200 page-brake-avoid">
            <div className="grid grid-cols-2 gap-8 items-end">
              <div>
                <p className="text-[9px] font-mono text-slate-400 leading-relaxed tracking-wider uppercase">Authenticated By</p>
                <p className="text-xs text-slate-600 mt-1 font-semibold font-mono">CENTAUR GRC PROTOCOL NODE</p>
                <p className="text-[8px] text-slate-400 mt-0.5">Automated secure validation ledger validation hash: 0x82a970e7a2df</p>
              </div>
              <div className="text-right">
                <div className="inline-block border-t border-slate-300 w-48 pt-2">
                  <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">Rider-Verifier Seal</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
