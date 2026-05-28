import { useMemo } from 'react';
import type { Medicine, MedicineStatus } from '../types';
import { useAppStore, getMedicineStatus } from '../store';

export function useMedicineStatus(medicine: Medicine): MedicineStatus {
  return useMemo(() => getMedicineStatus(medicine), [medicine]);
}

export function useExpiryLabel(expirationDate: string): {
  label: string;
  daysLeft: number;
  isExpired: boolean;
} {
  return useMemo(() => {
    try {
      const expiry = new Date(expirationDate);
      const today = new Date();
      const daysLeft = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const d = expiry.getDate().toString().padStart(2, '0');
      const m = (expiry.getMonth() + 1).toString().padStart(2, '0');
      const y = expiry.getFullYear();
      const formatted = `${d}.${m}.${y}`;

      if (daysLeft < 0) return { label: 'Просрочен', daysLeft, isExpired: true };
      if (daysLeft === 0) return { label: 'Истекает сегодня!', daysLeft, isExpired: false };
      if (daysLeft <= 7) return { label: `Ещё ${daysLeft} дн.`, daysLeft, isExpired: false };
      return { label: `до ${formatted}`, daysLeft, isExpired: false };
    } catch {
      return { label: '—', daysLeft: 0, isExpired: false };
    }
  }, [expirationDate]);
}

export type MedicineFilter = 'all' | 'expiring_soon' | 'expired' | 'low_stock' | 'recent';

export function useKitMedicines(
  kitId: string,
  filter: MedicineFilter,
  query: string,
  tagFilter?: string,
) {
  const medicines = useAppStore(s => s.medicines);
  return useMemo(() => {
    let list = medicines.filter(m => m.kitId === kitId);
    if (filter !== 'all') {
      if (filter === 'recent') {
        const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
        list = list.filter(m => new Date(m.addedAt).getTime() > cutoff);
      } else {
        list = list.filter(m => getMedicineStatus(m) === filter);
      }
    }
    if (tagFilter) {
      list = list.filter(m => m.tags?.includes(tagFilter));
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        m => m.name.toLowerCase().includes(q) ||
          (m.activeIngredient ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [medicines, kitId, filter, query, tagFilter]);
}

export function useAllMedicinesSortedByExpiry() {
  const medicines = useAppStore(s => s.medicines);
  return useMemo(
    () => [...medicines].sort(
      (a, b) => new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime(),
    ),
    [medicines],
  );
}

export function useUnreadCount(): number {
  const notifications = useAppStore(s => s.notifications);
  return useMemo(() => notifications.filter(n => !n.isRead).length, [notifications]);
}

export function useTimeAgo(dateString: string): string {
  return useMemo(() => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      if (diffMins < 1) return 'только что';
      if (diffMins < 60) return `${diffMins} мин. назад`;
      if (diffHours < 24) return `${diffHours} ч. назад`;
      if (diffDays < 7) return `${diffDays} дн. назад`;
      const d = date.getDate().toString().padStart(2, '0');
      const m = (date.getMonth() + 1).toString().padStart(2, '0');
      return `${d}.${m}.${date.getFullYear()}`;
    } catch {
      return '—';
    }
  }, [dateString]);
}
