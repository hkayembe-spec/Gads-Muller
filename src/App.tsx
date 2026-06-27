import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Gamepad2, 
  LayoutDashboard, 
  UserPlus, 
  ClipboardList, 
  Coins, 
  BarChart3, 
  Bell, 
  ShieldAlert, 
  UserCog, 
  Monitor, 
  LogOut, 
  Menu, 
  X, 
  Lock, 
  AlertTriangle,
  Play,
  RotateCw,
  History,
  Users,
  Heart,
  Package,
  Wallet,
  FileSpreadsheet
} from 'lucide-react';

// Firebase Firestore 
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

// Types
import { User, ClientSession, DeleteRequest, GameNotification, PlayStationConsole, ActivityLog, LoyalClient, GameRoom, InventoryItem, FinanceTransaction } from './types';

// Components
import Dashboard from './components/Dashboard';
import NewClient from './components/NewClient';
import LoyalClients from './components/LoyalClients';
import SessionsList from './components/SessionsList';
import PaymentsList from './components/PaymentsList';
import Reports from './components/Reports';
import AuditLog from './components/AuditLog';
import Notifications from './components/Notifications';
import DeleteRequests from './components/DeleteRequests';
import UserManagement from './components/UserManagement';
import ConsoleManagement from './components/ConsoleManagement';
import Parameters from './components/Parameters';
import PeriodFilter from './components/PeriodFilter';
import Inventory from './components/Inventory';
import Finance from './components/Finance';
import CaisseReport from './components/CaisseReport';

// App Logo generated asset path
// @ts-ignore
import logoImg from './assets/images/nova_casino_logo_1782028636027.jpg';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('nova_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  // 3h unpaid session alert option
  const [unpaidAlertEnabled, setUnpaidAlertEnabled] = useState<boolean>(() => {
    return localStorage.getItem('nova_unpaid_3h_alert_enabled') !== 'false';
  });

  const handleToggleUnpaidAlert = (enabled: boolean) => {
    setUnpaidAlertEnabled(enabled);
    localStorage.setItem('nova_unpaid_3h_alert_enabled', String(enabled));
  };

  // Date period filters (Calendar)
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Core collections synced from server DB
  const [isFallbackMode, setIsFallbackMode] = useState<boolean>(false);
  const [sessions, setSessions] = useState<ClientSession[]>([]);
  const [rawSessions, setRawSessions] = useState<ClientSession[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string>(() => {
    return localStorage.getItem('nova_active_room_id') || 'room-default';
  });
  const [deleteRequests, setDeleteRequests] = useState<DeleteRequest[]>([]);
  const [rawDeleteRequests, setRawDeleteRequests] = useState<DeleteRequest[]>([]);
  const [notifications, setNotifications] = useState<GameNotification[]>([]);
  const [consoles, setConsoles] = useState<PlayStationConsole[]>([]);
  const [loyalClients, setLoyalClients] = useState<LoyalClient[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [financeTransactions, setFinanceTransactions] = useState<FinanceTransaction[]>([]);
  const [isLogsLoading, setIsLogsLoading] = useState<boolean>(false);
  const [stats, setStats] = useState<any>({
    totalClients: 0,
    totalMatches: 0,
    totalRevenue: 0,
    totalPending: 0,
    categories: {
      ps5: { sessionsCount: 0, matchesCount: 0, revenue: 0 },
      ps4: { sessionsCount: 0, matchesCount: 0, revenue: 0 },
      ps3: { sessionsCount: 0, matchesCount: 0, revenue: 0 }
    }
  });

  // Reactive calculations for sessions based on role and managed users list
  useEffect(() => {
    if (!currentUser) return;
    let visibleSessions: ClientSession[] = [];
    if (currentUser.role === 'director') {
      visibleSessions = rawSessions;
    } else if (currentUser.role === 'admin') {
      const managedUserIds = users.map(u => u.id);
      visibleSessions = rawSessions.filter(s => managedUserIds.includes(s.createdBy));
    } else {
      visibleSessions = rawSessions.filter(s => s.createdBy === currentUser.id);
    }
    setSessions(visibleSessions);
  }, [rawSessions, users, currentUser]);

  // Handle filtering by selected date range (Calendar)
  const filteredSessionsByDate = useMemo(() => {
    return sessions.filter(s => {
      if (!s.createdAt) return true;
      const time = new Date(s.createdAt).getTime();
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (time < start.getTime()) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (time > end.getTime()) return false;
      }
      return true;
    });
  }, [sessions, startDate, endDate]);

  // Filter active/unpaid sessions that have exceeded 3 hours (180 minutes)
  const overdueSessions = useMemo(() => {
    if (!unpaidAlertEnabled) return [];
    return rawSessions.filter(s => {
      if (s.paymentStatus !== 'pending') return false;
      const elapsed = Date.now() - new Date(s.createdAt).getTime();
      return elapsed > 3 * 3600 * 1000;
    });
  }, [rawSessions, unpaidAlertEnabled]);

  // Overdue Unpaid Session Audio Sound Alert
  useEffect(() => {
    if (overdueSessions.length === 0) return;

    // Play periodic beep-beep alert
    const playAlarm = () => {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        let time = audioCtx.currentTime;
        // 4 dual frequency alarm beeps
        for (let i = 0; i < 4; i++) {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(988, time); // B5 note
          osc.frequency.exponentialRampToValueAtTime(494, time + 0.155);
          
          gain.gain.setValueAtTime(0.18, time);
          gain.gain.exponentialRampToValueAtTime(0.001, time + 0.155);
          
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          
          osc.start(time);
          osc.stop(time + 0.16);
          time += 0.22;
        }
      } catch (e) {
        console.warn("Autoplay block / sound failed:", e);
      }
    };

    // Play now
    playAlarm();

    // Trigger alarm every 20 seconds
    const audioInterval = setInterval(() => {
      playAlarm();
    }, 20000);

    return () => {
      clearInterval(audioInterval);
    };
  }, [overdueSessions.length]);

  // Compute stats on the fly from filtered sessions to guarantee full reactive consistency
  const displayStats = useMemo(() => {
    const totalClients = filteredSessionsByDate.length;
    const paidSessions = filteredSessionsByDate.filter(s => s.paymentStatus === 'paid');
    const totalRevenue = parseFloat(paidSessions.reduce((acc, s) => acc + s.totalAmount, 0).toFixed(2));
    const totalPending = parseFloat(filteredSessionsByDate.filter(s => s.paymentStatus === 'pending').reduce((acc, s) => acc + s.totalAmount, 0).toFixed(2));
    const totalMatches = filteredSessionsByDate.reduce((acc, s) => acc + s.matchesCount, 0);

    const categories = {
      ps5: { sessionsCount: 0, matchesCount: 0, revenue: 0 },
      ps4: { sessionsCount: 0, matchesCount: 0, revenue: 0 },
      ps3: { sessionsCount: 0, matchesCount: 0, revenue: 0 }
    };

    filteredSessionsByDate.forEach(s => {
      const type = s.consoleType;
      if (categories[type]) {
        categories[type].sessionsCount++;
        categories[type].matchesCount += s.matchesCount;
        if (s.paymentStatus === 'paid') {
          categories[type].revenue = parseFloat((categories[type].revenue + s.totalAmount).toFixed(2));
        }
      }
    });

    return {
      totalClients,
      totalMatches,
      totalRevenue,
      totalPending,
      categories
    };
  }, [filteredSessionsByDate]);

  // Reactive calculations for delete requests based on role and managed users list
  useEffect(() => {
    if (!currentUser) return;
    let visibleRequests: DeleteRequest[] = [];
    if (currentUser.role === 'director') {
      visibleRequests = rawDeleteRequests;
    } else if (currentUser.role === 'admin') {
      const managedUserIds = users.map(u => u.id);
      visibleRequests = rawDeleteRequests.filter(r => managedUserIds.includes(r.requestedBy));
    } else {
      visibleRequests = rawDeleteRequests.filter(r => r.requestedBy === currentUser.id);
    }
    setDeleteRequests(visibleRequests);
  }, [rawDeleteRequests, users, currentUser]);

  // Login form state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // App loader states
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Create client action loading state
  const [isCreatingClient, setIsCreatingClient] = useState(false);

  // Notification sound trick (audio context alert or simple flash)
  const previousNotifLength = useRef<number>(0);

  // Fetch all app data from express API routes as fallback/initial
  const fetchData = async (silent = false, retryCount = 0) => {
    if (!currentUser) return;
    if (!silent) setIsDataLoading(true);

    try {
      const headers = {
        'Content-Type': 'application/json',
        'x-user-id': currentUser.id,
        'x-room-id': activeRoomId
      };

      // 0. Fetch Rooms
      const roomsRes = await fetch('/api/rooms', { headers });
      if (roomsRes.ok) {
        const roomsData = await roomsRes.json();
        setRooms(roomsData);

        // If activeRoomId is not in the allowed rooms and rooms list is not empty,
        // fall back to the first available room or default
        const roomIds = roomsData.map((r: any) => r.id);
        if (activeRoomId !== 'all' && activeRoomId !== 'room-default' && !roomIds.includes(activeRoomId)) {
          if (roomIds.length > 0) {
            setActiveRoomId(roomIds[0]);
            localStorage.setItem('nova_active_room_id', roomIds[0]);
          } else {
            setActiveRoomId('room-default');
            localStorage.setItem('nova_active_room_id', 'room-default');
          }
        }
      }

      // 1. Fetch Stats
      const statsRes = await fetch('/api/stats', { headers });
      if (statsRes.status === 403) {
        // Automatically lock/kick user if locked out remotely (Point 15)
        handleLogout();
        setLoginError("Ce compte a été bloqué à distance par l'administrateur.");
        return;
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      // 2. Fetch Sessions
      const sessionsRes = await fetch('/api/sessions', { headers });
      if (sessionsRes.ok) {
        const sessionsData = await sessionsRes.json();
        // Sort descending by creation date
        setRawSessions(sessionsData.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      }

      // 3. Fetch Users (only display managed)
      const usersRes = await fetch('/api/users', { headers });
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData);
      }

      // 4. Fetch Delete Requests
      const deleteReqsRes = await fetch('/api/delete-requests', { headers });
      if (deleteReqsRes.ok) {
        const reqData = await deleteReqsRes.json();
        setRawDeleteRequests(reqData.sort((a: any, b: any) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()));
      }

      // 5. Fetch Notifications
      const notifsRes = await fetch('/api/notifications', { headers });
      if (notifsRes.ok) {
        const notifData = await notifsRes.json();
        setNotifications(notifData);
        
        // Notify signal in page title / alert (Point 13)
        if (notifData.length > previousNotifLength.current && previousNotifLength.current > 0) {
          triggerSuccessAlert("Nouveau signal reçu : validation enregistrée !");
        }
        previousNotifLength.current = notifData.length;
      }

      // 6. Fetch PlayStation Consoles
      const consolesRes = await fetch('/api/consoles', { headers });
      if (consolesRes.ok) {
        const consolesData = await consolesRes.json();
        setConsoles(consolesData);
      }

      // 8. Fetch Loyal Clients from Database
      const loyalRes = await fetch('/api/loyal-clients', { headers });
      if (loyalRes.ok) {
        const loyalData = await loyalRes.json();
        setLoyalClients(loyalData);
      }

      // 9. Fetch Reserve Stock (Inventory)
      const invRes = await fetch('/api/inventory', { headers });
      if (invRes.ok) {
        const invData = await invRes.json();
        setInventoryItems(invData);
      }

      // 10. Fetch Finance Transactions
      const finRes = await fetch('/api/finance', { headers });
      if (finRes.ok) {
        const finData = await finRes.json();
        setFinanceTransactions(finData);
      }

      // 7. Fetch Activity Logs
      if (currentUser.role === 'director' || currentUser.role === 'admin') {
        setIsLogsLoading(true);
        const logsRes = await fetch('/api/logs', { headers });
        if (logsRes.ok) {
          const logsData = await logsRes.json();
          setLogs(logsData);
        }
        setIsLogsLoading(false);
      }

    } catch (err) {
      console.error("Error fetching Nova Casino data", err);
      if (retryCount < 2) {
        console.warn(`Retrying fetch in 1.5s... (Attempt ${retryCount + 1}/2)`);
        setTimeout(() => {
          fetchData(silent, retryCount + 1);
        }, 1500);
      }
    } finally {
      if (!silent) setIsDataLoading(false);
    }
  };

  // Real-time synchronization of accounts, sessions, notifications and deletion requests in Firestore or fallback HTTP polling
  useEffect(() => {
    if (!currentUser) return;

    // Fetch initial data once
    fetchData(true);

    // Dynamic database mode check on load
    const checkDbStatus = async () => {
      try {
        const res = await fetch('/api/db-status');
        if (res.ok) {
          const data = await res.json();
          if (data.fallback && !isFallbackMode) {
            setIsFallbackMode(true);
          }
        }
      } catch (err) {
        console.warn("Failed to check DB status", err);
      }
    };
    checkDbStatus();

    let intervalId: any = null;
    let unsubscribes: (() => void)[] = [];

    if (isFallbackMode) {
      console.log("[Nova Casino Sync Engine] Running in high-frequency REST API polling fallback mode (100% synchronized with database writes).");
      // Poll every 4 seconds to synchronize all accounts
      intervalId = setInterval(() => {
        fetchData(true);
      }, 4000);
    } else {
      console.log("[Nova Casino Sync Engine] Running in active Firestore Real-time listener mode.");
      try {
        // 1. Real-time Listen to Users
        const unsubscribeUsers = onSnapshot(collection(db, "users"), (snapshot) => {
          const allUsers: User[] = [];
          snapshot.forEach(docSnap => {
            allUsers.push(docSnap.data() as User);
          });

          // Synchronize current user status/lock instantly in real-time
          const selfRecord = allUsers.find(u => u.id === currentUser.id);
          if (selfRecord) {
            if (selfRecord.isLocked || selfRecord.status === 'locked') {
              handleLogout();
              setLoginError("Ce compte a été bloqué à distance par l'administrateur.");
              return;
            }
            // Sync local current user if profile changes
            if (selfRecord.name !== currentUser.name || selfRecord.role !== currentUser.role) {
              setCurrentUser(selfRecord);
              localStorage.setItem('nova_user', JSON.stringify(selfRecord));
            }
          }

          // Filter visible users based on role
          let visibleUsers: User[] = [];
          if (currentUser.role === 'director') {
            visibleUsers = allUsers;
          } else if (currentUser.role === 'admin') {
            visibleUsers = allUsers.filter(u => u.createdBy === currentUser.id || u.id === currentUser.id);
          } else {
            visibleUsers = allUsers.filter(u => u.id === currentUser.id);
          }
          setUsers(visibleUsers);
        }, (err) => {
          console.warn("Firestore [users] real-time subscription error, falling back to HTTP polling:", err);
          setIsFallbackMode(true);
        });
        unsubscribes.push(unsubscribeUsers);

        // 2. Real-time Listen to Sessions
        const unsubscribeSessions = onSnapshot(collection(db, "sessions"), (snapshot) => {
          const allSessions: ClientSession[] = [];
          snapshot.forEach(docSnap => {
            allSessions.push(docSnap.data() as ClientSession);
          });

          // Sort descending by creation date
          allSessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setRawSessions(allSessions);
        }, (err) => {
          console.warn("Firestore [sessions] real-time subscription error, falling back to HTTP polling:", err);
          setIsFallbackMode(true);
        });
        unsubscribes.push(unsubscribeSessions);

        // 3. Real-time Listen to Delete Requests
        const unsubscribeRequests = onSnapshot(collection(db, "deleteRequests"), (snapshot) => {
          const allRequests: DeleteRequest[] = [];
          snapshot.forEach(docSnap => {
            allRequests.push(docSnap.data() as DeleteRequest);
          });

          allRequests.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
          setRawDeleteRequests(allRequests);
        }, (err) => {
          console.warn("Firestore [deleteRequests] real-time subscription error, falling back to HTTP polling:", err);
          setIsFallbackMode(true);
        });
        unsubscribes.push(unsubscribeRequests);

        // 4. Real-time Listen to Signals & Notifications
        const unsubscribeNotifications = onSnapshot(collection(db, "notifications"), (snapshot) => {
          const allNotifs: GameNotification[] = [];
          snapshot.forEach(docSnap => {
            allNotifs.push(docSnap.data() as GameNotification);
          });

          allNotifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

          let visibleNotifs: GameNotification[] = [];
          if (currentUser.role === 'director') {
            visibleNotifs = allNotifs;
          } else if (currentUser.role === 'admin') {
            visibleNotifs = allNotifs.filter(n => n.targetAdminId === currentUser.id || n.targetAdminId === null);
          }

          setNotifications(visibleNotifs);

          // Trigger instant signal notification alert
          if (allNotifs.length > previousNotifLength.current && previousNotifLength.current > 0) {
            triggerSuccessAlert("Nouveau signal de notification reçu en temps réel !");
          }
          previousNotifLength.current = allNotifs.length;
        }, (err) => {
          console.warn("Firestore [notifications] real-time subscription error, falling back to HTTP polling:", err);
          setIsFallbackMode(true);
        });
        unsubscribes.push(unsubscribeNotifications);

        // 5. loyalClients
        const unsubscribeLoyal = onSnapshot(collection(db, "loyalClients"), (snapshot) => {
          const allLoyals: LoyalClient[] = [];
          snapshot.forEach(docSnap => {
            allLoyals.push(docSnap.data() as LoyalClient);
          });
          allLoyals.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
          setLoyalClients(allLoyals);
        }, (err) => {
          console.warn("Firestore [loyalClients] real-time subscription error, falling back to HTTP polling:", err);
          setIsFallbackMode(true);
        });
        unsubscribes.push(unsubscribeLoyal);

        // 6. PlayStation Consoles
        const unsubscribeConsoles = onSnapshot(collection(db, "consoles"), (snapshot) => {
          const allConsoles: PlayStationConsole[] = [];
          snapshot.forEach(docSnap => {
            allConsoles.push(docSnap.data() as PlayStationConsole);
          });
          // Sort naturally by name
          allConsoles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
          setConsoles(allConsoles);
        }, (err) => {
          console.warn("Firestore [consoles] real-time subscription error, falling back to HTTP polling:", err);
          setIsFallbackMode(true);
        });
        unsubscribes.push(unsubscribeConsoles);

        // 7. Finance Transactions
        const unsubscribeFinance = onSnapshot(collection(db, "finance"), (snapshot) => {
          const allFinance: FinanceTransaction[] = [];
          snapshot.forEach(docSnap => {
            allFinance.push(docSnap.data() as FinanceTransaction);
          });
          // Sort by date descending, then by createdAt descending
          allFinance.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setFinanceTransactions(allFinance);
        }, (err) => {
          console.warn("Firestore [finance] real-time subscription error, falling back to HTTP polling:", err);
          setIsFallbackMode(true);
        });
        unsubscribes.push(unsubscribeFinance);

        // 8. Inventory Items
        const unsubscribeInventory = onSnapshot(collection(db, "inventory"), (snapshot) => {
          const allInv: InventoryItem[] = [];
          snapshot.forEach(docSnap => {
            allInv.push(docSnap.data() as InventoryItem);
          });
          allInv.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
          setInventoryItems(allInv);
        }, (err) => {
          console.warn("Firestore [inventory] real-time subscription error, falling back to HTTP polling:", err);
          setIsFallbackMode(true);
        });
        unsubscribes.push(unsubscribeInventory);

      } catch (err) {
        console.warn("Firestore client listen setup failed, adopting REST polling:", err);
        setIsFallbackMode(true);
      }
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      unsubscribes.forEach(unsub => {
        try {
          unsub();
        } catch (e) {}
      });
    };
  }, [currentUser, isFallbackMode]);

  const triggerSuccessAlert = (text: string) => {
    setAlertMessage({ type: 'success', text });
    setTimeout(() => setAlertMessage(null), 5000);
  };

  const triggerErrorAlert = (text: string) => {
    setAlertMessage({ type: 'error', text });
    setTimeout(() => setAlertMessage(null), 5000);
  };

  // Auth logins
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setLoginError("Veuillez saisir votre identifiant et votre mot de passe.");
      return;
    }

    setIsAuthenticating(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });

      const data = await res.json();
      if (res.ok) {
        setCurrentUser(data.user);
        localStorage.setItem('nova_user', JSON.stringify(data.user));
        triggerSuccessAlert("Bienvenue sur la console Nova Casino !");
        setActiveTab('dashboard');
      } else {
        setLoginError(data.error || "Échec d'authentification.");
      }
    } catch (err) {
      setLoginError("Impossible de contacter le serveur de base de données.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('nova_user');
    setActiveTab('dashboard');
  };

  // Submit client creation (Point 1, 2)
  const handleCreateClient = async (formData: {
    clientName: string;
    consoleNumber: string;
    phoneNumber: string;
    consoleType: 'ps3' | 'ps4' | 'ps5';
    matchesCount: number;
    saveAsLoyal?: boolean;
    drinksCount?: number;
    snacksCount?: number;
  }) => {
    if (!currentUser) return;
    setIsCreatingClient(true);

    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
          'x-room-id': activeRoomId === 'all' ? 'room-default' : activeRoomId
        },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        const newSess = await res.json();
        triggerSuccessAlert(`Client ${formData.clientName} enregistré avec succès sur la Console ${formData.consoleNumber} !`);
        setActiveTab('sessions');
        fetchData(true);
      } else {
        const err = await res.json();
        triggerErrorAlert(err.error || "Impossible d'enregistrer le client.");
      }
    } catch (err) {
      triggerErrorAlert("Erreur réseau.");
    } finally {
      setIsCreatingClient(false);
    }
  };

  // Submit payment validation (Point 13)
  const handleValidatePayment = async (sessionId: string, paymentMethod?: 'cash' | 'mobile_money' | 'card') => {
    if (!currentUser) return;

    try {
      const d = new Date();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const localDate = `${year}-${month}-${day}`;

      const res = await fetch(`/api/sessions/${sessionId}/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        },
        body: JSON.stringify({ 
          paymentMethod: paymentMethod || 'cash',
          localDate
        })
      });

      if (res.ok) {
        triggerSuccessAlert("Paiement validé avec succès ! Reçu prêt à l'impression.");
        fetchData(true);
      } else {
        const err = await res.json();
        triggerErrorAlert(err.error || "Erreur de validation.");
      }
    } catch (err) {
      triggerErrorAlert("Erreur réseau.");
    }
  };

  // Supprimer / Demande de suppression session (Point 11)
  const handleDeleteSession = async (sessionId: string) => {
    if (!currentUser) return;

    // Direct delete for admins, request task for users
    const isDirect = currentUser.role === 'director' || currentUser.role === 'admin';
    const confirmMessage = isDirect 
      ? "Êtes-vous sûr de vouloir supprimer définitivement ce client ?"
      : "Vous n'avez pas l'autorisation de supprimer directement. Souhaitez-vous envoyer une requête de suppression à votre administrateur ?";

    if (!window.confirm(confirmMessage)) return;

    try {
      const res = await fetch(`/api/sessions/${sessionId}/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        }
      });

      const data = await res.json();
      if (res.ok) {
        if (data.deleted) {
          triggerSuccessAlert("Client supprimé avec succès de la base de données.");
        } else {
          triggerSuccessAlert("Votre requête de suppression a été envoyée avec succès à votre manager.");
        }
        fetchData(true);
      } else {
        triggerErrorAlert(data.error || "Impossible de traiter la demande.");
      }
    } catch (err) {
      triggerErrorAlert("Erreur réseau.");
    }
  };

  // Approve / Reject deletion requests (Point 11)
  const handleResolveDeleteRequest = async (requestId: string, action: 'approve' | 'reject') => {
    if (!currentUser) return;

    try {
      const res = await fetch(`/api/delete-requests/${requestId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        },
        body: JSON.stringify({ action })
      });

      if (res.ok) {
        triggerSuccessAlert(action === 'approve' ? "Requête approuvée et client supprimé." : "Requête de suppression rejetée.");
        fetchData(true);
      } else {
        const err = await res.json();
        triggerErrorAlert(err.error || "Impossible de résoudre la requête.");
      }
    } catch (err) {
      triggerErrorAlert("Erreur réseau.");
    }
  };

  // Creating operator accounts (Point 5, 6)
  const handleCreateUser = async (newUserData: any) => {
    if (!currentUser) return;

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        },
        body: JSON.stringify(newUserData)
      });

      if (res.ok) {
        triggerSuccessAlert(`Le compte ${newUserData.username} à été créé avec succès !`);
        fetchData(true);
      } else {
        const err = await res.json();
        triggerErrorAlert(err.error || "Impossible de créer l'utilisateur.");
      }
    } catch (err) {
      triggerErrorAlert("Erreur réseau.");
    }
  };

  // PlayStation Consoles Handlers
  const handleCreateConsole = async (consoleData: { name: string; type: any; status: 'active' | 'maintenance' }) => {
    if (!currentUser) return;
    setIsDataLoading(true);
    try {
      const res = await fetch('/api/consoles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
          'x-room-id': activeRoomId === 'all' ? 'room-default' : activeRoomId
        },
        body: JSON.stringify(consoleData)
      });
      if (res.ok) {
        triggerSuccessAlert("Console PlayStation enregistrée !");
        fetchData(true);
      } else {
        const err = await res.json();
        triggerErrorAlert(err.error || "Erreur de création de console.");
      }
    } catch (err) {
      console.error(err);
      triggerErrorAlert("Erreur de connexion serveur.");
    } finally {
      setIsDataLoading(false);
    }
  };

  const handleToggleConsoleStatus = async (id: string) => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/consoles/${id}/toggle-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        }
      });
      if (res.ok) {
        triggerSuccessAlert("Statut de la console mis à jour !");
        fetchData(true);
      } else {
        const err = await res.json();
        triggerErrorAlert(err.error || "Erreur de mise à jour.");
      }
    } catch (err) {
      console.error(err);
      triggerErrorAlert("Erreur réseau.");
    }
  };

  const handleDeleteConsole = async (id: string) => {
    if (!currentUser) return;
    setIsDataLoading(true);
    try {
      const res = await fetch(`/api/consoles/${id}/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        }
      });
      if (res.ok) {
        triggerSuccessAlert("Console supprimée du parc !");
        fetchData(true);
      } else {
        const err = await res.json();
        triggerErrorAlert(err.error || "Erreur de suppression.");
      }
    } catch (err) {
      console.error(err);
      triggerErrorAlert("Erreur réseau.");
    } finally {
      setIsDataLoading(false);
    }
  };

  // Toggle remote lock/disable account (Point 15)
  const handleToggleLockUser = async (userId: string) => {
    if (!currentUser) return;

    try {
      const res = await fetch(`/api/users/${userId}/toggle-lock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        }
      });

      if (res.ok) {
        triggerSuccessAlert("Contrôle d'accès à distance mis à jour !");
        fetchData(true);
      } else {
        const err = await res.json();
        triggerErrorAlert(err.error || "Action impossible.");
      }
    } catch (err) {
      triggerErrorAlert("Erreur réseau.");
    }
  };

  // Force remote password change (Point 15)
  const handleForceChangePassword = async (userId: string, newPass: string) => {
    if (!currentUser) return;

    try {
      const res = await fetch(`/api/users/${userId}/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        },
        body: JSON.stringify({ newPassword: newPass })
      });

      if (res.ok) {
        // success handles modal
        fetchData(true);
      } else {
        const err = await res.json();
        triggerErrorAlert(err.error || "Action Impossible.");
      }
    } catch (err) {
      triggerErrorAlert("Erreur réseau.");
    }
  };

  // Clear system alert log
  const handleClearNotifications = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/notifications/clear', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        }
      });
      if (res.ok) {
        setNotifications([]);
        triggerSuccessAlert("Alertes effacées.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // --- INVENTORY STOCK OPERATIONS ---
  const handleSaveInventoryItem = async (item: Partial<InventoryItem>) => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        },
        body: JSON.stringify(item)
      });
      if (res.ok) {
        triggerSuccessAlert("Article de stock enregistré !");
        await fetchData(true);
        return await res.json();
      } else {
        const err = await res.json();
        triggerErrorAlert(err.error || "Erreur lors de l'enregistrement.");
        throw new Error(err.error);
      }
    } catch (err: any) {
      console.error(err);
      triggerErrorAlert(err.message || "Erreur réseau.");
      throw err;
    }
  };

  const handleAdjustInventoryQty = async (id: string, amount: number) => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/inventory/${id}/adjust`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        },
        body: JSON.stringify({ amount })
      });
      if (res.ok) {
        await fetchData(true);
        return await res.json();
      } else {
        const err = await res.json();
        triggerErrorAlert(err.error || "Erreur lors de l'ajustement.");
      }
    } catch (err) {
      console.error(err);
      triggerErrorAlert("Erreur réseau.");
    }
  };

  const handleDeleteInventoryItem = async (id: string) => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/inventory/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        }
      });
      if (res.ok) {
        triggerSuccessAlert("Article supprimé de la réserve !");
        await fetchData(true);
      } else {
        const err = await res.json();
        triggerErrorAlert(err.error || "Erreur de suppression.");
      }
    } catch (err) {
      console.error(err);
      triggerErrorAlert("Erreur réseau.");
    }
  };

  // --- FINANCE OPERATIONS ---
  const handleSaveFinanceTransaction = async (trans: Partial<FinanceTransaction>) => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/finance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        },
        body: JSON.stringify(trans)
      });
      if (res.ok) {
        triggerSuccessAlert("Transaction financière enregistrée !");
        await fetchData(true);
        return await res.json();
      } else {
        const err = await res.json();
        triggerErrorAlert(err.error || "Erreur d'enregistrement.");
        throw new Error(err.error);
      }
    } catch (err: any) {
      console.error(err);
      triggerErrorAlert(err.message || "Erreur réseau.");
      throw err;
    }
  };

  const handleDeleteFinanceTransaction = async (id: string) => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/finance/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        }
      });
      if (res.ok) {
        triggerSuccessAlert("Mouvement supprimé !");
        await fetchData(true);
      } else {
        const err = await res.json();
        triggerErrorAlert(err.error || "Erreur de suppression.");
      }
    } catch (err) {
      console.error(err);
      triggerErrorAlert("Erreur réseau.");
    }
  };

  // Render proper tabs content based on sidebar choices
  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard stats={displayStats} currentUser={currentUser!} sessions={sessions} transactions={financeTransactions} inventoryItems={inventoryItems} onNavigate={setActiveTab} isLoading={isDataLoading} />;
      case 'new-client':
        return <NewClient loyalClients={loyalClients} consoles={consoles} sessions={sessions} onSubmit={handleCreateClient} isLoading={isCreatingClient} onSuccess={() => setActiveTab('sessions')} />;
      case 'loyal-clients':
        return <LoyalClients loyalClients={loyalClients} sessions={rawSessions} currentUser={currentUser!} onRefresh={() => fetchData(true)} triggerSuccess={triggerSuccessAlert} triggerError={triggerErrorAlert} />;
      case 'sessions':
        return <SessionsList sessions={filteredSessionsByDate} currentUser={currentUser!} onValidatePayment={handleValidatePayment} onDeleteSession={handleDeleteSession} isLoading={isDataLoading} onRefresh={() => fetchData(false)} inventoryItems={inventoryItems} />;
      case 'payments':
        return <PaymentsList sessions={filteredSessionsByDate} onDeleteSession={handleDeleteSession} currentUser={currentUser!} />;
      case 'reports':
        return <Reports sessions={filteredSessionsByDate} currentUser={currentUser!} startDate={startDate} endDate={endDate} />;
      case 'caisse-report':
        return <CaisseReport sessions={rawSessions} users={users} rooms={rooms} currentUser={currentUser!} onRefresh={() => fetchData(true)} />;
      case 'audit-logs':
        return <AuditLog logs={logs} currentUser={currentUser!} onRefresh={() => fetchData(false)} isLoading={isLogsLoading || isDataLoading} />;
      case 'notifications':
        return <Notifications notifications={notifications} onClear={handleClearNotifications} isLoading={isDataLoading} />;
      case 'delete-requests':
        return <DeleteRequests requests={deleteRequests} currentUser={currentUser!} onResolve={handleResolveDeleteRequest} isLoading={isDataLoading} />;
      case 'consoles':
        return <ConsoleManagement consoles={consoles} sessions={sessions} currentUser={currentUser!} onCreateConsole={handleCreateConsole} onToggleStatus={handleToggleConsoleStatus} onDeleteConsole={handleDeleteConsole} isLoading={isDataLoading} />;
      case 'user-management':
        return <UserManagement users={users} currentUser={currentUser!} onCreateUser={handleCreateUser} onToggleLock={handleToggleLockUser} onChangePassword={handleForceChangePassword} isLoading={isDataLoading} rooms={rooms} onRefreshData={() => fetchData(true)} />;
      case 'inventory':
        return <Inventory items={inventoryItems} currentUser={currentUser!} onAddItem={handleSaveInventoryItem} onAdjustQty={handleAdjustInventoryQty} onDeleteItem={handleDeleteInventoryItem} isLoading={isDataLoading} />;
      case 'finance':
        return <Finance transactions={financeTransactions} sessions={rawSessions} currentUser={currentUser!} onAddTransaction={handleSaveFinanceTransaction} onDeleteTransaction={handleDeleteFinanceTransaction} isLoading={isDataLoading} />;
      case 'parameters':
        return <Parameters currentUser={currentUser!} appUrl={window.location.origin} unpaidAlertEnabled={unpaidAlertEnabled} onToggleUnpaidAlert={handleToggleUnpaidAlert} />;
      default:
        return <Dashboard stats={stats} currentUser={currentUser!} sessions={sessions} transactions={financeTransactions} inventoryItems={inventoryItems} onNavigate={setActiveTab} />;
    }
  };

  // Render Login page if not signed in (theme: pitch dark + gold yellow)
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#070707] text-white flex flex-col justify-center items-center p-4 selection:bg-yellow-500 selection:text-black">
        <div className="max-w-md w-full space-y-8 bg-[#121212] border-2 border-yellow-500/10 p-8 rounded-2xl shadow-2xl relative overflow-hidden">
          
          {/* Subtle design gradient back lights */}
          <div className="absolute top-0 left-1/4 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl rounded-none pointer-events-none"></div>

          {/* App Brand Header */}
          <div className="text-center relative">
            <div className="flex justify-center mb-3">
              <img 
                src={logoImg} 
                alt="Nova Casino Logo" 
                className="w-24 h-24 rounded-full border-2 border-yellow-500 shadow-md p-1 bg-black object-cover" 
              />
            </div>
            <h1 className="text-2xl font-black tracking-widest text-yellow-500">NOVA CASINO</h1>
            <p className="text-xs text-zinc-500 uppercase tracking-widest mt-1">Console PlayStation Haute Performance</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            {loginError && (
              <div className="p-3 bg-red-500/15 border border-red-500/30 text-red-500 text-xs font-semibold rounded-lg flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Username Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Identifiant de session</label>
                <input
                  type="text"
                  placeholder="Saisissez votre pseudo..."
                  className="w-full bg-[#0a0a0a] border border-zinc-800 focus:border-yellow-500 rounded-lg py-2.5 px-3 text-sm text-zinc-200 outline-none transition-colors"
                  value={loginUsername}
                  onChange={e => setLoginUsername(e.target.value)}
                  disabled={isAuthenticating}
                />
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Mot de Passe</label>
                <input
                  type="password"
                  placeholder="Saisissez votre code..."
                  className="w-full bg-[#0a0a0a] border border-zinc-800 focus:border-yellow-500 rounded-lg py-2.5 px-3 text-sm text-zinc-200 outline-none transition-colors"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  disabled={isAuthenticating}
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-black font-extrabold py-3 rounded-lg text-xs tracking-wider uppercase flex items-center justify-center gap-2 transition-all shadow-md shadow-yellow-500/10 cursor-pointer"
            >
              {isAuthenticating ? 'Connexion...' : 'Accéder au Terminal'}
            </button>
          </form>

          {/* Secure watermark */}
          <div className="text-center pt-2 text-[10px] text-zinc-600 font-mono tracking-wider">
            NOVA-CASINO-GAMING-SERVER • SECURITY SECURE
          </div>
        </div>
      </div>
    );
  }

  // Master layout for authenticated users
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-200 flex flex-col md:flex-row selection:bg-yellow-500 selection:text-black">
      
      {/* SUCCESS/ERROR SYSTEM ALERTS */}
      {alertMessage && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-xl flex items-center gap-3 border animate-fade-in ${
          alertMessage.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
            : 'bg-red-500/10 border-red-500/30 text-red-500'
        }`}>
          <div className="font-extrabold text-sm">{alertMessage.text}</div>
        </div>
      )}

      {/* MOBILE HEADER BAR */}
      <header className="md:hidden bg-[#121212] border-b border-zinc-800/80 p-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <img src={logoImg} alt="Nova Casino Emblem" className="w-8 h-8 rounded-full border border-yellow-500 object-cover" />
          <span className="font-black text-yellow-500 tracking-wider text-sm select-none">NOVA CASINO</span>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="text-zinc-400 hover:text-white"
        >
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* VERTICAL LEFT SIDEBAR - conforming to Elegant Dark screenshot */}
      <aside className={`
        fixed md:static inset-y-0 left-0 w-64 bg-[#111111] border-r border-[#facc15]/20 p-5 flex flex-col justify-between z-40 transition-transform duration-350 shrink-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="space-y-6">
          
          {/* Sidebar App Banner */}
          <div className="flex items-center gap-3 pb-4 border-b border-white/5">
            <img 
              src={logoImg} 
              alt="Nova Casino Logo" 
              className="w-11 h-11 rounded-full border-2 border-[#facc15] p-0.5 bg-black object-cover shrink-0" 
            />
            <div>
              <h2 className="font-black text-yellow-500 tracking-widest text-[#facc15] text-base leading-none">NOVA CASINO</h2>
              <p className="text-[10px] text-zinc-500 mt-1 uppercase font-semibold">Salle PlayStation</p>
            </div>
          </div>

          {/* Room Selection Dropdown */}
          <div className="pt-1 pb-3 px-1 border-b border-white/5 space-y-1.5">
            <span className="text-[10px] uppercase tracking-widest font-black text-zinc-500 block">Salle de jeux active</span>
            <select
              value={activeRoomId}
              onChange={(e) => {
                const rid = e.target.value;
                setActiveRoomId(rid);
                localStorage.setItem('nova_active_room_id', rid);
              }}
              className="w-full bg-[#18181b] border border-[#facc15]/20 focus:border-[#facc15] text-[#facc15] text-xs rounded-lg py-2 px-2.5 outline-none transition-all cursor-pointer font-bold"
            >
              {currentUser.role === 'director' && (
                <option value="all">🌐 Toutes les Salles</option>
              )}
              {rooms.map(room => (
                <option key={room.id} value={room.id} className="text-zinc-200">
                  🚪 {room.name} {room.id === 'room-default' ? '(Principale)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Navigation Links List */}
          <nav className="space-y-1">
            {[
              { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
              { id: 'new-client', label: 'Nouveau Client', icon: UserPlus },
              { id: 'loyal-clients', label: 'Clients Fidèles', icon: Heart },
              { id: 'sessions', label: 'Sessions', icon: Gamepad2 },
              { id: 'payments', label: 'Paiements', icon: Coins },
              { id: 'reports', label: 'Rapports', icon: BarChart3 },
              { id: 'caisse-report', label: 'Rapport de caisse', icon: FileSpreadsheet },
              { id: 'notifications', label: 'Notifications', icon: Bell, badge: notifications.length },
              { id: 'delete-requests', label: 'Requêtes suppression', icon: ShieldAlert, badge: deleteRequests.filter(r => r.status === 'pending').length },
              { id: 'consoles', label: 'Gestion Consoles', icon: Gamepad2 },
              { id: 'inventory', label: 'Stock de Réserve', icon: Package },
              { id: 'finance', label: 'Gestion Financière', icon: Wallet, restrictToAdmin: true },
              { id: 'user-management', label: 'Gestion utilisateurs', icon: UserCog, restrictToAdmin: true },
              { id: 'audit-logs', label: "Journal d'activité", icon: History, restrictToDirector: true },
              { id: 'parameters', label: 'Paramètres', icon: Monitor }
            ].map(item => {
              // Hide restricted buttons if role is simple operator or admin
              if (item.restrictToAdmin && currentUser.role === 'user') return null;
              if (item.restrictToDirector && currentUser.role !== 'director') return null;

              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsSidebarOpen(false); // Close drawer on mobile
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isActive 
                      ? 'bg-[#facc15] text-black shadow-lg shadow-yellow-500/20' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </div>

                  {/* Badges for alert numbers */}
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={`font-black text-[9px] px-1.5 py-0.5 rounded-full select-none ${isActive ? 'bg-black text-[#facc15]' : 'bg-yellow-500 text-black'}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Info Avatar Badge Card (screenshot footer) */}
        <div className="pt-4 border-t border-white/5 space-y-3">
          <div className="bg-zinc-900/60 p-3 rounded-xl border border-white/5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-yellow-500 text-black font-black flex items-center justify-center text-sm uppercase shrink-0">
              {currentUser.username.slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-extrabold text-[11px] text-white overflow-hidden text-ellipsis whitespace-nowrap capitalize">
                {currentUser.name}
              </h4>
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider mt-0.5">
                {currentUser.role === 'director' ? 'Directeur Général' : currentUser.role === 'admin' ? 'Administrateur' : 'Caissier'}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 hover:bg-yellow-500/20 font-extrabold py-2 px-3.5 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <LogOut size={14} /> Déconnexion
          </button>
        </div>

      </aside>

      {/* RIGHT SIDE MAIN COLUMN */}
      <div className="flex-1 flex flex-col min-h-screen">
        
        {/* DESKTOP HEADER / STATS BAR */}
        <header className="hidden md:flex h-16 border-b border-white/5 px-8 items-center justify-between shrink-0">
          <div className="flex space-x-8">
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none">
                {startDate || endDate ? "Total Période" : "Total Global"}
              </p>
              <p className="text-xl font-bold text-[#facc15] mt-1">${displayStats.totalRevenue.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#a1a1aa] font-bold uppercase tracking-widest leading-none">Matchs Joués</p>
              <p className="text-xl font-bold text-white mt-1">{displayStats.totalMatches}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#a1a1aa] font-bold uppercase tracking-widest leading-none">Consoles Libres</p>
              <p className="text-xl font-bold text-green-500 mt-1">
                {Math.max(0, (consoles.length > 0 ? consoles.filter(c => c.status === 'active').length : 12) - sessions.filter(s => s.paymentStatus === 'pending').length)}/
                {consoles.length > 0 ? consoles.filter(c => c.status === 'active').length : 12}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setActiveTab('notifications')}
              className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full text-zinc-300 relative transition-all cursor-pointer"
            >
              <span>🔔</span>
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 text-black text-[9px] font-black rounded-full flex items-center justify-center animate-bounce">
                  {notifications.length}
                </span>
              )}
            </button>
            <div 
              onClick={() => setActiveTab('user-management')}
              className="w-9 h-9 bg-zinc-800 rounded-full border border-yellow-500/20 flex items-center justify-center font-bold text-xs uppercase cursor-pointer select-none"
            >
              {currentUser.username.slice(0, 2)}
            </div>
          </div>
        </header>

        {/* Global Overdue Unpaid Sessions Clignotant Warning Banner */}
        {overdueSessions.length > 0 && (
          <div className="bg-red-950/85 border-b border-red-500/35 text-red-100 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xl relative overflow-hidden shrink-0">
            {/* Ambient dynamic warning glow */}
            <div className="absolute inset-0 bg-red-650/5 animate-pulse pointer-events-none" />
            
            <div className="flex items-center gap-3 relative.z-10 text-center md:text-left">
              <span className="text-2xl animate-bounce shrink-0 select-none">🚨</span>
              <div className="space-y-0.5">
                <p className="text-xs font-black text-red-500 uppercase tracking-widest flex items-center justify-center md:justify-start gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                  Alerte Temps Limite : {overdueSessions.length} Session(s) Prolongée(s) !
                </p>
                <div className="text-[11px] text-zinc-400 font-bold leading-normal">
                  Clients de jeu actifs sans règlement depuis plus de <span className="text-yellow-400 font-black">3 Heures</span> :{' '}
                  <span className="text-stone-100 underline decoration-red-500/50 underline-offset-2">
                    {overdueSessions.map(s => `${s.clientName} (Console N° ${s.consoleNumber})`).join(', ')}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('sessions')}
              className="bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white px-5 py-2 rounded-lg text-xs font-black transition-all cursor-pointer whitespace-nowrap shadow-lg shadow-red-500/20"
            >
              Voir les Sessions
            </button>
          </div>
        )}

        {/* DETACHED SCREEN/CONTAINER CONTENT */}
        <main className="flex-1 p-6 md:p-8 max-w-5xl mx-auto w-full overflow-y-auto space-y-6">
          
          {/* Loading overlay indicator in top corner */}
          {isDataLoading && (
            <div className="fixed top-4 left-4 z-50 bg-[#121212]/90 border border-[#facc15]/20 text-[#facc15] text-[10px] uppercase font-bold px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg backdrop-blur">
              <RotateCw size={10} className="animate-spin" />
              <span>Sync Cloud base...</span>
            </div>
          )}

          {/* Calendar Period Filter (Conditional on data tabs: dashboard, sessions, payments, reports) */}
          {['dashboard', 'sessions', 'payments', 'reports'].includes(activeTab) && (
            <PeriodFilter 
              startDate={startDate} 
              endDate={endDate} 
              onChange={(start, end) => {
                setStartDate(start);
                setEndDate(end);
              }} 
            />
          )}

          {renderTabContent()}
        </main>

        {/* DESKTOP FOOTER */}
        <footer className="h-10 bg-yellow-400 text-black px-6 flex items-center justify-between font-bold text-[10px] uppercase tracking-widest select-none">
          <div className="flex space-x-6">
            <span>Système Central Nova Casino</span>
            <span>Contrôle à Distance: Actif</span>
          </div>
          <div className="flex space-x-4">
            <span>Manager Root Access</span>
            <span>v.1.0.4 Mobile & Desktop Ready</span>
          </div>
        </footer>

      </div>

    </div>
  );
}
