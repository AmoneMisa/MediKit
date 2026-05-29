export type MedicineForm =
  | 'tablets' | 'capsules' | 'syrup' | 'spray'
  | 'drops' | 'ointment' | 'injection' | 'powder'
  | 'patch' | 'other';

export type MedicineStatus = 'ok' | 'expiring_soon' | 'expired' | 'low_stock';

export interface CompositionItem {
  name: string;
  amount?: string;
}

export interface Medicine {
  id: string;
  kitId: string;
  name: string;
  manufacturer?: string;
  activeIngredient?: string;
  dosage?: string;
  form: MedicineForm;
  composition?: CompositionItem[];
  totalQuantity: number;
  remainingQuantity: number;
  startDate?: string;
  expirationDate: string;
  storageNotes?: string;
  notes?: string;
  photoUri?: string;
  description?: string;
  usageNotes?: string;
  warnings?: string[];
  incompatibleWith?: string[];
  tags?: string[];
  addedAt: string;
  updatedAt: string;
}

export type KitAccessRole = 'owner' | 'editor' | 'viewer' | 'synced';
export type KitSyncStatus = 'active' | 'pending' | 'disconnected' | 'failed';

export interface KitMember {
  userId: string;
  name: string;
  avatarInitials: string;
  role: KitAccessRole;
  lastActiveAt?: string;
  syncStatus: KitSyncStatus;
}

export interface KitActivityEvent {
  id: string;
  kitId: string;
  userId: string;
  userName: string;
  type:
    | 'medicine_added' | 'medicine_removed' | 'quantity_changed'
    | 'expiry_updated' | 'member_joined' | 'member_left' | 'share_created';
  medicineId?: string;
  medicineName?: string;
  detail?: string;
  createdAt: string;
}

export interface MedicineKit {
  id: string;
  name: string;
  description?: string;
  icon: string;
  colorTag: string;
  photoUri?: string;
  isPrivate: boolean;
  priority?: number;
  ownerId: string;
  members: KitMember[];
  createdAt: string;
  updatedAt: string;
}

export type NotificationType =
  | 'expired' | 'expiring_soon' | 'low_stock'
  | 'interaction_warning' | 'kit_update';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  medicineId?: string;
  kitId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  name: string;
  surname?: string;
  nickname?: string;
  email?: string;
  avatarInitials: string;
  ownedKitIds: string[];
  sharedKitIds: string[];
  createdAt: string;
}

export interface ReminderSettings {
  expiryDaysBefore: number[];
  lowStockThreshold: number;
  pushEnabled: boolean;
  lowStockEnabled: boolean;
  kitActivityEnabled: boolean;
  interactionWarningsEnabled: boolean;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  language: 'en' | 'ru' | 'tr' | 'ro';
  reminders: ReminderSettings;
  defaultSharingRole: KitAccessRole;
}

/** A scheduled medication reminder */
export interface MedicineReminder {
  id: string;
  kitId: string;
  medicineId: string;
  medicineName: string;   // denormalized for display
  kitName: string;        // denormalized for display
  pillCount: number;      // tablets/units per dose
  times: string[];        // ["08:00", "20:00"] HH:MM
  daysOfWeek: number[];   // 0=Sun…6=Sat; empty array = every day
  startDate: string;      // ISO date
  endDate?: string;       // ISO date, undefined = no end
  isActive: boolean;
  lastTakenAt?: string;   // ISO datetime of most recent taken mark
  notes?: string;
  createdAt: string;
}

// ─── Shopping list ────────────────────────────────────────────────────────────

export interface ShoppingItem {
  id: string;
  name: string;
  form?: MedicineForm;
  dosage?: string;
  quantity: number;
  notes?: string;
  prefill?: MedicinePrefill;
  createdAt: string;
}

// ─── Medicine journal ─────────────────────────────────────────────────────────

export interface IntakeMedicineEntry {
  medicineId?: string;
  medicineName: string;
  quantity: number;
  unit: string;       // шт / мл / кап
}

export interface MedicineIntakeLog {
  id: string;
  date: string;       // "YYYY-MM-DD"
  time: string;       // "HH:MM"
  entries: IntakeMedicineEntry[];
  symptoms: string[];
  notes?: string;
  createdAt: string;
}

// ─── Navigation ──────────────────────────────────────────────────────────────

export interface Person {
  id: string;
  name: string;
  surname?: string;
  nickname: string;
  avatarInitials: string;
  sharedKitIds: string[];
  createdAt: string;
}

export interface MedicinePrefill {
  name?: string;
  manufacturer?: string;
  activeIngredient?: string;
  dosage?: string;
  form?: MedicineForm;
  composition?: CompositionItem[];
  description?: string;
  usageNotes?: string;
  warnings?: string[];
  incompatibleWith?: string[];
  barcode?: string;
  tags?: string[];
}

export type RootStackParamList = {
  Main: undefined;
};

export type MainTabParamList = {
  KitsTab: undefined;
  ShoppingTab: undefined;
  JournalTab: undefined;
  NotificationsTab: undefined;
  ProfileTab: undefined;
};

export type ShoppingStackParamList = {
  ShoppingList: undefined;
};

export type JournalStackParamList = {
  JournalHome: undefined;
  AddIntakeLog: { date?: string; logId?: string };
};

export type NotificationsStackParamList = {
  NotificationsHome: undefined;
  CreateReminder: { reminderId?: string; kitId?: string; medicineId?: string };
};

export type KitsStackParamList = {
  KitList: undefined;
  AllMedicines: undefined;
  KitDetail: { kitId: string };
  MedicineDetail: { medicineId: string; kitId: string };
  ShareMedicine: { medicineId: string; kitId: string };
  AddMedicine: { kitId: string };
  ManualEntry: { kitId?: string; medicineId?: string; prefill?: MedicinePrefill };
  ScanMedicine: { kitId?: string };
  SearchMedicine: { kitId?: string };
  ShareKit: { kitId: string };
  MedicineInteraction: { medicineId: string };
  SyncMembers: { kitId: string };
  ActivityHistory: { kitId: string };
  CreateEditKit: { kitId?: string };
};

export type PersonsStackParamList = {
  PersonsList: undefined;
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  Settings: undefined;
  Support: undefined;
  Persons: undefined;
  Expiry: undefined;
  MedicineDetail: { medicineId: string; kitId: string };
};
