import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";

dotenv.config();

// Define basic database types
interface UserRecord {
  id: string;
  username: string;
  name: string;
  password?: string;
  role: 'director' | 'admin' | 'user';
  createdBy: string | null;
  isLocked: boolean;
  status: 'online' | 'offline' | 'locked';
  lastActive: number;
  assignedRoomIds?: string[];
}

interface SessionRecord {
  id: string;
  clientName: string;
  consoleNumber: string;
  phoneNumber: string;
  consoleType: 'ps3' | 'ps4' | 'ps5';
  matchesCount: number;
  costPerMatch: number;
  totalAmount: number;
  paymentStatus: 'pending' | 'paid';
  paymentMethod?: 'cash' | 'mobile_money' | 'card';
  paymentValidatedBy: string | null;
  paymentValidatedByName?: string | null;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  validatedDate?: string | null;
  roomId?: string;
}

interface DeleteRequestRecord {
  id: string;
  targetId: string;
  clientName: string;
  consoleNumber: string;
  requestedBy: string;
  requestedByName: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  resolvedBy: string | null;
  resolvedByName?: string | null;
  resolvedAt: string | null;
}

interface ActivityLogRecord {
  id: string;
  userId: string;
  username: string;
  action: string;
  timestamp: string;
}

interface NotificationRecord {
  id: string;
  title: string;
  message: string;
  type: 'payment_validation' | 'delete_request' | 'system';
  createdAt: string;
  createdBy: string;
  targetAdminId: string | null;
}

// Track if we must fall back to local disk
let useLocalFallback = false;

// Read Firebase config
const configPath = path.join(process.cwd(), "firebase-applet-config.json");
if (!fs.existsSync(configPath)) {
  console.error("CRITICAL ERROR: firebase-applet-config.json not found!");
  process.exit(1);
}

const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

// Initialize Firebase Admin SDK with robust error containment
let adminApp: any = null;
let realFirestoreDb: any = null;

try {
  adminApp = admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });

  // Access the specific firestore database specified in our configuration
  realFirestoreDb = firebaseConfig.firestoreDatabaseId 
    ? getFirestore(adminApp, firebaseConfig.firestoreDatabaseId)
    : getFirestore();
} catch (err: any) {
  console.error("Warning: Failed to initialize Firebase Admin SDK. Fallback database engine activated.", err.message || err);
  useLocalFallback = true;
}

// Quick proactive connection test to Firestore to avoid long hangs on metadata server
async function verifyFirestoreConnection() {
  if (useLocalFallback || !realFirestoreDb) return;
  
  console.log("Proactively testing Firestore connection with a 1.5s timeout...");
  
  const testPromise = realFirestoreDb.collection("rooms").limit(1).get();
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error("Firestore connection timed out (1.5s)")), 1500)
  );

  try {
    await Promise.race([testPromise, timeoutPromise]);
    console.log("Firestore connection verified successfully!");
  } catch (err: any) {
    console.warn(`[Firestore Connection Check] Warning: ${err.message || err}`);
    console.warn("Activating local fallback database engine to prevent interface lockups/hangs.");
    useLocalFallback = true;
  }
}

// LOCAL FALLBACK ENGINE (Transparently replicates Firestore structure for resilience)
const LOCAL_DB_PATH = path.join(process.cwd(), "nova-db.json");
const BACKUP_DB_PATH = path.join(process.cwd(), "nova-db-backup.json");

function readLocalDb(): any {
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const content = fs.readFileSync(LOCAL_DB_PATH, 'utf8');
      if (content.trim()) {
        return JSON.parse(content);
      }
    }
  } catch (err) {
    console.error("Local database principal read error, trying auto-healing from backup...", err);
  }

  // Auto-heal recovery block using redundant backup
  try {
    if (fs.existsSync(BACKUP_DB_PATH)) {
      const content = fs.readFileSync(BACKUP_DB_PATH, 'utf8');
      if (content.trim()) {
        const parsed = JSON.parse(content);
        console.warn("[SECURITY RECOVERY] Restored system database successfully from secure redundancy backup!");
        // Re-write to main path to fix it instantly
        fs.writeFileSync(LOCAL_DB_PATH, content, 'utf8');
        return parsed;
      }
    }
  } catch (errBackup) {
    console.error("Local database backup read/healing error:", errBackup);
  }

  return {
    users: [],
    sessions: [],
    deleteRequests: [],
    logs: [],
    notifications: [],
    consoles: [],
    loyalClients: [],
    inventory: [],
    finance: []
  };
}

function writeLocalDb(data: any) {
  try {
    const tempPath = `${LOCAL_DB_PATH}.tmp`;
    const tempBackupPath = `${BACKUP_DB_PATH}.tmp`;
    const serialized = JSON.stringify(data, null, 2);

    // Write atomically to main temp file then rename (atomic swap)
    fs.writeFileSync(tempPath, serialized, 'utf8');
    fs.renameSync(tempPath, LOCAL_DB_PATH);

    // Write atomically to backup temp file then rename (backup swap)
    fs.writeFileSync(tempBackupPath, serialized, 'utf8');
    fs.renameSync(tempBackupPath, BACKUP_DB_PATH);
  } catch (err) {
    console.error("Local database write or backup sync error:", err);
  }
}

// Use the globally declared local fallback flag

class WrappedDocumentSnapshot {
  id: string;
  exists: boolean;
  collectionName: string;
  realDocSnap: any;
  private _data: any;

  constructor(id: string, exists: boolean, data: any, collectionName: string, realDocSnap?: any) {
    this.id = id;
    this.exists = exists;
    this._data = data;
    this.collectionName = collectionName;
    this.realDocSnap = realDocSnap;
  }

  data() {
    return this._data;
  }

  get ref() {
    const realRef = this.realDocSnap ? this.realDocSnap.ref : null;
    return new WrappedDocumentReference(this.id, this.collectionName, realRef);
  }
}

class WrappedQuerySnapshot {
  docs: WrappedDocumentSnapshot[];
  empty: boolean;
  size: number;

  constructor(docs: WrappedDocumentSnapshot[]) {
    this.docs = docs;
    this.empty = docs.length === 0;
    this.size = docs.length;
  }

  forEach(callback: (doc: any) => void) {
    this.docs.forEach(callback);
  }
}

class WrappedDocumentReference {
  id: string;
  collectionName: string;
  realDocRef: any;

  constructor(id: string, collectionName: string, realDocRef: any) {
    this.id = id;
    this.collectionName = collectionName;
    this.realDocRef = realDocRef;
  }

  async get() {
    if (!useLocalFallback && this.realDocRef) {
      try {
        const snap = await this.realDocRef.get();
        return new WrappedDocumentSnapshot(this.id, snap.exists, snap.data(), this.collectionName, snap);
      } catch (err: any) {
        console.warn(`[Firestore Status Warning] Access/Connection error on GET ${this.collectionName}/${this.id}:`, err.message || err);
        console.warn(`[Firestore Status] Activating local fallback database engine.`);
        useLocalFallback = true;
      }
    }

    const db = readLocalDb();
    const list = db[this.collectionName] || [];
    const record = list.find((item: any) => item.id === this.id);
    return new WrappedDocumentSnapshot(this.id, !!record, record || null, this.collectionName);
  }

  async set(data: any) {
    if (!useLocalFallback && this.realDocRef) {
      try {
        await this.realDocRef.set(data);
        return;
      } catch (err: any) {
        console.warn(`[Firestore Status Warning] Access/Connection error on SET ${this.collectionName}/${this.id}:`, err.message || err);
        console.warn(`[Firestore Status] Activating local fallback database engine.`);
        useLocalFallback = true;
      }
    }

    const db = readLocalDb();
    if (!db[this.collectionName]) db[this.collectionName] = [];
    const list = db[this.collectionName];
    const index = list.findIndex((item: any) => item.id === this.id);
    const finalData = { id: this.id, ...data };
    if (index !== -1) {
      list[index] = finalData;
    } else {
      list.push(finalData);
    }
    writeLocalDb(db);
  }

  async delete() {
    if (!useLocalFallback && this.realDocRef) {
      try {
        await this.realDocRef.delete();
        return;
      } catch (err: any) {
        console.warn(`[Firestore Status Warning] Access/Connection error on DELETE ${this.collectionName}/${this.id}:`, err.message || err);
        console.warn(`[Firestore Status] Activating local fallback database engine.`);
        useLocalFallback = true;
      }
    }

    const db = readLocalDb();
    if (db[this.collectionName]) {
      db[this.collectionName] = db[this.collectionName].filter((item: any) => item.id !== this.id);
      writeLocalDb(db);
    }
  }
}

class WrappedQuery {
  collectionName: string;
  realQuery: any;
  filters: Array<{ field: string, operator: string, value: any }> = [];

  constructor(collectionName: string, realQuery: any, filters: any[] = []) {
    this.collectionName = collectionName;
    this.realQuery = realQuery;
    this.filters = filters;
  }

  where(field: string, operator: string, value: any) {
    const nextRealQuery = this.realQuery ? this.realQuery.where(field, operator, value) : null;
    return new WrappedQuery(this.collectionName, nextRealQuery, [...this.filters, { field, operator, value }]);
  }

  async get() {
    if (!useLocalFallback && this.realQuery) {
      try {
        const snap = await this.realQuery.get();
        const docs = snap.docs.map((doc: any) => new WrappedDocumentSnapshot(doc.id, doc.exists, doc.data(), this.collectionName, doc));
        return new WrappedQuerySnapshot(docs);
      } catch (err: any) {
        console.warn(`[Firestore Status Warning] Access/Connection error on QUERY ${this.collectionName}:`, err.message || err);
        console.warn(`[Firestore Status] Activating local fallback database engine.`);
        useLocalFallback = true;
      }
    }

    const db = readLocalDb();
    let list = db[this.collectionName] || [];
    for (const filter of this.filters) {
      list = list.filter((item: any) => {
        const val = item[filter.field];
        if (filter.operator === "==") {
          return val === filter.value;
        }
        return true;
      });
    }
    const docs = list.map((item: any) => new WrappedDocumentSnapshot(item.id, true, item, this.collectionName));
    return new WrappedQuerySnapshot(docs);
  }
}

class WrappedCollectionReference {
  collectionName: string;
  realCollection: any;

  constructor(collectionName: string, realCollection: any) {
    this.collectionName = collectionName;
    this.realCollection = realCollection;
  }

  doc(id: string) {
    const realDocRef = this.realCollection ? this.realCollection.doc(id) : null;
    return new WrappedDocumentReference(id, this.collectionName, realDocRef);
  }

  where(field: string, operator: string, value: any) {
    const realQuery = this.realCollection ? this.realCollection.where(field, operator, value) : null;
    return new WrappedQuery(this.collectionName, realQuery, [{ field, operator, value }]);
  }

  async get() {
    if (!useLocalFallback && this.realCollection) {
      try {
        const snap = await this.realCollection.get();
        const docs = snap.docs.map((doc: any) => new WrappedDocumentSnapshot(doc.id, doc.exists, doc.data(), this.collectionName, doc));
        return new WrappedQuerySnapshot(docs);
      } catch (err: any) {
        console.warn(`[Firestore Status Warning] Access/Connection error on GET ALL ${this.collectionName}:`, err.message || err);
        console.warn(`[Firestore Status] Activating local fallback database engine.`);
        useLocalFallback = true;
      }
    }

    const db = readLocalDb();
    const list = db[this.collectionName] || [];
    const docs = list.map((item: any) => new WrappedDocumentSnapshot(item.id, true, item, this.collectionName));
    return new WrappedQuerySnapshot(docs);
  }
}

class WrappedBatch {
  private deleteList: Array<{ collectionName: string, id: string, realRef?: any }> = [];

  delete(docRef: any) {
    this.deleteList.push({
      collectionName: docRef.collectionName,
      id: docRef.id,
      realRef: docRef.realDocRef
    });
    return this;
  }

  async commit() {
    if (!useLocalFallback && realFirestoreDb) {
      try {
        const batch = realFirestoreDb.batch();
        for (const item of this.deleteList) {
          if (item.realRef) {
            batch.delete(item.realRef);
          }
        }
        await batch.commit();
        return;
      } catch (err: any) {
        console.warn(`[Firestore Status Warning] Access/Connection error on BATCH COMMIT:`, err.message || err);
        console.warn(`[Firestore Status] Activating local fallback database engine.`);
        useLocalFallback = true;
      }
    }

    const db = readLocalDb();
    for (const item of this.deleteList) {
      if (db[item.collectionName]) {
        db[item.collectionName] = db[item.collectionName].filter((el: any) => el.id !== item.id);
      }
    }
    writeLocalDb(db);
  }
}

const firestoreDb = {
  batch() {
    return new WrappedBatch();
  }
};

// Proxied collection handles that fit perfectly into pre-existing code
const usersCol = new WrappedCollectionReference("users", realFirestoreDb ? realFirestoreDb.collection("users") : null);
const sessionsCol = new WrappedCollectionReference("sessions", realFirestoreDb ? realFirestoreDb.collection("sessions") : null);
const deleteRequestsCol = new WrappedCollectionReference("deleteRequests", realFirestoreDb ? realFirestoreDb.collection("deleteRequests") : null);
const logsCol = new WrappedCollectionReference("logs", realFirestoreDb ? realFirestoreDb.collection("logs") : null);
const notificationsCol = new WrappedCollectionReference("notifications", realFirestoreDb ? realFirestoreDb.collection("notifications") : null);
const consolesCol = new WrappedCollectionReference("consoles", realFirestoreDb ? realFirestoreDb.collection("consoles") : null);
const loyalClientsCol = new WrappedCollectionReference("loyalClients", realFirestoreDb ? realFirestoreDb.collection("loyalClients") : null);
const roomsCol = new WrappedCollectionReference("rooms", realFirestoreDb ? realFirestoreDb.collection("rooms") : null);
const inventoryCol = new WrappedCollectionReference("inventory", realFirestoreDb ? realFirestoreDb.collection("inventory") : null);
const financeCol = new WrappedCollectionReference("finance", realFirestoreDb ? realFirestoreDb.collection("finance") : null);

interface ConsoleRecord {
  id: string;
  name: string;
  type: "ps3" | "ps4" | "ps5";
  status: "active" | "maintenance";
  createdAt: string;
  createdBy: string;
  roomId?: string;
}

interface GameRoomRecord {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  createdBy: string;
  adminId: string | null;      // One Admin assigned (User ID)
  cashierIds: string[];        // Multiple Cashiers assigned (User IDs)
}

// Consoles Seeder
async function seedConsolesIfNeeded() {
  try {
    const consolesSnap = await consolesCol.get();
    if (consolesSnap.empty) {
      console.log("Seeding default consoles into Firestore...");
      const defaultConsoles: ConsoleRecord[] = [
        { id: "c_ps5_1", name: "Console 01", type: "ps5", status: "active", createdAt: new Date().toISOString(), createdBy: "dir-1", roomId: "room-default" },
        { id: "c_ps5_2", name: "Console 02", type: "ps5", status: "active", createdAt: new Date().toISOString(), createdBy: "dir-1", roomId: "room-default" },
        { id: "c_ps5_3", name: "Console 03", type: "ps5", status: "active", createdAt: new Date().toISOString(), createdBy: "dir-1", roomId: "room-default" },
        { id: "c_ps5_4", name: "Console 04", type: "ps5", status: "active", createdAt: new Date().toISOString(), createdBy: "dir-1", roomId: "room-default" },
        { id: "c_ps4_5", name: "Console 05", type: "ps4", status: "active", createdAt: new Date().toISOString(), createdBy: "dir-1", roomId: "room-default" },
        { id: "c_ps4_6", name: "Console 06", type: "ps4", status: "active", createdAt: new Date().toISOString(), createdBy: "dir-1", roomId: "room-default" },
        { id: "c_ps4_7", name: "Console 07", type: "ps4", status: "active", createdAt: new Date().toISOString(), createdBy: "dir-1", roomId: "room-default" },
        { id: "c_ps4_8", name: "Console 08", type: "ps4", status: "active", createdAt: new Date().toISOString(), createdBy: "dir-1", roomId: "room-default" },
        { id: "c_ps3_9", name: "Console 09", type: "ps3", status: "active", createdAt: new Date().toISOString(), createdBy: "dir-1", roomId: "room-default" },
        { id: "c_ps3_10", name: "Console 10", type: "ps3", status: "active", createdAt: new Date().toISOString(), createdBy: "dir-1", roomId: "room-default" },
        { id: "c_ps3_11", name: "Console 11", type: "ps3", status: "active", createdAt: new Date().toISOString(), createdBy: "dir-1", roomId: "room-default" },
        { id: "c_ps3_12", name: "Console 12", type: "ps3", status: "active", createdAt: new Date().toISOString(), createdBy: "dir-1", roomId: "room-default" },
      ];

      for (const consoleItem of defaultConsoles) {
        await consolesCol.doc(consoleItem.id).set(consoleItem);
      }
      console.log("Pre-seeding of 12 PlayStation consoles complete!");
    } else {
      console.log("Consoles already exist in Firestore.");
    }
  } catch (err) {
    console.error("Error during consoles seeding:", err);
  }
}

// Database Seeder
async function seedDBIfNeeded() {
  try {
    // Seed default room if needed
    const roomsSnap = await roomsCol.get();
    if (roomsSnap.empty) {
      console.log("Seeding default room into Firestore...");
      const defaultRoom: GameRoomRecord = {
        id: "room-default",
        name: "Salle Principale",
        description: "La salle de jeux principale par défaut",
        createdAt: new Date().toISOString(),
        createdBy: "dir-1",
        adminId: null,
        cashierIds: []
      };
      await roomsCol.doc(defaultRoom.id).set(defaultRoom);
      console.log("Default room seeded!");
    }

    const directorDoc = await usersCol.doc("dir-1").get();
    if (!directorDoc.exists) {
      console.log("Seeding default database into Firestore...");
      
      const defaultDirector: UserRecord = {
        id: "dir-1",
        username: "Novacasino",
        name: "Directeur Général",
        password: "Muller2@",
        role: "director",
        createdBy: null,
        isLocked: false,
        status: "offline",
        lastActive: Date.now(),
        assignedRoomIds: ["room-default"]
      };
      await usersCol.doc("dir-1").set(defaultDirector);
      
      const initialLog: ActivityLogRecord = {
        id: "log-init",
        userId: "dir-1",
        username: "Novacasino",
        action: "Initialisation du système central Nova Casino dans Firestore",
        timestamp: new Date().toISOString()
      };
      await logsCol.doc("log-init").set(initialLog);
      
      console.log("Firestore database seed complete!");
    } else {
      console.log("Firestore database already contains seeded user.");
    }
    
    // Seed consoles
    await seedConsolesIfNeeded();
  } catch (err) {
    console.error("Error during Firestore seeding:", err);
  }
}

// Log action helper
async function addLog(userId: string, username: string, action: string) {
  try {
    const id = "log_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    const log: ActivityLogRecord = {
      id,
      userId,
      username,
      action,
      timestamp: new Date().toISOString()
    };
    await logsCol.doc(id).set(log);
  } catch (err) {
    console.error("Firestore Error adding log:", err);
  }
}

// Create Notification helper
async function addNotification(
  title: string,
  message: string,
  type: 'payment_validation' | 'delete_request' | 'system',
  createdBy: string,
  targetAdminId: string | null = null
) {
  try {
    const id = "notif_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    const notif: NotificationRecord = {
      id,
      title,
      message,
      type,
      createdAt: new Date().toISOString(),
      createdBy,
      targetAdminId
    };
    await notificationsCol.doc(id).set(notif);
  } catch (err) {
    console.error("Firestore Error adding notification:", err);
  }
}

const PORT = 3000;

async function startServer() {
  await verifyFirestoreConnection();

  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // CORS Middleware: Allow access from any origin, internet site, mail client, or mobile app
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-user-id, x-room-id");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    
    // Allow iframe embedding if desired by external pages
    res.setHeader("Content-Security-Policy", "frame-ancestors *");
    res.setHeader("X-Frame-Options", "ALLOWALL");

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Ensure Database matches required seeds
  await seedDBIfNeeded();

  // Middleware to authenticate and maintain status in real-time
  app.use(async (req, res, next) => {
    const userId = req.headers["x-user-id"] as string;
    if (userId) {
      try {
        const userDoc = await usersCol.doc(userId).get();
        if (userDoc.exists) {
          const user = userDoc.data() as UserRecord;
          user.lastActive = Date.now();
          if (user.status === "offline") {
            user.status = "online";
          }
          if (user.isLocked) {
            user.status = "locked";
          }
          await usersCol.doc(userId).set(user);
          (req as any).user = user;
        }
      } catch (err) {
        console.error("Error in activity middleware:", err);
      }
    }
    next();
  });

  // --- API ROUTES ---

  // Database status helper
  app.get("/api/db-status", (req, res) => {
    res.json({ fallback: useLocalFallback, status: useLocalFallback ? "local" : "firestore" });
  });

  // Auth: Login
  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Identifiant et mot de passe requis." });
    }

    try {
      const q = await usersCol.where("username", "==", username).get();
      if (q.empty) {
        // Fallback for case-insensitivity
        const allUsersSnap = await usersCol.get();
        let matchedUser: UserRecord | null = null;
        allUsersSnap.forEach(d => {
          const u = d.data() as UserRecord;
          if (u.username.toLowerCase() === username.toLowerCase()) {
            matchedUser = u;
          }
        });

        if (!matchedUser) {
          return res.status(401).json({ error: "Utilisateur introuvable." });
        }

        const user = matchedUser as UserRecord;
        if (user.password !== password) {
          return res.status(401).json({ error: "Mot de passe incorrect." });
        }

        if (user.isLocked) {
          return res.status(403).json({ error: "Votre compte est bloqué à distance par votre administrateur." });
        }

        user.status = "online";
        user.lastActive = Date.now();
        await usersCol.doc(user.id).set(user);

        await addLog(user.id, user.username, "Connexion réussie");

        const { password: _, ...safeUser } = user;
        return res.json({ user: safeUser });
      }

      const doc = q.docs[0];
      const user = doc.data() as UserRecord;

      if (user.password !== password) {
        return res.status(401).json({ error: "Mot de passe incorrect." });
      }

      if (user.isLocked) {
        return res.status(403).json({ error: "Votre compte est bloqué à distance par votre administrateur." });
      }

      user.status = "online";
      user.lastActive = Date.now();
      await usersCol.doc(user.id).set(user);

      await addLog(user.id, user.username, "Connexion réussie");

      const { password: _, ...safeUser } = user;
      res.json({ user: safeUser });

    } catch (err) {
      console.error("Login route error:", err);
      res.status(500).json({ error: "Erreur serveur lors de la connexion." });
    }
  });

  // Users: Create User (Admin or Simple operator)
  app.post("/api/users", async (req, res) => {
    const currentUser = (req as any).user as UserRecord | undefined;
    if (!currentUser) {
      return res.status(401).json({ error: "Non authentifié." });
    }

    if (currentUser.role !== "director" && currentUser.role !== "admin") {
      return res.status(403).json({ error: "Seuls les administrateurs peuvent créer des utilisateurs." });
    }

    const { username, name, password, role } = req.body;
    if (!username || !name || !password || !role) {
      return res.status(400).json({ error: "Tous les champs sont requis." });
    }

    if (currentUser.role === "admin" && role !== "user") {
      return res.status(403).json({ error: "Un administrateur simple ne peut créer que des utilisateurs simples." });
    }

    try {
      const q = await usersCol.get();
      let exists = false;
      q.forEach(doc => {
        const u = doc.data() as UserRecord;
        if (u.username.toLowerCase() === username.toLowerCase()) {
          exists = true;
        }
      });

      if (exists) {
        return res.status(400).json({ error: "Cet identifiant d'utilisateur existe déjà." });
      }

      const id = "usr_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
      const newUser: UserRecord = {
        id,
        username,
        name,
        password,
        role,
        createdBy: currentUser.id,
        isLocked: false,
        status: "offline",
        lastActive: Date.now()
      };

      await usersCol.doc(id).set(newUser);

      await addLog(currentUser.id, currentUser.username, `Création de l'utilisateur ${name} (${role})`);
      await addNotification(
        "Nouvel utilisateur",
        `${currentUser.name} a créé le compte ${name} (${role === "admin" ? "Administrateur" : "Caissier"}).`,
        "system",
        currentUser.id
      );

      const { password: _, ...safeUser } = newUser;
      res.json(safeUser);
    } catch (err) {
      console.error("Create User error:", err);
      res.status(500).json({ error: "Erreur serveur lors de la création d'utilisateur." });
    }
  });

  async function getAdminAuthorityUserIds(adminId: string): Promise<string[]> {
    const allowedIds = new Set<string>([adminId]);
    
    try {
      // 1. Get all users created by this admin
      const usersSnap = await usersCol.get();
      usersSnap.forEach(doc => {
        const u = doc.data() as UserRecord;
        if (u && u.createdBy === adminId) {
          allowedIds.add(u.id);
        }
      });

      // 2. Get all cashiers in rooms where this admin is assigned or created the room
      const roomsSnap = await roomsCol.get();
      roomsSnap.forEach(doc => {
        const room = doc.data() as GameRoomRecord;
        if (room && (room.adminId === adminId || room.createdBy === adminId)) {
          if (room.cashierIds && Array.isArray(room.cashierIds)) {
            room.cashierIds.forEach(cid => {
              if (cid) allowedIds.add(cid);
            });
          }
        }
      });
    } catch (e) {
      console.error("Error computing admin authority user ids:", e);
    }

    return Array.from(allowedIds);
  }

  // Users: Get List of Managed Users
  app.get("/api/users", async (req, res) => {
    const currentUser = (req as any).user as UserRecord | undefined;
    if (!currentUser) {
      return res.status(401).json({ error: "Non authentifié." });
    }

    try {
      const snapshot = await usersCol.get();
      const allUsers: UserRecord[] = [];
      snapshot.forEach(doc => {
        allUsers.push(doc.data() as UserRecord);
      });

      // Directory sees ALL
      if (currentUser.role === "director") {
        return res.json(allUsers.map(({ password, ...u }) => u));
      }

      // Admin sees only users under their authority
      if (currentUser.role === "admin") {
        const allowedIds = await getAdminAuthorityUserIds(currentUser.id);
        const managed = allUsers.filter(u => allowedIds.includes(u.id));
        return res.json(managed.map(({ password, ...u }) => u));
      }

      // Simple user only sees themselves
      const self = allUsers.filter(u => u.id === currentUser.id);
      return res.json(self.map(({ password, ...u }) => u));

    } catch (err) {
      console.error("Get Users error:", err);
      res.status(500).json({ error: "Erreur serveur lors du chargement des utilisateurs." });
    }
  });

  // Users: Toggle remotely lock user
  app.post("/api/users/:id/toggle-lock", async (req, res) => {
    const currentUser = (req as any).user as UserRecord | undefined;
    if (!currentUser) {
      return res.status(401).json({ error: "Non authentifié." });
    }

    const { id } = req.params;

    try {
      const doc = await usersCol.doc(id).get();
      if (!doc.exists) {
        return res.status(404).json({ error: "Utilisateur introuvable." });
      }

      const targetUser = doc.data() as UserRecord;

      // Role checks
      if (currentUser.role !== "director") {
        if (currentUser.role === "admin") {
          if (targetUser.createdBy !== currentUser.id) {
            return res.status(403).json({ error: "Vous ne pouvez verrouiller que les utilisateurs que vous avez créés." });
          }
        } else {
          return res.status(403).json({ error: "Permission refusée." });
        }
      }

      if (targetUser.role === "director") {
        return res.status(403).json({ error: "Impossible de verrouiller le compte directeur." });
      }

      targetUser.isLocked = !targetUser.isLocked;
      if (targetUser.isLocked) {
        targetUser.status = "locked";
      } else {
        targetUser.status = "offline";
      }

      await usersCol.doc(id).set(targetUser);

      const statusText = targetUser.isLocked ? "VERROUILLÉ" : "DÉVERROUILLÉ";
      await addLog(currentUser.id, currentUser.username, `${statusText} l'utilisateur ${targetUser.name} à distance`);

      res.json({ success: true, isLocked: targetUser.isLocked });
    } catch (err) {
      console.error("Toggle lock error:", err);
      res.status(500).json({ error: "Erreur lors de la mise à jour du statut de verrouillage." });
    }
  });

  // Users: Change password
  app.post("/api/users/:id/change-password", async (req, res) => {
    const currentUser = (req as any).user as UserRecord | undefined;
    if (!currentUser) {
      return res.status(401).json({ error: "Non authentifié." });
    }

    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.trim().length === 0) {
      return res.status(400).json({ error: "Mot de passe non valide." });
    }

    try {
      const doc = await usersCol.doc(id).get();
      if (!doc.exists) {
        return res.status(404).json({ error: "Utilisateur introuvable." });
      }

      const targetUser = doc.data() as UserRecord;

      const isSelf = currentUser.id === id;
      const isManagerOfTarget = currentUser.role === "director" || (currentUser.role === "admin" && targetUser.createdBy === currentUser.id);

      if (!isSelf && !isManagerOfTarget) {
        return res.status(403).json({ error: "Vous n'avez pas l'autorisation de modifier ce mot de passe." });
      }

      targetUser.password = newPassword;
      await usersCol.doc(id).set(targetUser);

      await addLog(currentUser.id, currentUser.username, `Changement de mot de passe pour ${targetUser.name}`);
      res.json({ success: true });
    } catch (err) {
      console.error("Change password error:", err);
      res.status(500).json({ error: "Erreur lors du changement de mot de passe." });
    }
  });

  // Users: Delete User
  app.post("/api/users/:id/delete", async (req, res) => {
    const currentUser = (req as any).user as UserRecord | undefined;
    if (!currentUser) {
      return res.status(401).json({ error: "Non authentifié." });
    }

    const { id } = req.params;

    if (id === "dir-1") {
      return res.status(403).json({ error: "Le directeur général ne peut pas être supprimé." });
    }

    if (currentUser.id === id) {
      return res.status(403).json({ error: "Vous ne pouvez pas supprimer votre propre compte." });
    }

    try {
      const doc = await usersCol.doc(id).get();
      if (!doc.exists) {
        return res.status(404).json({ error: "Utilisateur introuvable." });
      }

      const targetUser = doc.data() as UserRecord;

      const isDirector = currentUser.role === "director";
      const isAdminManager = currentUser.role === "admin" && targetUser.createdBy === currentUser.id;

      if (!isDirector && !isAdminManager) {
        return res.status(403).json({ error: "Vous n'avez pas l'autorisation de supprimer cet utilisateur." });
      }

      await usersCol.doc(id).delete();
      await addLog(currentUser.id, currentUser.username, `Suppression de l'utilisateur ${targetUser.name} (${targetUser.role})`);
      await addNotification(
        "Utilisateur supprimé",
        `${currentUser.name} a supprimé le compte ${targetUser.name}.`,
        "system",
        currentUser.id
      );

      res.json({ success: true });
    } catch (err) {
      console.error("Delete user error:", err);
      res.status(500).json({ error: "Erreur lors de la suppression de l'utilisateur." });
    }
  });

  // Users: Delete all created users
  app.post("/api/users/delete-all", async (req, res) => {
    const currentUser = (req as any).user as UserRecord | undefined;
    if (!currentUser) {
      return res.status(401).json({ error: "Non authentifié." });
    }

    if (currentUser.role !== "director" && currentUser.role !== "admin") {
      return res.status(403).json({ error: "Permission refusée." });
    }

    try {
      const snapshot = await usersCol.get();
      let deletedCount = 0;
      const promises: Promise<any>[] = [];

      snapshot.forEach(docSnap => {
        const u = docSnap.data() as UserRecord;
        if (u.id === "dir-1" || u.id === currentUser.id) {
          return; // Skip director and current user to prevent self lockouts
        }

        const isDirector = currentUser.role === "director";
        const isAdminManager = currentUser.role === "admin" && u.createdBy === currentUser.id;

        if (isDirector || isAdminManager) {
          promises.push(usersCol.doc(u.id).delete());
          deletedCount++;
        }
      });

      if (promises.length > 0) {
        await Promise.all(promises);
      }

      await addLog(currentUser.id, currentUser.username, `Suppression groupée de tous les utilisateurs créés (${deletedCount} comptes supprimés)`);
      await addNotification(
        "Suppression collective d'utilisateurs",
        `${currentUser.name} a supprimé tous les comptes d'utilisateurs sous sa gestion (${deletedCount} comptes).`,
        "system",
        currentUser.id
      );

      res.json({ success: true, deletedCount });
    } catch (err) {
      console.error("Delete all users error:", err);
      res.status(500).json({ error: "Erreur lors de la suppression de tous les utilisateurs." });
    }
  });

  // --- Game Rooms API ---

  // Get all rooms
  app.get("/api/rooms", async (req, res) => {
    const currentUser = (req as any).user as UserRecord | undefined;
    if (!currentUser) {
      return res.status(401).json({ error: "Non authentifié." });
    }

    try {
      const snap = await roomsCol.get();
      const allRooms: GameRoomRecord[] = [];
      snap.forEach(doc => {
        allRooms.push(doc.data() as GameRoomRecord);
      });

      // Director sees everything
      if (currentUser.role === "director") {
        return res.json(allRooms);
      }

      // Admin or Cashier (user) sees only assigned rooms
      const filtered = allRooms.filter(r => 
        r.adminId === currentUser.id || 
        (r.cashierIds && r.cashierIds.includes(currentUser.id)) ||
        r.createdBy === currentUser.id
      );
      res.json(filtered);
    } catch (err) {
      console.error("Get rooms error:", err);
      res.status(500).json({ error: "Erreur lors du chargement des salles de jeux." });
    }
  });

  // Create game room
  app.post("/api/rooms", async (req, res) => {
    const currentUser = (req as any).user as UserRecord | undefined;
    if (!currentUser) {
      return res.status(401).json({ error: "Non authentifié." });
    }

    if (currentUser.role !== "director") {
      return res.status(403).json({ error: "Seuls les directeurs peuvent créer une salle de jeux." });
    }

    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Le nom de la salle est obligatoire." });
    }

    try {
      const id = "room_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
      const newRoom: GameRoomRecord = {
        id,
        name: name.trim(),
        description: (description || "").trim(),
        createdAt: new Date().toISOString(),
        createdBy: currentUser.id,
        adminId: null,
        cashierIds: []
      };

      await roomsCol.doc(id).set(newRoom);

      // Link room to creator automatically
      const currentRooms = currentUser.assignedRoomIds || [];
      if (!currentRooms.includes(id)) {
        currentRooms.push(id);
        currentUser.assignedRoomIds = currentRooms;
        await usersCol.doc(currentUser.id).set(currentUser);
      }

      await addLog(currentUser.id, currentUser.username, `Création de la salle de jeux : ${newRoom.name}`);
      res.status(201).json(newRoom);
    } catch (err) {
      console.error("Create room error:", err);
      res.status(500).json({ error: "Erreur lors de la création de la salle." });
    }
  });

  // Assign users to a game room
  app.post("/api/rooms/:id/assign", async (req, res) => {
    const currentUser = (req as any).user as UserRecord | undefined;
    if (!currentUser) {
      return res.status(401).json({ error: "Non authentifié." });
    }

    if (currentUser.role !== "director") {
      return res.status(403).json({ error: "Seuls les directeurs peuvent assigner des utilisateurs." });
    }

    const { id } = req.params;
    const { adminId, cashierIds } = req.body;

    try {
      const roomDoc = await roomsCol.doc(id).get();
      if (!roomDoc.exists) {
        return res.status(404).json({ error: "Salle de jeux introuvable." });
      }

      const room = roomDoc.data() as GameRoomRecord;

      if (currentUser.role !== "director" && room.createdBy !== currentUser.id) {
        return res.status(403).json({ error: "Vous n'avez pas l'autorisation de modifier les assignations de cette salle." });
      }

      room.adminId = adminId || null;
      room.cashierIds = cashierIds || [];
      await roomsCol.doc(id).set(room);

      // Update users documents with their assignedRoomIds
      const usersSnap = await usersCol.get();
      for (const uDoc of usersSnap.docs) {
        const u = uDoc.data() as UserRecord;
        if (u.id === "dir-1") continue;

        let changed = false;
        const assigned = u.assignedRoomIds || [];

        const isAssigned = u.id === adminId || (cashierIds && cashierIds.includes(u.id));

        if (isAssigned) {
          if (!assigned.includes(id)) {
            assigned.push(id);
            changed = true;
          }
        } else {
          if (assigned.includes(id)) {
            const index = assigned.indexOf(id);
            if (index > -1) {
              assigned.splice(index, 1);
              changed = true;
            }
          }
        }

        if (changed) {
          u.assignedRoomIds = assigned;
          await usersCol.doc(u.id).set(u);
        }
      }

      await addLog(currentUser.id, currentUser.username, `Mise à jour des assignations pour la salle : ${room.name}`);
      res.json({ success: true, room });
    } catch (err) {
      console.error("Assign users to room error:", err);
      res.status(500).json({ error: "Erreur lors de l'assignation des collaborateurs." });
    }
  });

  // Delete a game room
  app.post("/api/rooms/:id/delete", async (req, res) => {
    const currentUser = (req as any).user as UserRecord | undefined;
    if (!currentUser) {
      return res.status(401).json({ error: "Non authentifié." });
    }

    if (currentUser.role !== "director") {
      return res.status(403).json({ error: "Seul le Directeur Général peut supprimer une salle." });
    }

    const { id } = req.params;
    if (id === "room-default") {
      return res.status(403).json({ error: "La salle de jeux par défaut ne peut pas être supprimée." });
    }

    try {
      const roomDoc = await roomsCol.doc(id).get();
      if (!roomDoc.exists) {
        return res.status(404).json({ error: "Salle de jeux introuvable." });
      }

      await roomsCol.doc(id).delete();
      await addLog(currentUser.id, currentUser.username, `Suppression de la salle de jeux : ${roomDoc.data()?.name || id}`);
      res.json({ success: true });
    } catch (err) {
      console.error("Delete room error:", err);
      res.status(500).json({ error: "Erreur lors de la suppression de la salle de jeux." });
    }
  });

  // Sessions: Create Session
  app.post("/api/sessions", async (req, res) => {
    const currentUser = (req as any).user as UserRecord | undefined;
    if (!currentUser) {
      return res.status(401).json({ error: "Non authentifié." });
    }

    const { clientName, consoleNumber, phoneNumber, consoleType, matchesCount, saveAsLoyal, drinksCount, snacksCount } = req.body;
    if (!clientName || !consoleNumber || !consoleType || matchesCount === undefined) {
      return res.status(400).json({ error: "Champs obligatoires manquants." });
    }

    const matches = parseInt(matchesCount);
    if (isNaN(matches) || matches <= 0) {
      return res.status(400).json({ error: "Le nombre de matchs doit être supérieur à 0." });
    }

    let cost = 0;
    if (consoleType === "ps5") cost = 0.50;
    else if (consoleType === "ps4") cost = 0.25;
    else if (consoleType === "ps3") cost = 0.10;
    else {
      return res.status(400).json({ error: "Type de console non supporté." });
    }

    const drinks = parseInt(drinksCount) || 0;
    const snacks = parseInt(snacksCount) || 0;
    const drinksCost = parseFloat((drinks * 0.8).toFixed(2));
    const snacksCost = parseFloat((snacks * 1.0).toFixed(2));
    const matchesCost = matches * cost;
    const totalAmount = parseFloat((matchesCost + drinksCost + snacksCost).toFixed(2));

    try {
      // Check if console is already busy
      const pendingSnap = await sessionsCol.get();
      let isBusy = false;
      pendingSnap.forEach(doc => {
        const s = doc.data();
        if (s.paymentStatus === "pending" && s.consoleNumber.toLowerCase() === consoleNumber.trim().toLowerCase()) {
          isBusy = true;
        }
      });

      if (isBusy) {
        return res.status(400).json({ error: `La console "${consoleNumber}" est déjà occupée par un autre client.` });
      }

      // Auto-register client to loyalClients db if requested
      if (saveAsLoyal) {
        try {
          const snap = await loyalClientsCol.get();
          let alreadyExists = false;
          snap.forEach(doc => {
            const lc = doc.data();
            if (lc.name && lc.name.toLowerCase() === clientName.trim().toLowerCase()) {
              alreadyExists = true;
            }
          });

          if (!alreadyExists) {
            const lcId = "lc_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
            await loyalClientsCol.doc(lcId).set({
              id: lcId,
              name: clientName.trim(),
              phone: (phoneNumber || "").trim(),
              notes: "Enregistré automatiquement depuis une session de jeu",
              createdAt: new Date().toISOString()
            });
            await addLog(currentUser.id, currentUser.username, `Création automatique client fidèle: ${clientName.trim()}`);
          }
        } catch (lErr) {
          console.warn("Silent failure saving automatic loyal client:", lErr);
        }
      }

      const roomId = req.headers["x-room-id"] as string || "room-default";

      const id = "sess_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
      const newSession: any = {
        id,
        clientName,
        consoleNumber,
        phoneNumber: phoneNumber || "",
        consoleType,
        matchesCount: matches,
        costPerMatch: cost,
        drinksCount: drinks,
        snacksCount: snacks,
        drinksAmount: drinksCost,
        snacksAmount: snacksCost,
        totalAmount,
        paymentStatus: "pending",
        paymentValidatedBy: null,
        createdBy: currentUser.id,
        createdByName: currentUser.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        roomId
      };

      await sessionsCol.doc(id).set(newSession);

      await addLog(currentUser.id, currentUser.username, `Création session de jeu: ${clientName} (${consoleType.toUpperCase()}, ${matches} matchs)`);

      res.json(newSession);
    } catch (err) {
      console.error("Create Session error:", err);
      res.status(500).json({ error: "Erreur serveur lors de la création de la session." });
    }
  });

  // Sessions: Add consumables to an ongoing session
  app.post("/api/sessions/:id/add-consumables", async (req, res) => {
    const currentUser = (req as any).user as UserRecord | undefined;
    if (!currentUser) {
      return res.status(401).json({ error: "Non authentifié." });
    }

    const { id } = req.params;
    const { drinksCount, snacksCount } = req.body;

    try {
      const doc = await sessionsCol.doc(id).get();
      if (!doc.exists) {
        return res.status(404).json({ error: "Session introuvable." });
      }

      const session = doc.data() as any;
      if (session.paymentStatus === "paid" && currentUser.role !== "admin" && currentUser.role !== "director") {
        return res.status(400).json({ error: "Le paiement est déjà validé. Seuls les administrateurs et le directeur peuvent y ajouter des consommations." });
      }

      const dCount = parseInt(drinksCount) || 0;
      const sCount = parseInt(snacksCount) || 0;

      // Deduct or restore stock
      if (dCount !== 0) {
        const docB = await inventoryCol.doc("inv-boissons").get();
        if (docB.exists) {
          const itemB = docB.data();
          itemB.quantity = Math.max(0, (itemB.quantity || 0) - dCount);
          itemB.lastUpdated = new Date().toISOString();
          itemB.updatedBy = currentUser.name;
          await inventoryCol.doc("inv-boissons").set(itemB);
        }
      }
      if (sCount !== 0) {
        const docS = await inventoryCol.doc("inv-snacks").get();
        if (docS.exists) {
          const itemS = docS.data();
          itemS.quantity = Math.max(0, (itemS.quantity || 0) - sCount);
          itemS.lastUpdated = new Date().toISOString();
          itemS.updatedBy = currentUser.name;
          await inventoryCol.doc("inv-snacks").set(itemS);
        }
      }

      session.drinksCount = Math.max(0, (session.drinksCount || 0) + dCount);
      session.snacksCount = Math.max(0, (session.snacksCount || 0) + sCount);
      session.drinksAmount = parseFloat((session.drinksCount * 0.8).toFixed(2));
      session.snacksAmount = parseFloat((session.snacksCount * 1.0).toFixed(2));

      const matchesCost = session.matchesCount * session.costPerMatch;
      session.totalAmount = parseFloat((matchesCost + session.drinksAmount + session.snacksAmount).toFixed(2));
      session.updatedAt = new Date().toISOString();

      await sessionsCol.doc(id).set(session);

      await addLog(
        currentUser.id, 
        currentUser.username, 
        `Mise à jour consommations session ${session.clientName}: ${dCount >= 0 ? '+' : ''}${dCount} boissons, ${sCount >= 0 ? '+' : ''}${sCount} snacks`
      );

      res.json(session);
    } catch (err) {
      console.error("Add consumables error:", err);
      res.status(500).json({ error: "Erreur serveur lors de l'ajout des consommations." });
    }
  });

  // Remove consumable (reset drinks or snacks to 0) directly for admins/directors
  app.post("/api/sessions/:id/remove-consumable", async (req, res) => {
    const currentUser = (req as any).user as UserRecord | undefined;
    if (!currentUser) {
      return res.status(401).json({ error: "Non authentifié." });
    }

    if (currentUser.role !== "admin" && currentUser.role !== "director") {
      return res.status(403).json({ error: "Seuls les administrateurs et le directeur peuvent supprimer directement les consommations." });
    }

    const { id } = req.params;
    const { type } = req.body; // "drinks" | "snacks"

    try {
      const doc = await sessionsCol.doc(id).get();
      if (!doc.exists) {
        return res.status(404).json({ error: "Session introuvable." });
      }

      const session = doc.data() as any;
      if (type === "drinks") {
        const restored = session.drinksCount || 0;
        session.drinksCount = 0;
        session.drinksAmount = 0;
        if (restored > 0) {
          const docB = await inventoryCol.doc("inv-boissons").get();
          if (docB.exists) {
            const itemB = docB.data();
            itemB.quantity = (itemB.quantity || 0) + restored;
            itemB.lastUpdated = new Date().toISOString();
            itemB.updatedBy = currentUser.name;
            await inventoryCol.doc("inv-boissons").set(itemB);
          }
        }
      } else if (type === "snacks") {
        const restored = session.snacksCount || 0;
        session.snacksCount = 0;
        session.snacksAmount = 0;
        if (restored > 0) {
          const docS = await inventoryCol.doc("inv-snacks").get();
          if (docS.exists) {
            const itemS = docS.data();
            itemS.quantity = (itemS.quantity || 0) + restored;
            itemS.lastUpdated = new Date().toISOString();
            itemS.updatedBy = currentUser.name;
            await inventoryCol.doc("inv-snacks").set(itemS);
          }
        }
      }

      const matchesCost = session.matchesCount * session.costPerMatch;
      session.totalAmount = parseFloat((matchesCost + (session.drinksAmount || 0) + (session.snacksAmount || 0)).toFixed(2));
      session.updatedAt = new Date().toISOString();

      await sessionsCol.doc(id).set(session);
      await addLog(currentUser.id, currentUser.username, `Suppression directe des ${type === 'drinks' ? 'boissons' : 'snacks'} pour la session de ${session.clientName}`);
      res.json(session);
    } catch (err) {
      console.error("Remove consumable error:", err);
      res.status(500).json({ error: "Erreur serveur lors de la suppression de la consommation." });
    }
  });

  // Sessions: Get Game Sessions List
  app.get("/api/sessions", async (req, res) => {
    const currentUser = (req as any).user as UserRecord | undefined;
    if (!currentUser) {
      return res.status(401).json({ error: "Non authentifié." });
    }

    const reqRoomId = req.headers["x-room-id"] as string;

    try {
      const snapshot = await sessionsCol.get();
      const allSessions: SessionRecord[] = [];
      snapshot.forEach(doc => {
        allSessions.push(doc.data() as SessionRecord);
      });

      // Filter by room if specified
      let roomFilteredSessions = allSessions;
      if (reqRoomId && reqRoomId !== "all") {
        roomFilteredSessions = allSessions.filter(s => {
          const sRoomId = s.roomId || "room-default";
          return sRoomId === reqRoomId;
        });
      }

      // 1. Director sees roomFilteredSessions
      if (currentUser.role === "director") {
        return res.json(roomFilteredSessions);
      }

      // 2. Admin sees sessions created by themselves or by users they manage, or validated by them
      if (currentUser.role === "admin") {
        const allowedIds = await getAdminAuthorityUserIds(currentUser.id);
        const filtered = roomFilteredSessions.filter(s => 
          allowedIds.includes(s.createdBy) || 
          (s.paymentValidatedBy && allowedIds.includes(s.paymentValidatedBy))
        );
        return res.json(filtered);
      }

      // 3. Simple user sees sessions they created or validated
      const filtered = roomFilteredSessions.filter(s => 
        s.createdBy === currentUser.id || 
        s.paymentValidatedBy === currentUser.id
      );
      return res.json(filtered);

    } catch (err) {
      console.error("Get Sessions error:", err);
      res.status(500).json({ error: "Erreur serveur lors du chargement des sessions." });
    }
  });

  // Sessions: Validate Payment
  app.post("/api/sessions/:id/validate", async (req, res) => {
    const currentUser = (req as any).user as UserRecord | undefined;
    if (!currentUser) {
      return res.status(401).json({ error: "Non authentifié." });
    }

    const { id } = req.params;

    try {
      const doc = await sessionsCol.doc(id).get();
      if (!doc.exists) {
        return res.status(404).json({ error: "Session introuvable." });
      }

      const session = doc.data() as SessionRecord;
      if (session.paymentStatus === "paid") {
        return res.status(400).json({ error: "Le paiement est déjà validé." });
      }

      const { paymentMethod, localDate } = req.body || {};

      session.paymentStatus = "paid";
      session.paymentMethod = paymentMethod || "cash";
      session.paymentValidatedBy = currentUser.id;
      session.paymentValidatedByName = currentUser.name;
      session.updatedAt = new Date().toISOString();
      session.validatedDate = localDate || new Date().toISOString().split("T")[0];

      await sessionsCol.doc(id).set(session);

      // Instantly record financial transaction in financeCol
      try {
        const transId = `fin-sess-${id}`;
        const transData = {
          id: transId,
          type: "income",
          category: "Session PlayStation",
          amount: session.totalAmount,
          description: `Session validée pour le client ${session.clientName} (Console: ${session.consoleNumber}) [Mode: ${session.paymentMethod === 'mobile_money' ? 'Mobile Money' : session.paymentMethod === 'card' ? 'Carte de crédit' : 'Cash'}]`,
          date: session.validatedDate,
          createdBy: currentUser.id,
          createdByName: currentUser.name,
          createdAt: new Date().toISOString(),
          sessionId: id,
          paymentMethod: session.paymentMethod
        };
        await financeCol.doc(transId).set(transData);
      } catch (finErr) {
        console.error("Error creating financial transaction during validation:", finErr);
      }

      await addLog(currentUser.id, currentUser.username, `Paiement validé (${session.paymentMethod}): ${session.clientName} - ${session.totalAmount}$`);
      
      // Get creator's admin
      const creatorDoc = await usersCol.doc(session.createdBy).get();
      const targetAdmin = creatorDoc.exists ? (creatorDoc.data() as UserRecord).createdBy : null;

      await addNotification(
        "Validation de paiement",
        `${currentUser.name} a validé le paiement de ${session.totalAmount}$ pour la console ${session.consoleNumber} (Client: ${session.clientName}).`,
        "payment_validation",
        currentUser.id,
        targetAdmin
      );

      res.json(session);
    } catch (err) {
      console.error("Validate payment error:", err);
      res.status(500).json({ error: "Erreur lors de la validation du paiement." });
    }
  });

  // Sessions: Update invoice (Director & Admin only)
  app.post("/api/sessions/:id/update-invoice", async (req, res) => {
    const currentUser = (req as any).user as UserRecord | undefined;
    if (!currentUser) {
      return res.status(401).json({ error: "Non authentifié." });
    }

    if (currentUser.role !== "director" && currentUser.role !== "admin") {
      return res.status(403).json({ error: "Droit d'accès refusé. Seuls le directeur ou les administrateurs peuvent modifier une facture." });
    }

    const { id } = req.params;
    const { 
      clientName, 
      phoneNumber, 
      consoleNumber, 
      consoleType, 
      matchesCount, 
      drinksCount, 
      snacksCount, 
      paymentStatus, 
      paymentMethod, 
      totalAmount,
      localDate
    } = req.body;

    try {
      const sDoc = await sessionsCol.doc(id).get();
      if (!sDoc.exists) {
        return res.status(404).json({ error: "Session introuvable." });
      }

      const session = sDoc.data() as any;
      const oldStatus = session.paymentStatus;
      const oldDrinks = session.drinksCount || 0;
      const oldSnacks = session.snacksCount || 0;

      // Update basic fields if provided
      if (clientName !== undefined) session.clientName = clientName;
      if (phoneNumber !== undefined) session.phoneNumber = phoneNumber;
      if (consoleNumber !== undefined) session.consoleNumber = consoleNumber;
      if (consoleType !== undefined) {
        session.consoleType = consoleType;
        let cost = 0.50;
        if (consoleType === "ps5") cost = 0.50;
        else if (consoleType === "ps4") cost = 0.25;
        else if (consoleType === "ps3") cost = 0.10;
        session.costPerMatch = cost;
      }

      if (matchesCount !== undefined) {
        session.matchesCount = parseInt(matchesCount) || 0;
      }

      // Update and adjust stock for drinks
      if (drinksCount !== undefined) {
        const newDrinks = parseInt(drinksCount) || 0;
        const diffDrinks = newDrinks - oldDrinks;
        if (diffDrinks !== 0) {
          const docB = await inventoryCol.doc("inv-boissons").get();
          if (docB.exists) {
            const itemB = docB.data();
            itemB.quantity = Math.max(0, (itemB.quantity || 0) - diffDrinks);
            itemB.lastUpdated = new Date().toISOString();
            itemB.updatedBy = currentUser.name;
            await inventoryCol.doc("inv-boissons").set(itemB);
          }
        }
        session.drinksCount = newDrinks;
        session.drinksAmount = parseFloat((newDrinks * 0.8).toFixed(2));
      }

      // Update and adjust stock for snacks
      if (snacksCount !== undefined) {
        const newSnacks = parseInt(snacksCount) || 0;
        const diffSnacks = newSnacks - oldSnacks;
        if (diffSnacks !== 0) {
          const docS = await inventoryCol.doc("inv-snacks").get();
          if (docS.exists) {
            const itemS = docS.data();
            itemS.quantity = Math.max(0, (itemS.quantity || 0) - diffSnacks);
            itemS.lastUpdated = new Date().toISOString();
            itemS.updatedBy = currentUser.name;
            await inventoryCol.doc("inv-snacks").set(itemS);
          }
        }
        session.snacksCount = newSnacks;
        session.snacksAmount = parseFloat((newSnacks * 1.0).toFixed(2));
      }

      // Recalculate or override totalAmount
      if (totalAmount !== undefined) {
        session.totalAmount = parseFloat(totalAmount) || 0;
      } else {
        const matchesCost = session.matchesCount * (session.costPerMatch || 0.50);
        const drinksCost = session.drinksAmount || 0;
        const snacksCost = session.snacksAmount || 0;
        session.totalAmount = parseFloat((matchesCost + drinksCost + snacksCost).toFixed(2));
      }

      if (paymentStatus !== undefined) {
        session.paymentStatus = paymentStatus;
        if (paymentStatus === "paid" && oldStatus !== "paid") {
          session.paymentValidatedBy = currentUser.id;
          session.paymentValidatedByName = currentUser.name;
          session.validatedDate = localDate || new Date().toISOString().split("T")[0];
        } else if (paymentStatus === "paid" && oldStatus === "paid") {
          session.validatedDate = session.validatedDate || localDate || new Date().toISOString().split("T")[0];
        } else if (paymentStatus !== "paid") {
          session.paymentValidatedBy = null;
          session.paymentValidatedByName = null;
          session.validatedDate = null;
        }
      }

      if (paymentMethod !== undefined) {
        session.paymentMethod = paymentMethod;
      }

      session.updatedAt = new Date().toISOString();

      await sessionsCol.doc(id).set(session);

      // Manage/Synchronize financial transactions
      const transId = `fin-sess-${id}`;
      if (session.paymentStatus === "paid") {
        // Record or update financial transaction
        const transData = {
          id: transId,
          type: "income",
          category: "Session PlayStation",
          amount: session.totalAmount,
          description: `Session validée/modifiée pour le client ${session.clientName} (Console: ${session.consoleNumber}) [Mode: ${session.paymentMethod === 'mobile_money' ? 'Mobile Money' : session.paymentMethod === 'card' ? 'Carte de crédit' : 'Cash'}]`,
          date: session.validatedDate || localDate || (session.updatedAt ? session.updatedAt.split("T")[0] : new Date().toISOString().split("T")[0]),
          createdBy: session.paymentValidatedBy || currentUser.id,
          createdByName: session.paymentValidatedByName || currentUser.name,
          createdAt: new Date().toISOString(),
          sessionId: id,
          paymentMethod: session.paymentMethod || "cash"
        };
        await financeCol.doc(transId).set(transData);
      } else {
        // If status changed from paid to pending/cancelled, clean up the finance transaction
        try {
          await financeCol.doc(transId).delete();
        } catch (fErr) {
          // ignore if it doesn't exist
        }
      }

      await addLog(
        currentUser.id, 
        currentUser.username, 
        `Modification facture session ${session.clientName} par ${currentUser.role}: Nouveau total=${session.totalAmount}$, Statut=${session.paymentStatus}`
      );

      res.json(session);
    } catch (err) {
      console.error("Update Invoice error:", err);
      res.status(500).json({ error: "Erreur serveur lors de la modification de la facture." });
    }
  });

  // Create deletion request / Direct delete
  app.post("/api/sessions/:id/delete", async (req, res) => {
    const currentUser = (req as any).user as UserRecord | undefined;
    if (!currentUser) {
      return res.status(401).json({ error: "Non authentifié." });
    }

    const { id } = req.params;

    try {
      const sDoc = await sessionsCol.doc(id).get();
      if (!sDoc.exists) {
        return res.status(404).json({ error: "Session introuvable." });
      }

      const session = sDoc.data() as SessionRecord;

      // Check if user is Admin or Director (Allowed direct deletion)
      if (currentUser.role === "director" || currentUser.role === "admin") {
        // Execute direct delete
        await sessionsCol.doc(id).delete();

        // Clean up financial transaction
        try {
          await financeCol.doc(`fin-sess-${id}`).delete();
        } catch (finErr) {
          console.warn("Could not clean up financial transaction during direct delete:", finErr);
        }
        
        // Restore stock for drinks and snacks if any
        try {
          if ((session as any).drinksCount > 0) {
            const docB = await inventoryCol.doc("inv-boissons").get();
            if (docB.exists) {
              const itemB = docB.data();
              if (itemB) {
                itemB.quantity = (itemB.quantity || 0) + (session as any).drinksCount;
                itemB.lastUpdated = new Date().toISOString();
                itemB.updatedBy = currentUser.name;
                await inventoryCol.doc("inv-boissons").set(itemB);
              }
            }
          }
        } catch (stockErr) {
          console.warn("Could not restore drinks stock during direct delete:", stockErr);
        }

        try {
          if ((session as any).snacksCount > 0) {
            const docS = await inventoryCol.doc("inv-snacks").get();
            if (docS.exists) {
              const itemS = docS.data();
              if (itemS) {
                itemS.quantity = (itemS.quantity || 0) + (session as any).snacksCount;
                itemS.lastUpdated = new Date().toISOString();
                itemS.updatedBy = currentUser.name;
                await inventoryCol.doc("inv-snacks").set(itemS);
              }
            }
          }
        } catch (stockErr) {
          console.warn("Could not restore snacks stock during direct delete:", stockErr);
        }

        // Clean up associated delete requests
        try {
          const reqsSnap = await deleteRequestsCol.where("targetId", "==", id).get();
          if (reqsSnap && reqsSnap.docs && reqsSnap.docs.length > 0) {
            const batch = firestoreDb.batch();
            reqsSnap.forEach(doc => {
              if (doc && doc.ref) {
                batch.delete(doc.ref);
              }
            });
            await batch.commit();
          }
        } catch (cleanErr) {
          console.warn("Could not clean up delete requests during direct delete:", cleanErr);
        }

        await addLog(currentUser.id, currentUser.username, `SUPPRESSION DIRECTE client: ${session.clientName}`);
        return res.json({ success: true, deleted: true });
      }

      // Simple user creates delete request
      const reqsSnap = await deleteRequestsCol.where("targetId", "==", id).where("status", "==", "pending").get();
      if (!reqsSnap.empty) {
        return res.status(400).json({ error: "Une requête de suppression est déjà en attente pour ce client." });
      }

      const reqId = "req_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
      const newRequest: DeleteRequestRecord = {
        id: reqId,
        targetId: id,
        clientName: session.clientName,
        consoleNumber: session.consoleNumber,
        requestedBy: currentUser.id,
        requestedByName: currentUser.name,
        requestedAt: new Date().toISOString(),
        status: "pending",
        resolvedBy: null,
        resolvedAt: null
      };

      await deleteRequestsCol.doc(reqId).set(newRequest);

      await addLog(currentUser.id, currentUser.username, `Demande de suppression créée pour ${session.clientName}`);
      
      await addNotification(
        "Requête de suppression",
        `${currentUser.name} demande la suppression de ${session.clientName} (Console ${session.consoleNumber}).`,
        "delete_request",
        currentUser.id,
        currentUser.createdBy
      );

      res.json({ success: true, deleted: false, request: newRequest });

    } catch (err) {
      console.error("Delete session error:", err);
      res.status(500).json({ error: "Erreur lors de la suppression." });
    }
  });

  // Get Delete Requests List
  app.get("/api/delete-requests", async (req, res) => {
    const currentUser = (req as any).user as UserRecord | undefined;
    if (!currentUser) {
      return res.status(401).json({ error: "Non authentifié." });
    }

    try {
      const snapshot = await deleteRequestsCol.get();
      const allRequests: DeleteRequestRecord[] = [];
      snapshot.forEach(doc => {
        allRequests.push(doc.data() as DeleteRequestRecord);
      });

      if (currentUser.role === "director") {
        return res.json(allRequests);
      }

      if (currentUser.role === "admin") {
        const allowedIds = await getAdminAuthorityUserIds(currentUser.id);
        const filtered = allRequests.filter(r => allowedIds.includes(r.requestedBy));
        return res.json(filtered);
      }

      const filtered = allRequests.filter(r => r.requestedBy === currentUser.id);
      return res.json(filtered);

    } catch (err) {
      console.error("Get delete requests error:", err);
      res.status(500).json({ error: "Erreur de chargement des requêtes de suppression." });
    }
  });

  // Resolve Delete Request (Approve / Reject)
  app.post("/api/delete-requests/:id/resolve", async (req, res) => {
    const currentUser = (req as any).user as UserRecord | undefined;
    if (!currentUser) {
      return res.status(401).json({ error: "Non authentifié." });
    }

    if (currentUser.role !== "director" && currentUser.role !== "admin") {
      return res.status(403).json({ error: "Seuls les administrateurs peuvent approuver ou rejeter les requêtes." });
    }

    const { id } = req.params;
    const { action } = req.body;

    if (action !== "approve" && action !== "reject") {
      return res.status(400).json({ error: "Action non valide." });
    }

    try {
      const doc = await deleteRequestsCol.doc(id).get();
      if (!doc.exists) {
        return res.status(404).json({ error: "Requête introuvable." });
      }

      const reqRecord = doc.data() as DeleteRequestRecord;
      if (reqRecord.status !== "pending") {
        return res.status(400).json({ error: "Cette requête a déjà été résolue." });
      }

      if (currentUser.role === "admin") {
        const allowedIds = await getAdminAuthorityUserIds(currentUser.id);
        const isManagedByCurrent = allowedIds.includes(reqRecord.requestedBy);
        if (!isManagedByCurrent) {
          return res.status(403).json({ error: "Vous n'avez pas l'autorisation de résoudre cette requête." });
        }
      }

      reqRecord.status = action === "approve" ? "approved" : "rejected";
      reqRecord.resolvedBy = currentUser.id;
      reqRecord.resolvedByName = currentUser.name;
      reqRecord.resolvedAt = new Date().toISOString();

      await deleteRequestsCol.doc(id).set(reqRecord);

      if (action === "approve") {
        try {
          // Fetch session first to restore stock
          const sessionDoc = await sessionsCol.doc(reqRecord.targetId).get();
          if (sessionDoc.exists) {
            const session = sessionDoc.data() as any;
            if (session.drinksCount > 0) {
              const docB = await inventoryCol.doc("inv-boissons").get();
              if (docB.exists) {
                const itemB = docB.data();
                itemB.quantity = (itemB.quantity || 0) + session.drinksCount;
                itemB.lastUpdated = new Date().toISOString();
                itemB.updatedBy = currentUser.name;
                await inventoryCol.doc("inv-boissons").set(itemB);
              }
            }
            if (session.snacksCount > 0) {
              const docS = await inventoryCol.doc("inv-snacks").get();
              if (docS.exists) {
                const itemS = docS.data();
                itemS.quantity = (itemS.quantity || 0) + session.snacksCount;
                itemS.lastUpdated = new Date().toISOString();
                itemS.updatedBy = currentUser.name;
                await inventoryCol.doc("inv-snacks").set(itemS);
              }
            }
          }
        } catch (stockErr) {
          console.warn("Could not restore stock during deletion request resolution:", stockErr);
        }

        await sessionsCol.doc(reqRecord.targetId).delete();

        // Clean up financial transaction
        try {
          await financeCol.doc(`fin-sess-${reqRecord.targetId}`).delete();
        } catch (finErr) {
          console.warn("Could not clean up financial transaction during request delete:", finErr);
        }

        await addLog(currentUser.id, currentUser.username, `Approbation suppression client: ${reqRecord.clientName}`);
      } else {
        await addLog(currentUser.id, currentUser.username, `Rejet suppression client: ${reqRecord.clientName}`);
      }

      res.json(reqRecord);
    } catch (err) {
      console.error("Resolve delete request error:", err);
      res.status(500).json({ error: "Erreur de résolution de la requête." });
    }
  });

  // Get notifications
  app.get("/api/notifications", async (req, res) => {
    const currentUser = (req as any).user as UserRecord | undefined;
    if (!currentUser) {
      return res.status(401).json({ error: "Non authentifié." });
    }

    try {
      const snapshot = await notificationsCol.get();
      const allNotifs: NotificationRecord[] = [];
      snapshot.forEach(doc => {
        allNotifs.push(doc.data() as NotificationRecord);
      });

      if (currentUser.role === "director") {
        return res.json(allNotifs);
      }

      if (currentUser.role === "admin") {
        const filtered = allNotifs.filter(
          n => n.targetAdminId === currentUser.id || n.targetAdminId === null
        );
        return res.json(filtered);
      }

      return res.json([]);
    } catch (err) {
      console.error("Get notifications error:", err);
      res.status(500).json({ error: "Erreur de chargement des notifications." });
    }
  });

  // Clear / Read notifications
  app.post("/api/notifications/clear", async (req, res) => {
    const currentUser = (req as any).user as UserRecord | undefined;
    if (!currentUser) {
      return res.status(401).json({ error: "Non authentifié." });
    }

    try {
      if (currentUser.role === "director") {
        const snap = await notificationsCol.get();
        const batch = firestoreDb.batch();
        snap.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      } else if (currentUser.role === "admin") {
        const snap = await notificationsCol.where("targetAdminId", "==", currentUser.id).get();
        const batch = firestoreDb.batch();
        snap.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      }
      res.json({ success: true });
    } catch (err) {
      console.error("Clear notifications error:", err);
      res.status(500).json({ error: "Erreur de nettoyage des notifications." });
    }
  });

  // Get Logs list
  app.get("/api/logs", async (req, res) => {
    const currentUser = (req as any).user as UserRecord | undefined;
    if (!currentUser) {
      return res.status(401).json({ error: "Non authentifié." });
    }

    try {
      const snapshot = await logsCol.get();
      const allLogs: ActivityLogRecord[] = [];
      snapshot.forEach(doc => {
        allLogs.push(doc.data() as ActivityLogRecord);
      });

      // Sort logs descending by timestamp
      allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      if (currentUser.role === "director") {
        return res.json(allLogs);
      }

      if (currentUser.role === "admin") {
        const allowedIds = await getAdminAuthorityUserIds(currentUser.id);
        const filtered = allLogs.filter(l => allowedIds.includes(l.userId));
        return res.json(filtered);
      }

      const filtered = allLogs.filter(l => l.userId === currentUser.id);
      return res.json(filtered);

    } catch (err) {
      console.error("Get logs error:", err);
      res.status(500).json({ error: "Erreur lors du chargement des journaux de logs." });
    }
  });

  // Automated Stats route
  app.get("/api/stats", async (req, res) => {
    const currentUser = (req as any).user as UserRecord | undefined;
    if (!currentUser) {
      return res.status(401).json({ error: "Non authentifié." });
    }

    const reqRoomId = req.headers["x-room-id"] as string;

    try {
      const snap = await sessionsCol.get();
      const allSessions: SessionRecord[] = [];
      snap.forEach(doc => {
        allSessions.push(doc.data() as SessionRecord);
      });

      let visibleSessions = allSessions;
      if (reqRoomId && reqRoomId !== "all") {
        visibleSessions = visibleSessions.filter(s => {
          const sRoomId = s.roomId || "room-default";
          return sRoomId === reqRoomId;
        });
      }

      if (currentUser.role === "admin") {
        const allowedIds = await getAdminAuthorityUserIds(currentUser.id);
        visibleSessions = visibleSessions.filter(s => allowedIds.includes(s.createdBy));
      } else if (currentUser.role === "user") {
        visibleSessions = visibleSessions.filter(s => s.createdBy === currentUser.id);
      }

      const totalClients = visibleSessions.length;
      const paidSessions = visibleSessions.filter(s => s.paymentStatus === "paid");
      const totalRevenue = parseFloat(paidSessions.reduce((acc, s) => acc + s.totalAmount, 0).toFixed(2));
      const totalPending = parseFloat(visibleSessions.filter(s => s.paymentStatus === "pending").reduce((acc, s) => acc + s.totalAmount, 0).toFixed(2));
      const totalMatches = visibleSessions.reduce((acc, s) => acc + s.matchesCount, 0);

      const categories = {
        ps5: { sessionsCount: 0, matchesCount: 0, revenue: 0 },
        ps4: { sessionsCount: 0, matchesCount: 0, revenue: 0 },
        ps3: { sessionsCount: 0, matchesCount: 0, revenue: 0 }
      };

      visibleSessions.forEach(s => {
        const type = s.consoleType;
        if (categories[type]) {
          categories[type].sessionsCount++;
          categories[type].matchesCount += s.matchesCount;
          if (s.paymentStatus === "paid") {
            categories[type].revenue = parseFloat((categories[type].revenue + s.totalAmount).toFixed(2));
          }
        }
      });

      res.json({
        totalClients,
        totalMatches,
        totalRevenue,
        totalPending,
        categories
      });

    } catch (err) {
      console.error("Get stats error:", err);
      res.status(500).json({ error: "Erreur de génération des statistiques." });
    }
  });

  // --- PlayStation Consoles API ---
  
  // Get all consoles
  app.get("/api/consoles", async (req, res) => {
    const currentUser = (req as any).user as UserRecord | undefined;
    if (!currentUser) {
      return res.status(401).json({ error: "Non authentifié." });
    }

    const reqRoomId = req.headers["x-room-id"] as string;

    try {
      const snap = await consolesCol.get();
      const allConsoles: ConsoleRecord[] = [];
      snap.forEach(doc => {
        allConsoles.push(doc.data() as ConsoleRecord);
      });

      // Filter by room
      let roomFilteredConsoles = allConsoles;
      if (reqRoomId && reqRoomId !== "all") {
        roomFilteredConsoles = allConsoles.filter(c => {
          const cRoomId = c.roomId || "room-default";
          return cRoomId === reqRoomId;
        });
      }

      // Sort by console name (natural alphanumeric sort)
      roomFilteredConsoles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
      res.json(roomFilteredConsoles);
    } catch (err) {
      console.error("Get consoles error:", err);
      res.status(500).json({ error: "Erreur lors de la récupération des consoles PlayStation." });
    }
  });

  // Create a new console (Director and Admin only)
  app.post("/api/consoles", async (req, res) => {
    const currentUser = (req as any).user as UserRecord | undefined;
    if (!currentUser) {
      return res.status(401).json({ error: "Non authentifié." });
    }

    if (currentUser.role !== "director" && currentUser.role !== "admin") {
      return res.status(403).json({ error: "Action réservée aux administrateurs." });
    }

    const { name, type, status } = req.body;
    if (!name || !type) {
      return res.status(400).json({ error: "Le nom et le type de console sont obligatoires." });
    }

    if (type !== "ps3" && type !== "ps4" && type !== "ps5") {
      return res.status(400).json({ error: "Type de console non conforme (ps3, ps4, ps5)." });
    }

    const roomId = req.headers["x-room-id"] as string || "room-default";

    try {
      const id = "console_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
      const newConsole: ConsoleRecord = {
        id,
        name: name.trim(),
        type,
        status: status || "active",
        createdAt: new Date().toISOString(),
        createdBy: currentUser.id,
        roomId
      };

      await consolesCol.doc(id).set(newConsole);
      await addLog(currentUser.id, currentUser.username, `Création de console: ${newConsole.name} (${newConsole.type.toUpperCase()})`);

      res.status(201).json(newConsole);
    } catch (err) {
      console.error("Create console error:", err);
      res.status(500).json({ error: "Erreur lors de la création de la console." });
    }
  });

  // Toggle console status (Director and Admin only)
  app.post("/api/consoles/:id/toggle-status", async (req, res) => {
    const currentUser = (req as any).user as UserRecord | undefined;
    if (!currentUser) {
      return res.status(401).json({ error: "Non authentifié." });
    }

    if (currentUser.role !== "director" && currentUser.role !== "admin") {
      return res.status(403).json({ error: "Action réservée aux administrateurs." });
    }

    const { id } = req.params;

    try {
      const consoleDoc = await consolesCol.doc(id).get();
      if (!consoleDoc.exists) {
        return res.status(404).json({ error: "Console introuvable." });
      }

      const consoleData = consoleDoc.data() as ConsoleRecord;
      consoleData.status = consoleData.status === "active" ? "maintenance" : "active";

      await consolesCol.doc(id).set(consoleData);
      await addLog(currentUser.id, currentUser.username, `Statut console modifié: ${consoleData.name} est maintenant en ${consoleData.status === 'active' ? 'Service/Actif' : 'Maintenance'}`);

      res.json(consoleData);
    } catch (err) {
      console.error("Toggle console status error:", err);
      res.status(500).json({ error: "Erreur lors de la mise à jour du statut." });
    }
  });

  // Delete a console (Director and Admin only)
  app.post("/api/consoles/:id/delete", async (req, res) => {
    const currentUser = (req as any).user as UserRecord | undefined;
    if (!currentUser) {
      return res.status(401).json({ error: "Non authentifié." });
    }

    if (currentUser.role !== "director" && currentUser.role !== "admin") {
      return res.status(403).json({ error: "Action réservée aux administrateurs." });
    }

    const { id } = req.params;

    try {
      const consoleDoc = await consolesCol.doc(id).get();
      if (!consoleDoc.exists) {
        return res.status(404).json({ error: "Console introuvable." });
      }

      const consoleData = consoleDoc.data() as ConsoleRecord;
      await consolesCol.doc(id).delete();
      await addLog(currentUser.id, currentUser.username, `Suppression de console de jeu: ${consoleData.name}`);

      res.json({ success: true });
    } catch (err) {
      console.error("Delete console error:", err);
      res.status(500).json({ error: "Erreur lors de la suppression de la console." });
    }
  });

  // --- LOYAL CLIENTS API ---
  // Get all loyal clients
  app.get("/api/loyal-clients", async (req, res) => {
    const currentUser = (req as any).user as UserRecord | undefined;
    if (!currentUser) {
      return res.status(401).json({ error: "Non authentifié." });
    }

    try {
      const snap = await loyalClientsCol.get();
      const allClients: any[] = [];
      snap.forEach(doc => {
        allClients.push(doc.data());
      });
      // Sort alphabetically by name
      allClients.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      res.json(allClients);
    } catch (err) {
      console.error("Get loyal clients error:", err);
      res.status(500).json({ error: "Erreur lors de la récupération des clients fidèles." });
    }
  });

  // Create a loyal client
  app.post("/api/loyal-clients", async (req, res) => {
    const currentUser = (req as any).user as UserRecord | undefined;
    if (!currentUser) {
      return res.status(401).json({ error: "Non authentifié." });
    }

    const { name, phone, notes } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Le nom complet du client est obligatoire." });
    }

    try {
      // Check if duplicate name already exists
      const snap = await loyalClientsCol.get();
      let isDup = false;
      snap.forEach(doc => {
        if (doc.data().name.toLowerCase() === name.trim().toLowerCase()) {
          isDup = true;
        }
      });

      if (isDup) {
        return res.status(400).json({ error: "Un client fidèle porte déjà ce nom." });
      }

      const id = "lc_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
      const newClient = {
        id,
        name: name.trim(),
        phone: (phone || "").trim(),
        notes: (notes || "").trim(),
        createdAt: new Date().toISOString()
      };

      await loyalClientsCol.doc(id).set(newClient);
      await addLog(currentUser.id, currentUser.username, `Création client fidèle: ${newClient.name}`);

      res.json(newClient);
    } catch (err) {
      console.error("Create loyal client error:", err);
      res.status(500).json({ error: "Erreur lors de la création du client fidèle." });
    }
  });

  // Update a loyal client
  app.post("/api/loyal-clients/:id/update", async (req, res) => {
    const currentUser = (req as any).user as UserRecord | undefined;
    if (!currentUser) {
      return res.status(401).json({ error: "Non authentifié." });
    }

    const { id } = req.params;
    const { name, phone, notes } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Le nom complet du client est obligatoire." });
    }

    try {
      const clientDoc = await loyalClientsCol.doc(id).get();
      if (!clientDoc.exists) {
        return res.status(404).json({ error: "Client fidèle introuvable." });
      }

      const clientData = clientDoc.data();
      const updatedClient = {
        ...clientData,
        name: name.trim(),
        phone: (phone || "").trim(),
        notes: (notes || "").trim(),
        updatedAt: new Date().toISOString()
      };

      await loyalClientsCol.doc(id).set(updatedClient);
      await addLog(currentUser.id, currentUser.username, `Modification client fidèle: ${updatedClient.name}`);

      res.json(updatedClient);
    } catch (err) {
      console.error("Update loyal client error:", err);
      res.status(500).json({ error: "Erreur lors de la modification du client." });
    }
  });

  // Delete a loyal client
  app.post("/api/loyal-clients/:id/delete", async (req, res) => {
    const currentUser = (req as any).user as UserRecord | undefined;
    if (!currentUser) {
      return res.status(401).json({ error: "Non authentifié." });
    }

    if (currentUser.role !== "director" && currentUser.role !== "admin") {
      return res.status(403).json({ error: "Seuls les gérants et administrateurs peuvent supprimer un client." });
    }

    const { id } = req.params;

    try {
      const clientDoc = await loyalClientsCol.doc(id).get();
      if (!clientDoc.exists) {
        return res.status(404).json({ error: "Client fidèle introuvable." });
      }

      const clientData = clientDoc.data();
      await loyalClientsCol.doc(id).delete();
      await addLog(currentUser.id, currentUser.username, `Suppression client fidèle: ${clientData.name}`);

      res.json({ success: true });
    } catch (err) {
      console.error("Delete loyal client error:", err);
      res.status(500).json({ error: "Erreur lors de la suppression du client." });
    }
  });

  // ==========================================
  // --- RESERVE STOCK MANAGEMENT (INVENTORY) ---
  // ==========================================

  // Get all inventory items (auto-seeds defaults if empty)
  app.get("/api/inventory", async (req, res) => {
    const currentUser = (req as any).user as UserRecord | undefined;
    if (!currentUser) {
      return res.status(401).json({ error: "Non authentifié." });
    }

    try {
      const snap = await inventoryCol.get();
      let items: any[] = [];
      snap.forEach(doc => {
        items.push(doc.data());
      });

      // If empty, auto-seed default items
      if (items.length === 0) {
        const defaults = [
          { id: "inv-manette", name: "Manettes PS4/PS5", category: "Manette", quantity: 15, minQuantity: 4, location: "Armoire Réserve A", lastUpdated: new Date().toISOString(), updatedBy: "Système" },
          { id: "inv-hdmi", name: "Câbles HDMI High-Speed", category: "Câbles HDMI", quantity: 10, minQuantity: 2, location: "Boîte Câblerie", lastUpdated: new Date().toISOString(), updatedBy: "Système" },
          { id: "inv-charge", name: "Câbles de chargement Type-C", category: "Cables de chargement", quantity: 12, minQuantity: 3, location: "Boîte Câblerie", lastUpdated: new Date().toISOString(), updatedBy: "Système" },
          { id: "inv-tv", name: "Télévisions Smart TV 4K", category: "Tele", quantity: 8, minQuantity: 1, location: "Salle Principale / Stock", lastUpdated: new Date().toISOString(), updatedBy: "Système" },
          { id: "inv-ps3", name: "Consoles PlayStation 3 Slim", category: "PS3", quantity: 4, minQuantity: 1, location: "Étagère Consoles", lastUpdated: new Date().toISOString(), updatedBy: "Système" },
          { id: "inv-ps4", name: "Consoles PlayStation 4 Pro", category: "Ps4", quantity: 6, minQuantity: 2, location: "Étagère Consoles", lastUpdated: new Date().toISOString(), updatedBy: "Système" },
          { id: "inv-ps5", name: "Consoles PlayStation 5 Digital", category: "Ps5", quantity: 10, minQuantity: 2, location: "Étagère Consoles", lastUpdated: new Date().toISOString(), updatedBy: "Système" }
        ];

        for (const d of defaults) {
          await inventoryCol.doc(d.id).set(d);
          items.push(d);
        }
        await addLog(currentUser.id, currentUser.username, "Initialisation automatique du stock de réserve par défaut");
      }

      // Ensure inv-boissons and inv-snacks exist separately
      const checkB = await inventoryCol.doc("inv-boissons").get();
      if (!checkB.exists) {
        const itemB = { id: "inv-boissons", name: "Stock Boissons", category: "Boissons", quantity: 100, minQuantity: 20, location: "Réserve Boissons / Frigo", lastUpdated: new Date().toISOString(), updatedBy: "Système" };
        await inventoryCol.doc("inv-boissons").set(itemB);
        // Replace or add to items list
        const existingIdx = items.findIndex(i => i.id === "inv-boissons");
        if (existingIdx !== -1) items[existingIdx] = itemB;
        else items.push(itemB);
      }
      const checkS = await inventoryCol.doc("inv-snacks").get();
      if (!checkS.exists) {
        const itemS = { id: "inv-snacks", name: "Stock Snacks", category: "Snacks", quantity: 100, minQuantity: 20, location: "Étagère Snacks", lastUpdated: new Date().toISOString(), updatedBy: "Système" };
        await inventoryCol.doc("inv-snacks").set(itemS);
        const existingIdx = items.findIndex(i => i.id === "inv-snacks");
        if (existingIdx !== -1) items[existingIdx] = itemS;
        else items.push(itemS);
      }

      res.json(items);
    } catch (err) {
      console.error("Get inventory error:", err);
      res.status(500).json({ error: "Erreur de chargement du stock de réserve." });
    }
  });

  // Create or Update an inventory item
  app.post("/api/inventory", async (req, res) => {
    const currentUser = (req as any).user as UserRecord | undefined;
    if (!currentUser) {
      return res.status(401).json({ error: "Non authentifié." });
    }

    if (currentUser.role !== "admin" && currentUser.role !== "director") {
      return res.status(403).json({ error: "Seuls les administrateurs et le directeur peuvent modifier le stock." });
    }

    const { id, name, category, quantity, minQuantity, location } = req.body;
    if (!name || !category) {
      return res.status(400).json({ error: "Le nom et la catégorie sont requis." });
    }

    try {
      const itemId = id || `inv-${Date.now()}`;
      const itemData = {
        id: itemId,
        name,
        category,
        quantity: typeof quantity === "number" ? quantity : 0,
        minQuantity: typeof minQuantity === "number" ? minQuantity : 1,
        location: location || "Réserve",
        lastUpdated: new Date().toISOString(),
        updatedBy: currentUser.name
      };

      await inventoryCol.doc(itemId).set(itemData);
      await addLog(currentUser.id, currentUser.username, `Stock mis à jour: ${name} (${quantity} en stock)`);
      res.json(itemData);
    } catch (err) {
      console.error("Save inventory error:", err);
      res.status(500).json({ error: "Erreur lors de l'enregistrement du stock." });
    }
  });

  // Adjust inventory quantity directly
  app.post("/api/inventory/:id/adjust", async (req, res) => {
    const currentUser = (req as any).user as UserRecord | undefined;
    if (!currentUser) {
      return res.status(401).json({ error: "Non authentifié." });
    }

    if (currentUser.role !== "admin" && currentUser.role !== "director") {
      return res.status(403).json({ error: "Seuls les administrateurs et le directeur peuvent modifier le stock." });
    }

    const { id } = req.params;
    const { amount } = req.body; // positive or negative

    if (typeof amount !== "number") {
      return res.status(400).json({ error: "Le montant d'ajustement est invalide." });
    }

    try {
      const itemDoc = await inventoryCol.doc(id).get();
      if (!itemDoc.exists) {
        return res.status(404).json({ error: "Article de stock introuvable." });
      }

      const item = itemDoc.data();
      const newQty = Math.max(0, (item.quantity || 0) + amount);
      item.quantity = newQty;
      item.lastUpdated = new Date().toISOString();
      item.updatedBy = currentUser.name;

      await inventoryCol.doc(id).set(item);
      await addLog(currentUser.id, currentUser.username, `Quantité ajustée pour ${item.name}: ${amount > 0 ? '+' : ''}${amount} (Nouveau stock: ${newQty})`);
      res.json(item);
    } catch (err) {
      console.error("Adjust inventory error:", err);
      res.status(500).json({ error: "Erreur lors de l'ajustement de la quantité." });
    }
  });

  // Delete inventory item
  app.delete("/api/inventory/:id", async (req, res) => {
    const currentUser = (req as any).user as UserRecord | undefined;
    if (!currentUser) {
      return res.status(401).json({ error: "Non authentifié." });
    }

    if (currentUser.role !== "admin" && currentUser.role !== "director") {
      return res.status(403).json({ error: "Seuls les administrateurs et le directeur peuvent modifier le stock." });
    }

    const { id } = req.params;

    try {
      const itemDoc = await inventoryCol.doc(id).get();
      if (!itemDoc.exists) {
        return res.status(404).json({ error: "Article introuvable." });
      }
      const itemData = itemDoc.data();
      await inventoryCol.doc(id).delete();
      await addLog(currentUser.id, currentUser.username, `Article supprimé de la réserve: ${itemData.name}`);
      res.json({ success: true });
    } catch (err) {
      console.error("Delete inventory error:", err);
      res.status(500).json({ error: "Erreur lors de la suppression de l'article." });
    }
  });

  // ==========================================
  // --- FINANCIAL MANAGEMENT (FINANCE) ---
  // ==========================================

  // Get all financial transactions
  app.get("/api/finance", async (req, res) => {
    const currentUser = (req as any).user as UserRecord | undefined;
    if (!currentUser) {
      return res.status(401).json({ error: "Non authentifié." });
    }

    try {
      const snap = await financeCol.get();
      const transactions: any[] = [];
      snap.forEach(doc => {
        transactions.push(doc.data());
      });

      // Sort transactions descending by date
      transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      res.json(transactions);
    } catch (err) {
      console.error("Get finance error:", err);
      res.status(500).json({ error: "Erreur lors de la récupération des transactions financières." });
    }
  });

  // Add a financial transaction
  app.post("/api/finance", async (req, res) => {
    const currentUser = (req as any).user as UserRecord | undefined;
    if (!currentUser) {
      return res.status(401).json({ error: "Non authentifié." });
    }

    const { type, category, amount, description, date } = req.body;
    if (!type || !category || typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ error: "Champs obligatoires manquants ou invalides." });
    }

    try {
      const transId = `fin-${Date.now()}`;
      const transData = {
        id: transId,
        type, // 'income' | 'expense'
        category,
        amount,
        description: description || "",
        date: date || new Date().toISOString().split('T')[0],
        createdBy: currentUser.id,
        createdByName: currentUser.name,
        createdAt: new Date().toISOString()
      };

      await financeCol.doc(transId).set(transData);

      // Deduct stock for express or manual drink/snack sales
      if (category === "Vente boissons") {
        const count = Math.round(amount / 0.8) || 1;
        const docB = await inventoryCol.doc("inv-boissons").get();
        if (docB.exists) {
          const itemB = docB.data();
          itemB.quantity = Math.max(0, (itemB.quantity || 0) - count);
          itemB.lastUpdated = new Date().toISOString();
          itemB.updatedBy = currentUser.name;
          await inventoryCol.doc("inv-boissons").set(itemB);
        }
      } else if (category === "Vente snacks") {
        const count = Math.round(amount / 1.0) || 1;
        const docS = await inventoryCol.doc("inv-snacks").get();
        if (docS.exists) {
          const itemS = docS.data();
          itemS.quantity = Math.max(0, (itemS.quantity || 0) - count);
          itemS.lastUpdated = new Date().toISOString();
          itemS.updatedBy = currentUser.name;
          await inventoryCol.doc("inv-snacks").set(itemS);
        }
      }

      await addLog(
        currentUser.id, 
        currentUser.username, 
        `Flux Financier enregistré: ${type === 'income' ? 'Entrée' : 'Dépense'} - ${amount}$ (${category})`
      );
      res.json(transData);
    } catch (err) {
      console.error("Add finance transaction error:", err);
      res.status(500).json({ error: "Erreur lors de l'enregistrement de la transaction." });
    }
  });

  // Delete financial transaction
  app.delete("/api/finance/:id", async (req, res) => {
    const currentUser = (req as any).user as UserRecord | undefined;
    if (!currentUser) {
      return res.status(401).json({ error: "Non authentifié." });
    }

    const { id } = req.params;

    try {
      const doc = await financeCol.doc(id).get();
      if (!doc.exists) {
        return res.status(404).json({ error: "Transaction financière introuvable." });
      }

      const transData = doc.data() as any;
      await financeCol.doc(id).delete();

      // Restore stock for deleted drink/snack sales
      if (transData.category === "Vente boissons") {
        const count = Math.round(transData.amount / 0.8) || 1;
        const docB = await inventoryCol.doc("inv-boissons").get();
        if (docB.exists) {
          const itemB = docB.data();
          itemB.quantity = (itemB.quantity || 0) + count;
          itemB.lastUpdated = new Date().toISOString();
          itemB.updatedBy = currentUser.name;
          await inventoryCol.doc("inv-boissons").set(itemB);
        }
      } else if (transData.category === "Vente snacks") {
        const count = Math.round(transData.amount / 1.0) || 1;
        const docS = await inventoryCol.doc("inv-snacks").get();
        if (docS.exists) {
          const itemS = docS.data();
          itemS.quantity = (itemS.quantity || 0) + count;
          itemS.lastUpdated = new Date().toISOString();
          itemS.updatedBy = currentUser.name;
          await inventoryCol.doc("inv-snacks").set(itemS);
        }
      }

      await addLog(
        currentUser.id, 
        currentUser.username, 
        `Flux Financier supprimé: ${transData.type === 'income' ? 'Entrée' : 'Dépense'} - ${transData.amount}$`
      );
      res.json({ success: true });
    } catch (err) {
      console.error("Delete finance transaction error:", err);
      res.status(500).json({ error: "Erreur lors de la suppression de la transaction financière." });
    }
  });

  // --- VITE MIDDLEWARE ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Nova Central Server connected to Firestore running on http://localhost:${PORT}`);
  });
}

startServer();
