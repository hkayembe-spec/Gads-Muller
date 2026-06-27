/**
 * Types for Nova Casino PlayStation room management system
 */

export type UserRole = 'director' | 'admin' | 'user';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  createdBy: string | null; // ID of the admin who created them
  isLocked: boolean;
  status: 'online' | 'offline' | 'locked';
  lastActive: number; // timestamp
  assignedRoomIds?: string[]; // IDs of gaming rooms this user can manage/access
}

export type ConsoleType = 'ps3' | 'ps4' | 'ps5';

export interface PlayStationConsole {
  id: string;
  name: string;
  type: ConsoleType;
  status: 'active' | 'maintenance';
  createdAt: string;
  createdBy: string;
  roomId?: string; // Associated game room ID
}

export interface ClientSession {
  id: string;
  clientName: string; // Nom complet
  consoleNumber: string; // Numéro de la console
  phoneNumber: string; // Numéro de téléphone
  consoleType: ConsoleType; // PS3, PS4, PS5
  matchesCount: number; // Nombre de matchs à jouer
  costPerMatch: number; // Calculated: ps5=0.5, ps4=0.25, ps3=0.1
  drinksCount?: number; // Drinks quantity
  snacksCount?: number; // Snacks quantity
  drinksAmount?: number; // Drinks cost
  snacksAmount?: number; // Snacks cost
  totalAmount: number; // MatchesCount * CostPerMatch + beverages + snacks
  paymentStatus: 'pending' | 'paid';
  paymentMethod?: 'cash' | 'mobile_money' | 'card';
  paymentValidatedBy: string | null; // User name/id who validated it
  paymentValidatedByName?: string | null;
  createdBy: string; // User ID who created the session
  createdByName: string; // User name who created it
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  validatedDate?: string | null;
  roomId?: string; // Associated game room ID
}

export interface DeleteRequest {
  id: string;
  targetId: string; // ClientSession ID
  clientName: string;
  consoleNumber: string;
  requestedBy: string; // User ID
  requestedByName: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  resolvedBy: string | null;
  resolvedByName?: string | null;
  resolvedAt: string | null;
}

export interface ActivityLog {
  id: string;
  userId: string;
  username: string;
  action: string;
  timestamp: string;
}

export interface GameNotification {
  id: string;
  title: string;
  message: string;
  type: 'payment_validation' | 'delete_request' | 'system';
  createdAt: string;
  readBy: string[]; // List of user IDs who acknowledged it
  targetAdminId?: string | null;
}

export interface LoyalClient {
  id: string;
  name: string;
  phone: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface GameRoom {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  createdBy: string;
  adminId: string | null;      // One Admin assigned (User ID)
  cashierIds: string[];        // Multiple Cashiers assigned (User IDs)
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  minQuantity: number;
  location: string;
  lastUpdated: string;
  updatedBy: string;
}

export interface FinanceTransaction {
  id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string;
  date: string; // YYYY-MM-DD
  createdBy: string;
  createdByName: string;
  createdAt: string;
  paymentMethod?: 'cash' | 'mobile_money' | 'card';
}
