import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';
import type { MedicineKit, Medicine, AppNotification, UserProfile, AppSettings, MedicineStatus, Person, MedicineReminder } from '../types';

const mmkv = new MMKV({ id: 'medikit-store' });

const mmkvStorage = {
  getItem: (name: string): string | null => mmkv.getString(name) ?? null,
  setItem: (name: string, value: string): void => { mmkv.set(name, value); },
  removeItem: (name: string): void => { mmkv.delete(name); },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getMedicineStatus(med: Medicine): MedicineStatus {
  try {
    const today = new Date();
    const expiry = new Date(med.expirationDate);
    const daysLeft = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return 'expired';
    if (daysLeft <= 30) return 'expiring_soon';
    if (med.remainingQuantity <= 3) return 'low_stock';
    return 'ok';
  } catch {
    return 'ok';
  }
}

export function getKitStats(medicines: Medicine[], kitId: string) {
  const meds = medicines.filter(m => m.kitId === kitId);
  return {
    total: meds.length,
    expiringSoon: meds.filter(m => getMedicineStatus(m) === 'expiring_soon').length,
    expired: meds.filter(m => getMedicineStatus(m) === 'expired').length,
    lowStock: meds.filter(m => getMedicineStatus(m) === 'low_stock').length,
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface AppStore {
  user: UserProfile;
  kits: MedicineKit[];
  medicines: Medicine[];
  notifications: AppNotification[];
  persons: Person[];
  reminders: MedicineReminder[];
  settings: AppSettings;

  updateUser: (changes: Partial<UserProfile>) => void;

  addKit: (kit: MedicineKit) => void;
  updateKit: (kitId: string, changes: Partial<MedicineKit>) => void;
  deleteKit: (kitId: string) => void;

  addMedicine: (medicine: Medicine) => void;
  updateMedicine: (medicineId: string, changes: Partial<Medicine>) => void;
  deleteMedicine: (medicineId: string) => void;
  decrementQuantity: (medicineId: string, amount?: number) => void;

  addPerson: (person: Person) => void;
  updatePerson: (personId: string, changes: Partial<Person>) => void;
  deletePerson: (personId: string) => void;

  markNotificationRead: (notifId: string) => void;
  markAllNotificationsRead: () => void;
  dismissNotification: (notifId: string) => void;

  addReminder: (r: MedicineReminder) => void;
  updateReminder: (id: string, changes: Partial<MedicineReminder>) => void;
  deleteReminder: (id: string) => void;
  markReminderTaken: (id: string) => void;

  updateSettings: (changes: Partial<AppSettings>) => void;

  getMedicinesForKit: (kitId: string) => Medicine[];
  getKitStats: (kitId: string) => ReturnType<typeof getKitStats>;
  getMedicine: (medicineId: string) => Medicine | undefined;
  getKit: (kitId: string) => MedicineKit | undefined;
  getReminder: (id: string) => MedicineReminder | undefined;
  unreadCount: () => number;
  allMedicinesSortedByExpiry: () => Medicine[];
}

const DEFAULT_USER: UserProfile = {
  id: `user-${Date.now()}`,
  name: 'Пользователь',
  avatarInitials: 'П',
  ownedKitIds: [],
  sharedKitIds: [],
  createdAt: new Date().toISOString(),
};

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      user: DEFAULT_USER,
      kits: [],
      medicines: [],
      notifications: [],
      persons: [],
      reminders: [],
      settings: {
        theme: 'system',
        language: 'ru',
        reminders: {
          expiryDaysBefore: [90, 30, 7],
          lowStockThreshold: 3,
          pushEnabled: true,
          lowStockEnabled: true,
          kitActivityEnabled: true,
          interactionWarningsEnabled: true,
        },
        defaultSharingRole: 'viewer',
      },

      updateUser: changes => set(s => ({ user: { ...s.user, ...changes } })),

      addKit: kit => set(s => ({ kits: [...s.kits, kit] })),
      updateKit: (kitId, changes) =>
        set(s => ({
          kits: s.kits.map(k =>
            k.id === kitId ? { ...k, ...changes, updatedAt: new Date().toISOString() } : k,
          ),
        })),
      deleteKit: kitId =>
        set(s => ({
          kits: s.kits.filter(k => k.id !== kitId),
          medicines: s.medicines.filter(m => m.kitId !== kitId),
        })),

      addMedicine: medicine => set(s => ({ medicines: [...s.medicines, medicine] })),
      updateMedicine: (medicineId, changes) =>
        set(s => ({
          medicines: s.medicines.map(m =>
            m.id === medicineId ? { ...m, ...changes, updatedAt: new Date().toISOString() } : m,
          ),
        })),
      deleteMedicine: medicineId =>
        set(s => ({ medicines: s.medicines.filter(m => m.id !== medicineId) })),
      decrementQuantity: (medicineId, amount = 1) =>
        set(s => ({
          medicines: s.medicines.map(m =>
            m.id === medicineId
              ? { ...m, remainingQuantity: Math.max(0, m.remainingQuantity - amount), updatedAt: new Date().toISOString() }
              : m,
          ),
        })),

      addPerson: person => set(s => ({ persons: [...s.persons, person] })),
      updatePerson: (personId, changes) =>
        set(s => ({
          persons: s.persons.map(p => p.id === personId ? { ...p, ...changes } : p),
        })),
      deletePerson: personId =>
        set(s => ({ persons: s.persons.filter(p => p.id !== personId) })),

      markNotificationRead: notifId =>
        set(s => ({
          notifications: s.notifications.map(n => n.id === notifId ? { ...n, isRead: true } : n),
        })),
      markAllNotificationsRead: () =>
        set(s => ({ notifications: s.notifications.map(n => ({ ...n, isRead: true })) })),
      dismissNotification: notifId =>
        set(s => ({ notifications: s.notifications.filter(n => n.id !== notifId) })),

      addReminder: r => set(s => ({ reminders: [...s.reminders, r] })),
      updateReminder: (id, changes) =>
        set(s => ({
          reminders: s.reminders.map(r => r.id === id ? { ...r, ...changes } : r),
        })),
      deleteReminder: id =>
        set(s => ({ reminders: s.reminders.filter(r => r.id !== id) })),
      markReminderTaken: id =>
        set(s => {
          const now = new Date().toISOString();
          const reminder = s.reminders.find(r => r.id === id);
          const updatedReminders = s.reminders.map(r =>
            r.id === id ? { ...r, lastTakenAt: now } : r,
          );
          // Auto-decrement medicine quantity
          const updatedMedicines = reminder
            ? s.medicines.map(m =>
                m.id === reminder.medicineId
                  ? { ...m, remainingQuantity: Math.max(0, m.remainingQuantity - reminder.pillCount), updatedAt: now }
                  : m,
              )
            : s.medicines;
          return { reminders: updatedReminders, medicines: updatedMedicines };
        }),

      updateSettings: changes => set(s => ({ settings: { ...s.settings, ...changes } })),

      getMedicinesForKit: kitId => get().medicines.filter(m => m.kitId === kitId),
      getKitStats: kitId => getKitStats(get().medicines, kitId),
      getMedicine: medicineId => get().medicines.find(m => m.id === medicineId),
      getKit: kitId => get().kits.find(k => k.id === kitId),
      getReminder: id => get().reminders.find(r => r.id === id),
      unreadCount: () => get().notifications.filter(n => !n.isRead).length,
      allMedicinesSortedByExpiry: () =>
        [...get().medicines].sort(
          (a, b) => new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime(),
        ),
    }),
    {
      name: 'medikit-data',
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);
