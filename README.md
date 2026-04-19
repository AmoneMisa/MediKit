# 💊 MediKit — React Native App

A mobile app for tracking medicine kits, expiration dates, stock levels, and sharing with family.

---

## 📁 Project Structure

```
MediKit/
├── App.tsx                          # Root entry point
├── package.json
├── tsconfig.json
├── babel.config.js
└── src/
    ├── types/
    │   └── index.ts                 # All TypeScript interfaces & navigation types
    ├── theme/
    │   └── index.ts                 # Colors, Typography, Spacing, Radius, Shadow tokens
    ├── assets/
    │   └── data/
    │       └── mockData.ts          # Mock kits, medicines, notifications, user
    ├── store/
    │   └── index.ts                 # Zustand global store (kits, medicines, notifications)
    ├── hooks/
    │   └── index.ts                 # useMedicineStatus, useExpiryLabel, useKitMedicines, etc.
    ├── components/
    │   └── index.tsx                # Shared UI: StatusBadge, MedicineIcon, KitThumb, Card, etc.
    ├── navigation/
    │   └── AppNavigator.tsx         # Root stack + bottom tabs + kit stack + profile stack
    └── screens/
        ├── KitListScreen.tsx        # Home — all medicine kits
        ├── KitDetailScreen.tsx      # Medicine list inside a kit (filters, search, FAB)
        ├── MedicineDetailScreen.tsx # Full medicine info, warnings, actions
        ├── AddMedicineScreen.tsx    # Add medicine (scan / search / manual)
        ├── NotificationsScreen.tsx  # All alerts with mark-read and dismiss
        ├── ExpiryScreen.tsx         # All medicines sorted by expiry with progress bars
        └── index.tsx                # ShareKitScreen, ProfileScreen, SettingsScreen + stubs
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- React Native CLI (not Expo)
- Xcode 15+ (for iOS)
- Android Studio + Android SDK 34 (for Android)
- CocoaPods (for iOS)

### 1. Clone & Install

```bash
git clone <your-repo>
cd MediKit
npm install
```

### 2. iOS Setup

```bash
cd ios && pod install && cd ..
npx react-native run-ios
```

### 3. Android Setup

```bash
npx react-native run-android
```

### 4. Start Metro

```bash
npm start
```

---

## 🎨 Design System

All design tokens are in `src/theme/index.ts`. The palette matches the original design spec:

| Token | Value | Usage |
|---|---|---|
| `bgPage` | `#F7F8FD` | Screen backgrounds |
| `bgCard` | `#FFFFFF` | Card surfaces |
| `blue` | `#78A9FF` | Primary actions, active states |
| `accent` | `#FF775C` | Accent buttons, low-stock badge |
| `success` | `#56CE53` | OK status |
| `warning` | `#FFCF47` | Expiring soon |
| `danger` | `#FF7575` | Expired, critical alerts |

---

## 🗺️ Navigation Architecture

```
RootStack
├── Onboarding (first launch only)
└── Main (Bottom Tabs)
    ├── KitsTab → KitsStack
    │   ├── KitList
    │   ├── KitDetail          ← medicine list with filters + search
    │   ├── MedicineDetail     ← full info + actions
    │   ├── AddMedicine        ← scan / search / manual
    │   ├── ScanMedicine
    │   ├── ManualEntry
    │   ├── ShareKit           ← QR + Telegram + WhatsApp + access control
    │   ├── ShareMedicine
    │   ├── MedicineInteraction
    │   ├── SyncMembers
    │   ├── ActivityHistory
    │   └── CreateEditKit
    ├── NotificationsTab       ← all alerts with badge count
    ├── AddTab                 ← quick access to add flow
    ├── ExpiryTab              ← all medicines sorted by expiry date
    └── ProfileTab → ProfileStack
        ├── ProfileHome
        ├── Settings           ← notifications, reminders, theme
        ├── ReminderSettings
        ├── Support
        └── LinkedAccounts
```

---

## 🧱 State Management (Zustand)

The store in `src/store/index.ts` manages:

- **Kits** — add, update, delete
- **Medicines** — add, update, delete, decrement quantity
- **Notifications** — mark read, dismiss, mark all read
- **Settings** — theme, reminders, sharing defaults

Replace mock data with real API calls by swapping the initial state and adding async actions.

---

## 📦 Key Dependencies

| Package | Purpose |
|---|---|
| `@react-navigation/native` | Navigation container |
| `@react-navigation/bottom-tabs` | Tab bar |
| `@react-navigation/native-stack` | Stack navigation |
| `zustand` | Global state management |
| `react-native-reanimated` | Smooth animations |
| `react-native-gesture-handler` | Swipe & gesture support |
| `react-native-linear-gradient` | Gradient backgrounds on cards |
| `react-native-camera` | Camera for scanning |
| `react-native-share` | Native share sheet |
| `react-native-qrcode-svg` | QR code generation |
| `react-native-date-picker` | Expiry date picker |
| `react-native-mmkv` | Fast local storage |
| `date-fns` | Date formatting & diff |
| `react-native-notifications` | Push notifications |

---

## 🔜 What to Build Next

### Priority 1 — Core flows
- [ ] `ManualEntryScreen` — form with all medicine fields + date picker
- [ ] `ScanMedicineScreen` — camera + barcode detection + OCR for expiry date
- [ ] `CreateEditKitScreen` — icon picker, color tag, name, description
- [ ] `MedicineInteraction` — detailed incompatibility screen

### Priority 2 — Sharing & Sync
- [ ] `SyncMembersScreen` — invite, revoke, role management
- [ ] `ActivityHistoryScreen` — timeline of changes
- [ ] Real QR code generation with `react-native-qrcode-svg`
- [ ] Deep link handling for kit invitations

### Priority 3 — Infrastructure
- [ ] Replace mock data with REST API / Firebase / Supabase
- [ ] Push notification scheduling (`react-native-notifications`)
- [ ] Onboarding flow with auth (Apple / Google / email)
- [ ] Dark mode support (theme context + conditional Colors)
- [ ] Offline-first sync with MMKV + conflict resolution

### Priority 4 — Polish
- [ ] Animated transitions with `react-native-reanimated`
- [ ] Haptic feedback on key actions
- [ ] Empty state illustrations
- [ ] App icon + splash screen
- [ ] Accessibility (a11y) labels

---

## 🌍 Localisation

Currently Russian (`ru`). To add more languages, use `react-i18next` and extract all strings from screens into locale files.

---

## 📱 Screens Checklist (from spec)

| # | Screen | Status |
|---|---|---|
| 1 | Onboarding | 🔲 Stub |
| 2 | Home / My Medicine Kits | ✅ Done |
| 3 | Create / Edit Kit | 🔲 Stub |
| 4 | Medicine List Inside a Kit | ✅ Done |
| 5 | Add Medicine | ✅ Done |
| 6 | Scan Medicine | 🔲 Stub |
| 7 | Manual Medicine Entry | 🔲 Stub |
| 8 | Medicine Details | ✅ Done |
| 9 | Medicine Interaction / Warning | 🔲 Stub |
| 10 | Share Medicine | 🔲 Stub |
| 11 | Share Medicine Kit | ✅ Done |
| 12 | Notifications | ✅ Done |
| 13 | Expiration Management | ✅ Done |
| 14 | Synced Members | 🔲 Stub |
| 15 | Linked Accounts / Sync | 🔲 Stub |
| 16 | Activity History | 🔲 Stub |
| 17 | Search | 🔲 Stub |
| 18 | Profile | ✅ Done |
| 19 | Settings | ✅ Done |
| 20 | Reminder Settings | 🔲 Stub |
| 21 | Support / Help | 🔲 Stub |
| 22 | Empty States | ✅ Done (inline) |
| 23 | Permission Request Flows | 🔲 Pending |
| 24 | Quick Actions / Bottom Sheet | 🔲 Pending |
