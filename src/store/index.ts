import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { LazyMMKV } from '../utils/createSecureMMKV';
import type { MedicineKit, Medicine, AppNotification, UserProfile, AppSettings, MedicineStatus, Person, MedicineReminder, ShoppingItem, MedicineIntakeLog, Doctor, DoctorAppointment } from '../types';
import {
  pushKitCreate, pushKitUpdate, pushKitDelete,
  pushMedicineUpsert, pushMedicineDelete,
  pushNotificationRead, pushAllNotificationsRead, pushNotificationDismiss,
  pushDoctorUpsert, pushDoctorPatch, pushDoctorDelete,
  pushAppointmentUpsert, pushAppointmentPatch, pushAppointmentDelete,
} from '../api/outbox';

// LazyMMKV defers opening the file until first access, giving bootstrapSecurity()
// time to set the encryption key before any data is read or written.
const mmkv = new LazyMMKV('medikit-store');

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
  shoppingItems: ShoppingItem[];
  intakeLogs: MedicineIntakeLog[];
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

  addShoppingItem: (item: ShoppingItem) => void;
  updateShoppingItem: (id: string, changes: Partial<ShoppingItem>) => void;
  deleteShoppingItem: (id: string) => void;

  addIntakeLog: (log: MedicineIntakeLog) => void;
  updateIntakeLog: (id: string, changes: Partial<MedicineIntakeLog>) => void;
  deleteIntakeLog: (id: string) => void;
  getIntakeLogsForDate: (date: string) => MedicineIntakeLog[];

  doctors: Doctor[];
  addDoctor: (doctor: Doctor) => void;
  updateDoctor: (id: string, changes: Partial<Doctor>) => void;
  deleteDoctor: (id: string) => void;

  appointments: DoctorAppointment[];
  addAppointment: (a: DoctorAppointment) => void;
  updateAppointment: (id: string, changes: Partial<DoctorAppointment>) => void;
  deleteAppointment: (id: string) => void;

  updateSettings: (changes: Partial<AppSettings>) => void;

  getMedicinesForKit: (kitId: string) => Medicine[];
  getKitStats: (kitId: string) => ReturnType<typeof getKitStats>;
  getMedicine: (medicineId: string) => Medicine | undefined;
  getKit: (kitId: string) => MedicineKit | undefined;
  getReminder: (id: string) => MedicineReminder | undefined;
  unreadCount: () => number;
  allMedicinesSortedByExpiry: () => Medicine[];

  // ── Sync application (server-authoritative; never re-push) ──────────────────
  hydrate: (data: {
    user?: Partial<UserProfile>;
    kits?: MedicineKit[];
    medicines?: Medicine[];
    notifications?: AppNotification[];
    persons?: Person[];
    doctors?: Doctor[];
    appointments?: DoctorAppointment[];
  }) => void;
  mergeKit: (kit: MedicineKit) => void;
  removeKitLocal: (kitId: string) => void;
  mergeMedicine: (medicine: Medicine) => void;
  removeMedicineLocal: (medicineId: string) => void;
  addNotificationLocal: (notification: AppNotification) => void;
  mergeAppointment: (appointment: DoctorAppointment) => void;
  removeAppointmentLocal: (appointmentId: string) => void;
  mergeDoctor: (doctor: Doctor) => void;
  removeDoctorLocal: (doctorId: string) => void;
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
      shoppingItems: [],
      intakeLogs: [],
      doctors: [],
      appointments: [],
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

      addKit: kit => { set(s => ({ kits: [...s.kits, kit] })); pushKitCreate(kit); },
      updateKit: (kitId, changes) => {
        set(s => ({
          kits: s.kits.map(k =>
            k.id === kitId ? { ...k, ...changes, updatedAt: new Date().toISOString() } : k,
          ),
        }));
        pushKitUpdate(kitId, changes);
      },
      deleteKit: kitId => {
        set(s => ({
          kits: s.kits.filter(k => k.id !== kitId),
          medicines: s.medicines.filter(m => m.kitId !== kitId),
        }));
        pushKitDelete(kitId);
      },

      addMedicine: medicine => {
        set(s => ({ medicines: [...s.medicines, medicine] }));
        pushMedicineUpsert(medicine.kitId, medicine);
      },
      updateMedicine: (medicineId, changes) => {
        let updated: Medicine | undefined;
        set(s => ({
          medicines: s.medicines.map(m => {
            if (m.id !== medicineId) return m;
            updated = { ...m, ...changes, updatedAt: new Date().toISOString() };
            return updated;
          }),
        }));
        if (updated) pushMedicineUpsert(updated.kitId, updated);
      },
      deleteMedicine: medicineId => {
        const med = get().medicines.find(m => m.id === medicineId);
        set(s => ({ medicines: s.medicines.filter(m => m.id !== medicineId) }));
        if (med) pushMedicineDelete(med.kitId, medicineId);
      },
      decrementQuantity: (medicineId, amount = 1) => {
        let updated: Medicine | undefined;
        set(s => ({
          medicines: s.medicines.map(m => {
            if (m.id !== medicineId) return m;
            updated = { ...m, remainingQuantity: Math.max(0, m.remainingQuantity - amount), updatedAt: new Date().toISOString() };
            return updated;
          }),
        }));
        if (updated) pushMedicineUpsert(updated.kitId, updated);
      },

      addPerson: person => set(s => ({ persons: [...s.persons, person] })),
      updatePerson: (personId, changes) =>
        set(s => ({
          persons: s.persons.map(p => p.id === personId ? { ...p, ...changes } : p),
        })),
      deletePerson: personId =>
        set(s => ({ persons: s.persons.filter(p => p.id !== personId) })),

      markNotificationRead: notifId => {
        set(s => ({
          notifications: s.notifications.map(n => n.id === notifId ? { ...n, isRead: true } : n),
        }));
        pushNotificationRead(notifId);
      },
      markAllNotificationsRead: () => {
        set(s => ({ notifications: s.notifications.map(n => ({ ...n, isRead: true })) }));
        pushAllNotificationsRead();
      },
      dismissNotification: notifId => {
        set(s => ({ notifications: s.notifications.filter(n => n.id !== notifId) }));
        pushNotificationDismiss(notifId);
      },

      addReminder: r => set(s => ({ reminders: [...s.reminders, r] })),
      updateReminder: (id, changes) =>
        set(s => ({
          reminders: s.reminders.map(r => r.id === id ? { ...r, ...changes } : r),
        })),
      deleteReminder: id =>
        set(s => ({ reminders: s.reminders.filter(r => r.id !== id) })),
      markReminderTaken: id => {
        let updatedMed: Medicine | undefined;
        set(s => {
          const now = new Date().toISOString();
          const reminder = s.reminders.find(r => r.id === id);
          const updatedReminders = s.reminders.map(r =>
            r.id === id ? { ...r, lastTakenAt: now } : r,
          );
          // Auto-decrement medicine quantity
          const updatedMedicines = reminder
            ? s.medicines.map(m => {
                if (m.id !== reminder.medicineId) return m;
                updatedMed = { ...m, remainingQuantity: Math.max(0, m.remainingQuantity - reminder.pillCount), updatedAt: now };
                return updatedMed;
              })
            : s.medicines;
          return { reminders: updatedReminders, medicines: updatedMedicines };
        });
        if (updatedMed) pushMedicineUpsert(updatedMed.kitId, updatedMed);
      },

      addShoppingItem: item => set(s => ({ shoppingItems: [...s.shoppingItems, item] })),
      updateShoppingItem: (id, changes) =>
        set(s => ({ shoppingItems: s.shoppingItems.map(i => i.id === id ? { ...i, ...changes } : i) })),
      deleteShoppingItem: id =>
        set(s => ({ shoppingItems: s.shoppingItems.filter(i => i.id !== id) })),

      addIntakeLog: log => set(s => ({ intakeLogs: [...s.intakeLogs, log] })),
      updateIntakeLog: (id, changes) =>
        set(s => ({ intakeLogs: s.intakeLogs.map(l => l.id === id ? { ...l, ...changes } : l) })),
      deleteIntakeLog: id =>
        set(s => ({ intakeLogs: s.intakeLogs.filter(l => l.id !== id) })),
      getIntakeLogsForDate: date => get().intakeLogs.filter(l => l.date === date),

      addDoctor: doctor => {
        set(s => ({ doctors: [...s.doctors, doctor] }));
        pushDoctorUpsert(doctor);
      },
      updateDoctor: (id, changes) => {
        let updated: Doctor | undefined;
        set(s => ({
          doctors: s.doctors.map(d => {
            if (d.id !== id) return d;
            updated = { ...d, ...changes, updatedAt: new Date().toISOString() };
            return updated;
          }),
        }));
        if (updated) pushDoctorPatch(id, changes);
      },
      deleteDoctor: id => {
        set(s => ({ doctors: s.doctors.filter(d => d.id !== id) }));
        pushDoctorDelete(id);
      },

      addAppointment: a => {
        set(s => ({ appointments: [...s.appointments, a] }));
        pushAppointmentUpsert(a);
      },
      updateAppointment: (id, changes) => {
        let updated: DoctorAppointment | undefined;
        set(s => ({
          appointments: s.appointments.map(a => {
            if (a.id !== id) return a;
            updated = { ...a, ...changes, updatedAt: new Date().toISOString() };
            return updated;
          }),
        }));
        if (updated) pushAppointmentPatch(id, changes);
      },
      deleteAppointment: id => {
        set(s => ({ appointments: s.appointments.filter(a => a.id !== id) }));
        pushAppointmentDelete(id);
      },

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

      // ── Sync application ────────────────────────────────────────────────────
      // These apply server-authoritative data. They deliberately do NOT trigger
      // outbox pushes, so bootstrap pulls and realtime events can't echo back.
      hydrate: data =>
        set(s => ({
          user: data.user ? { ...s.user, ...data.user } : s.user,
          kits: data.kits ?? s.kits,
          medicines: data.medicines ?? s.medicines,
          notifications: data.notifications ?? s.notifications,
          persons: data.persons ?? s.persons,
          doctors: data.doctors ?? s.doctors,
          appointments: data.appointments ?? s.appointments,
        })),
      mergeKit: kit =>
        set(s => ({
          kits: s.kits.some(k => k.id === kit.id)
            ? s.kits.map(k => {
                if (k.id !== kit.id) return k;
                // Server-wins only when incoming is newer or same age
                return new Date(kit.updatedAt) >= new Date(k.updatedAt) ? kit : k;
              })
            : [...s.kits, kit],
        })),
      removeKitLocal: kitId =>
        set(s => ({
          kits: s.kits.filter(k => k.id !== kitId),
          medicines: s.medicines.filter(m => m.kitId !== kitId),
        })),
      mergeMedicine: medicine =>
        set(s => ({
          medicines: s.medicines.some(m => m.id === medicine.id)
            ? s.medicines.map(m => {
                if (m.id !== medicine.id) return m;
                return new Date(medicine.updatedAt) >= new Date(m.updatedAt) ? medicine : m;
              })
            : [...s.medicines, medicine],
        })),
      removeMedicineLocal: medicineId =>
        set(s => ({ medicines: s.medicines.filter(m => m.id !== medicineId) })),
      addNotificationLocal: notification =>
        set(s => (
          s.notifications.some(n => n.id === notification.id)
            ? {}
            : { notifications: [notification, ...s.notifications] }
        )),
      mergeAppointment: appointment =>
        set(s => ({
          appointments: s.appointments.some(a => a.id === appointment.id)
            ? s.appointments.map(a => {
                if (a.id !== appointment.id) return a;
                if (new Date(appointment.updatedAt) < new Date(a.updatedAt)) return a;
                // Preserve device-local calendarEventId — it's not synced to server
                return { ...appointment, calendarEventId: a.calendarEventId };
              })
            : [...s.appointments, appointment],
        })),
      removeAppointmentLocal: appointmentId =>
        set(s => ({ appointments: s.appointments.filter(a => a.id !== appointmentId) })),
      mergeDoctor: doctor =>
        set(s => ({
          doctors: s.doctors.some(d => d.id === doctor.id)
            ? s.doctors.map(d => {
                if (d.id !== doctor.id) return d;
                return new Date(doctor.updatedAt) >= new Date(d.updatedAt) ? doctor : d;
              })
            : [...s.doctors, doctor],
        })),
      removeDoctorLocal: doctorId =>
        set(s => ({ doctors: s.doctors.filter(d => d.id !== doctorId) })),
    }),
    {
      name: 'medikit-data',
      storage: createJSONStorage(() => mmkvStorage),
      // Do NOT auto-hydrate on create — App.tsx calls rehydrate() explicitly
      // after bootstrapSecurity() has set the encryption key.
      skipHydration: true,
    },
  ),
);
