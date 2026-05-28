import type { MedicineKit, Medicine, AppNotification, UserProfile, KitActivityEvent } from '../types';

export const MOCK_USER: UserProfile = {
  id: 'user-1',
  name: 'Анна Петрова',
  email: 'anna.p@example.com',
  avatarInitials: 'АП',
  ownedKitIds: ['kit-1', 'kit-3'],
  sharedKitIds: ['kit-2'],
  createdAt: '2024-01-10T10:00:00Z',
};

export const MOCK_KITS: MedicineKit[] = [
  {
    id: 'kit-1', name: 'Дом', description: 'Основная домашняя аптечка',
    icon: '🏡', colorTag: '#A0CEFF', isPrivate: false, ownerId: 'user-1',
    members: [
      { userId: 'user-1', name: 'Анна Петрова', avatarInitials: 'АП', role: 'owner', syncStatus: 'active' },
      { userId: 'user-2', name: 'Мама Ирина', avatarInitials: 'МИ', role: 'editor', syncStatus: 'active' },
    ],
    createdAt: '2024-01-10T10:00:00Z', updatedAt: '2025-04-01T12:00:00Z',
  },
  {
    id: 'kit-2', name: 'Родители', description: 'Аптечка для родителей',
    icon: '👨‍👩‍👧', colorTag: '#FFB347', isPrivate: false, ownerId: 'user-2',
    members: [
      { userId: 'user-2', name: 'Мама Ирина', avatarInitials: 'МИ', role: 'owner', syncStatus: 'active' },
      { userId: 'user-1', name: 'Анна Петрова', avatarInitials: 'АП', role: 'synced', syncStatus: 'active' },
    ],
    createdAt: '2024-02-01T10:00:00Z', updatedAt: '2025-03-28T09:00:00Z',
  },
  {
    id: 'kit-3', name: 'Дача', description: 'Летняя аптечка',
    icon: '🌿', colorTag: '#56CE53', isPrivate: true, ownerId: 'user-1',
    members: [
      { userId: 'user-1', name: 'Анна Петрова', avatarInitials: 'АП', role: 'owner', syncStatus: 'active' },
    ],
    createdAt: '2024-05-01T10:00:00Z', updatedAt: '2025-01-15T10:00:00Z',
  },
];

export const MOCK_MEDICINES: Medicine[] = [
  {
    id: 'med-1', kitId: 'kit-1', name: 'Амброксол',
    activeIngredient: 'Амброксола гидрохлорид', dosage: '30 мг', form: 'tablets',
    totalQuantity: 20, remainingQuantity: 12, expirationDate: '2026-06-12',
    storageNotes: 'Хранить при температуре до 25°C',
    description: 'Помогает при кашле с мокротой — разжижает её и помогает откашлять.',
    usageNotes: 'При бронхите, простуде с мокрым кашлем.',
    warnings: ['Не принимать детям до 6 лет без консультации врача'],
    incompatibleWith: ['Противокашлевые (кодеин, декстрометорфан)'],
    addedAt: '2024-12-01T10:00:00Z', updatedAt: '2025-03-15T10:00:00Z',
  },
  {
    id: 'med-2', kitId: 'kit-1', name: 'Но-Шпа',
    activeIngredient: 'Дротаверина гидрохлорид', dosage: '40 мг', form: 'tablets',
    totalQuantity: 24, remainingQuantity: 15, expirationDate: '2027-08-01',
    description: 'Снимает спазмы. Помогает при болях в животе.',
    warnings: ['Не применять при тяжёлой сердечной недостаточности'],
    incompatibleWith: [],
    addedAt: '2024-11-10T10:00:00Z', updatedAt: '2025-02-20T10:00:00Z',
  },
  {
    id: 'med-3', kitId: 'kit-1', name: 'Парацетамол',
    activeIngredient: 'Парацетамол', dosage: '500 мг', form: 'tablets',
    totalQuantity: 20, remainingQuantity: 5, expirationDate: '2024-03-01',
    description: 'Жаропонижающее и болеутоляющее средство.',
    warnings: ['Не превышать суточную дозу 4 г'],
    incompatibleWith: ['Алкоголь'],
    addedAt: '2024-01-20T10:00:00Z', updatedAt: '2024-01-20T10:00:00Z',
  },
  {
    id: 'med-4', kitId: 'kit-1', name: 'Лоратадин',
    activeIngredient: 'Лоратадин', dosage: '10 мг', form: 'tablets',
    totalQuantity: 10, remainingQuantity: 3, expirationDate: '2025-07-07',
    description: 'Антигистаминный препарат от аллергии.',
    warnings: ['Осторожно при управлении автомобилем'],
    incompatibleWith: [],
    addedAt: '2024-08-01T10:00:00Z', updatedAt: '2024-08-01T10:00:00Z',
  },
  {
    id: 'med-5', kitId: 'kit-2', name: 'Ибупрофен',
    activeIngredient: 'Ибупрофен', dosage: '400 мг', form: 'tablets',
    totalQuantity: 20, remainingQuantity: 20, expirationDate: '2027-11-01',
    description: 'Противовоспалительное, жаропонижающее и обезболивающее.',
    warnings: ['Не принимать натощак'],
    incompatibleWith: [],
    addedAt: '2025-03-28T09:00:00Z', updatedAt: '2025-03-28T09:00:00Z',
  },
  {
    id: 'med-6', kitId: 'kit-3', name: 'Активированный уголь',
    activeIngredient: 'Уголь активированный', dosage: '250 мг', form: 'tablets',
    totalQuantity: 50, remainingQuantity: 48, expirationDate: '2028-01-01',
    description: 'Сорбент. Выводит токсины из организма.',
    warnings: [],
    incompatibleWith: [],
    addedAt: '2024-05-15T10:00:00Z', updatedAt: '2024-05-15T10:00:00Z',
  },
];

export const MOCK_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-1', type: 'expired', title: 'Парацетамол просрочен!',
    body: 'Аптечка «Дом» — срочно замените.',
    medicineId: 'med-3', kitId: 'kit-1', isRead: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'notif-2', type: 'expiring_soon', title: 'Амброксол скоро истекает',
    body: 'Срок годности — 12 июня 2026.',
    medicineId: 'med-1', kitId: 'kit-1', isRead: false,
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: 'notif-3', type: 'low_stock', title: 'Лоратадин — мало запаса',
    body: 'Осталось 3 таблетки.',
    medicineId: 'med-4', kitId: 'kit-1', isRead: false,
    createdAt: new Date(Date.now() - 24 * 3600000).toISOString(),
  },
  {
    id: 'notif-4', type: 'interaction_warning', title: 'Опасное сочетание!',
    body: 'Амброксол + Противокашлевые — опасно.',
    kitId: 'kit-1', isRead: false,
    createdAt: new Date(Date.now() - 2 * 24 * 3600000).toISOString(),
  },
  {
    id: 'notif-5', type: 'kit_update', title: 'Маша добавила Ибупрофен',
    body: 'Аптечка «Родители» обновлена.',
    kitId: 'kit-2', isRead: true,
    createdAt: new Date(Date.now() - 3 * 24 * 3600000).toISOString(),
  },
];

export const MOCK_ACTIVITY: KitActivityEvent[] = [
  {
    id: 'act-1', kitId: 'kit-1', userId: 'user-2', userName: 'Мама Ирина',
    type: 'medicine_added', medicineId: 'med-5', medicineName: 'Ибупрофен',
    createdAt: '2025-03-28T09:00:00Z',
  },
  {
    id: 'act-2', kitId: 'kit-1', userId: 'user-1', userName: 'Анна',
    type: 'quantity_changed', medicineId: 'med-1', medicineName: 'Амброксол',
    detail: '20 → 12', createdAt: '2025-03-15T10:00:00Z',
  },
  {
    id: 'act-3', kitId: 'kit-1', userId: 'user-2', userName: 'Мама Ирина',
    type: 'member_joined', createdAt: '2025-01-05T08:00:00Z',
  },
];
