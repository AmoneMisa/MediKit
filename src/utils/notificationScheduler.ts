import notifee, {
  AndroidImportance,
  AndroidVisibility,
  TriggerType,
  RepeatFrequency,
  type TimestampTrigger,
  AuthorizationStatus,
} from '@notifee/react-native';
import { Platform } from 'react-native';
import { LazyMMKV } from './createSecureMMKV';
import type { Medicine, MedicineReminder, DoctorAppointment } from '../types';
import { useAppStore } from '../store';

const schedulerMmkv = new LazyMMKV('medikit-scheduler');
const HASH_KEY = 'schedule_hash';

// ─── Channel IDs ──────────────────────────────────────────────────────────────

const CHANNEL_EXPIRY       = 'medikit_expiry';
const CHANNEL_REMINDERS    = 'medikit_reminders';
const CHANNEL_APPOINTMENTS = 'medikit_appointments';

// ─── Setup ────────────────────────────────────────────────────────────────────

export async function setupChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await notifee.createChannel({
    id: CHANNEL_EXPIRY,
    name: 'Medicine Expiry',
    description: 'Alerts when medicines are about to expire',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
  });
  await notifee.createChannel({
    id: CHANNEL_REMINDERS,
    name: 'Medicine Reminders',
    description: 'Reminders to take medicines on schedule',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
  });
  await notifee.createChannel({
    id: CHANNEL_APPOINTMENTS,
    name: 'Doctor Appointments',
    description: 'Reminders for upcoming doctor appointments',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  const settings = await notifee.requestPermission();
  return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseTime(hhmm: string): { hours: number; minutes: number } {
  const [h, m] = hhmm.split(':').map(Number);
  return { hours: h ?? 9, minutes: m ?? 0 };
}

/** Returns the next Date at HH:MM — always in the future. */
function nextOccurrenceAtTime(hours: number, minutes: number): Date {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d;
}

/** Returns the next Date on weekday `dow` (0=Sun) at HH:MM — always in the future. */
function nextOccurrenceOnDow(dow: number, hours: number, minutes: number): Date {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  const daysUntil = (dow - d.getDay() + 7) % 7;
  // If today is that weekday but the time has already passed, push to next week
  if (daysUntil === 0 && d.getTime() <= Date.now()) {
    d.setDate(d.getDate() + 7);
  } else {
    d.setDate(d.getDate() + daysUntil);
  }
  return d;
}

// ─── Expiry notifications ─────────────────────────────────────────────────────

/**
 * Schedule one notification per `daysBefore` threshold for this medicine.
 * Fires at 09:00 on (expiryDate - N days). Skips dates already in the past.
 */
export async function scheduleMedicineExpiry(
  medicine: Medicine,
  daysBefore: number[],
): Promise<void> {
  await Promise.all(
    daysBefore.map(async days => {
      const id = `exp-${medicine.id}-${days}`;
      const fire = new Date(medicine.expirationDate);
      fire.setDate(fire.getDate() - days);
      fire.setHours(9, 0, 0, 0);
      if (fire.getTime() <= Date.now()) return; // already past

      const trigger: TimestampTrigger = {
        type: TriggerType.TIMESTAMP,
        timestamp: fire.getTime(),
      };

      const body =
        days === 0
          ? `${medicine.name} expires today!`
          : `${medicine.name} expires in ${days} day${days === 1 ? '' : 's'}`;

      await notifee.createTriggerNotification(
        {
          id,
          title: 'Medicine Expiry Alert',
          body,
          android: { channelId: CHANNEL_EXPIRY },
          ios: { categoryId: 'expiry' },
        },
        trigger,
      );
    }),
  );
}

/**
 * Cancel all expiry notifications for a medicine.
 * Pass `daysBefore` to limit cancellation; omit to cancel every possible ID.
 */
export async function cancelMedicineExpiry(
  medicineId: string,
  daysBefore?: number[],
): Promise<void> {
  const days = daysBefore ?? [365, 180, 90, 60, 30, 14, 7, 3, 1, 0];
  await Promise.all(days.map(d => notifee.cancelNotification(`exp-${medicineId}-${d}`)));
}

// ─── Reminder notifications ───────────────────────────────────────────────────

/**
 * Schedule repeating trigger notifications for a reminder.
 * - daysOfWeek empty → DAILY repeat per time slot
 * - daysOfWeek set   → WEEKLY repeat per (day × time) pair
 */
export async function scheduleReminder(reminder: MedicineReminder): Promise<void> {
  if (!reminder.isActive) return;
  if (reminder.endDate && new Date(reminder.endDate) < new Date()) return;

  const body = `${reminder.medicineName} — ${reminder.pillCount} unit${reminder.pillCount !== 1 ? 's' : ''}`;

  await Promise.all(
    reminder.times.flatMap((timeStr, ti) => {
      const { hours, minutes } = parseTime(timeStr);

      if (reminder.daysOfWeek.length === 0) {
        // Every day at this time
        const trigger: TimestampTrigger = {
          type: TriggerType.TIMESTAMP,
          timestamp: nextOccurrenceAtTime(hours, minutes).getTime(),
          repeatFrequency: RepeatFrequency.DAILY,
        };
        return [
          notifee.createTriggerNotification(
            {
              id: `rem-${reminder.id}-${ti}`,
              title: 'Time to take medicine',
              body,
              android: { channelId: CHANNEL_REMINDERS },
              ios: { categoryId: 'reminder' },
            },
            trigger,
          ),
        ];
      }

      // Specific days of week
      return reminder.daysOfWeek.map(dow => {
        const trigger: TimestampTrigger = {
          type: TriggerType.TIMESTAMP,
          timestamp: nextOccurrenceOnDow(dow, hours, minutes).getTime(),
          repeatFrequency: RepeatFrequency.WEEKLY,
        };
        return notifee.createTriggerNotification(
          {
            id: `rem-${reminder.id}-${ti}-${dow}`,
            title: 'Time to take medicine',
            body,
            android: { channelId: CHANNEL_REMINDERS },
            ios: { categoryId: 'reminder' },
          },
          trigger,
        );
      });
    }),
  );
}

/** Cancel all notifications belonging to a reminder (any time slot, any day). */
export async function cancelReminder(reminderId: string): Promise<void> {
  const ids: string[] = [];
  for (let ti = 0; ti < 8; ti++) {
    ids.push(`rem-${reminderId}-${ti}`);
    for (let dow = 0; dow < 7; dow++) {
      ids.push(`rem-${reminderId}-${ti}-${dow}`);
    }
  }
  await Promise.all(ids.map(id => notifee.cancelNotification(id)));
}

// ─── Appointment notifications ────────────────────────────────────────────────

/** Minutes before the appointment at which to fire each alert. */
const APPOINTMENT_ALERTS_MINUTES = [1440, 180, 60, 5] as const;

/**
 * Schedule up to 4 alerts before an appointment (24h, 3h, 1h, 5min).
 * Silently skips any trigger already in the past.
 */
export async function scheduleAppointmentNotifications(
  appt: DoctorAppointment,
  doctorName: string,
): Promise<void> {
  if (appt.status !== 'upcoming') return;
  const apptMs = new Date(appt.dateTime).getTime();

  await Promise.all(
    APPOINTMENT_ALERTS_MINUTES.map(async mins => {
      const fireMs = apptMs - mins * 60 * 1000;
      if (fireMs <= Date.now()) return;

      const label =
        mins >= 1440 ? '24 hours' :
        mins >= 180  ? '3 hours'  :
        mins >= 60   ? '1 hour'   : '5 minutes';

      const apptTime = new Date(appt.dateTime).toLocaleTimeString(undefined, {
        hour: '2-digit', minute: '2-digit',
      });

      const trigger: TimestampTrigger = {
        type: TriggerType.TIMESTAMP,
        timestamp: fireMs,
      };

      await notifee.createTriggerNotification(
        {
          id: `appt-${appt.id}-${mins}`,
          title: 'Doctor Appointment',
          body: `${doctorName} at ${apptTime} — in ${label}`,
          android: { channelId: CHANNEL_APPOINTMENTS },
          ios: { categoryId: 'appointment' },
        },
        trigger,
      );
    }),
  );
}

/** Cancel all appointment alerts for a given appointment. */
export async function cancelAppointmentNotifications(appointmentId: string): Promise<void> {
  await Promise.all(
    APPOINTMENT_ALERTS_MINUTES.map(mins =>
      notifee.cancelNotification(`appt-${appointmentId}-${mins}`),
    ),
  );
}

// ─── Schedule hash ────────────────────────────────────────────────────────────

function buildScheduleHash(
  medicines: Medicine[],
  reminders: MedicineReminder[],
  appointments: DoctorAppointment[],
): string {
  const parts = [
    ...medicines.map(m => `m:${m.id}:${m.expirationDate}`).sort(),
    ...reminders.filter(r => r.isActive).map(r => `r:${r.id}:${r.times.join(',')}:${r.daysOfWeek.join(',')}`).sort(),
    ...appointments.filter(a => a.status === 'upcoming').map(a => `a:${a.id}:${a.dateTime}`).sort(),
  ];
  return parts.join('|');
}

// ─── Full resync on launch ────────────────────────────────────────────────────

/**
 * Cancel every scheduled notification and rebuild from the current store.
 * Skips the rebuild if the schedule fingerprint hasn't changed since last run.
 * Safe to call on every app launch — idempotent, best-effort.
 */
export async function rescheduleAll(): Promise<void> {
  try {
    const { medicines, reminders, appointments, doctors, settings } = useAppStore.getState();
    if (!settings.reminders.pushEnabled) return;

    const hash = buildScheduleHash(medicines, reminders, appointments);
    if (schedulerMmkv.getString(HASH_KEY) === hash) return; // nothing changed

    await notifee.cancelAllNotifications();

    const { expiryDaysBefore } = settings.reminders;
    const doctorMap = new Map(doctors.map(d => [d.id, d.name]));

    await Promise.all([
      ...medicines.map(med => scheduleMedicineExpiry(med, expiryDaysBefore)),
      ...reminders.filter(r => r.isActive).map(r => scheduleReminder(r)),
      ...appointments
        .filter(a => a.status === 'upcoming')
        .map(a => scheduleAppointmentNotifications(a, doctorMap.get(a.doctorId) ?? 'Doctor')),
    ]);

    schedulerMmkv.set(HASH_KEY, hash);
  } catch {
    /* best-effort — never block the UI */
  }
}

/** Invalidate the schedule hash so the next rescheduleAll runs a full rebuild. */
export function invalidateScheduleHash(): void {
  schedulerMmkv.delete(HASH_KEY);
}
