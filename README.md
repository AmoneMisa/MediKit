# MediKit — React Native App

A mobile app for tracking medicine kits, expiration dates, stock levels, doctor appointments, and sharing with family. Offline-first with a Node/Express/PostgreSQL backend.

---

## Project Structure

```
MediKit/
├── App.tsx                          # Root entry point — security bootstrap + sync init
├── package.json
├── tsconfig.json
├── android/                         # Android project (network_security_config, permissions)
├── ios/                             # iOS project
└── src/
    ├── types/
    │   └── index.ts                 # All TypeScript interfaces & navigation types
    ├── theme/
    │   └── index.ts                 # Colors, Typography, Spacing, Radius, Shadow tokens
    ├── store/
    │   └── index.ts                 # Zustand store — kits, medicines, notifications, appointments, doctors
    ├── hooks/
    │   └── index.ts                 # useMedicineStatus, useExpiryLabel, useKitMedicines, etc.
    ├── components/
    │   └── index.tsx                # Shared UI: StatusBadge, MedicineIcon, KitThumb, Card, etc.
    ├── navigation/
    │   └── AppNavigator.tsx         # Root stack + bottom tabs + kit stack + profile stack
    ├── context/
    │   └── ThemeContext.tsx         # Dark/light mode context
    ├── i18n/
    │   ├── index.ts                 # useT() hook
    │   └── translations.ts          # EN, RU, TR, RO strings
    ├── utils/
    │   ├── securityInit.ts          # AES-256 key from OS keychain; one-time MMKV migration
    │   ├── createSecureMMKV.ts      # LazyMMKV class — defers MMKV init until key is ready
    │   └── notificationScheduler.ts # Schedule/cancel local notifications; hash-based dedup
    ├── api/
    │   ├── config.ts                # Base URL, apiStorage (LazyMMKV)
    │   ├── client.ts                # request(), ensureAuth(), loginWithGoogle(), logout()
    │   ├── social.ts                # REST wrappers — kits, medicines, doctors, appointments
    │   ├── realtime.ts              # WebSocket client (auth via first message frame)
    │   ├── outbox.ts                # Durable offline outbox — persist ops to MMKV, drain on reconnect
    │   └── sync.ts                  # startSync() / stopSync() — pull + push + outbox drain
    └── screens/
        ├── KitListScreen.tsx
        ├── KitDetailScreen.tsx
        ├── MedicineDetailScreen.tsx
        ├── AddMedicineScreen.tsx
        ├── NotificationsScreen.tsx
        ├── ExpiryScreen.tsx
        ├── AppointmentsScreen.tsx   # Doctor appointments — CRUD, file attachments, calendar
        ├── HelpScreen.tsx           # FAQ / how-to-use
        └── index.tsx                # ProfileScreen, SettingsScreen, ShareKitScreen, etc.

server/
├── package.json
├── Dockerfile
├── docker-compose.yml
└── src/
    ├── index.ts                     # Express app — helmet, rate limiting, routes
    ├── config.ts                    # Env vars (DATABASE_URL, JWT_SECRET, etc.)
    ├── db.ts                        # pg pool, migrations, token blocklist cleanup
    ├── auth.ts                      # JWT sign/verify, token blocklist, requireAuth middleware
    ├── realtime.ts                  # WebSocket server — auth via first message
    ├── serialize.ts                 # Row → DTO mappers
    ├── util.ts                      # ah(), id(), now(), HttpError
    └── routes/
        ├── auth.ts                  # /auth — register, login, me, logout, PATCH me, Google
        ├── kits.ts
        ├── kitMedicines.ts
        ├── notifications.ts
        ├── social.ts
        ├── doctors.ts
        └── appointments.ts         # Paginated, status-validated, file-meta-capable
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- React Native CLI (not Expo)
- Xcode 15+ (for iOS)
- Android Studio + Android SDK 34 (for Android)
- CocoaPods (for iOS)
- PostgreSQL 15+ (or Docker)

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

### 5. Backend Setup

```bash
cd server
cp .env.example .env        # fill in DATABASE_URL, JWT_SECRET, GOOGLE_CLIENT_IDS, GROQ_API_KEY (label scanning)
npm install

# Option A — Docker (recommended)
docker-compose up -d

# Option B — local Postgres
npm run dev
```

The server runs on port 3000 by default. The client points to `http://10.0.2.2:3000` (Android emulator) or `http://localhost:3000` (iOS simulator) in development.

---

## Design System

All design tokens are in `src/theme/index.ts`:

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

## Navigation Architecture

```
RootStack
├── Onboarding (first launch only)
└── Main (Bottom Tabs)
    ├── KitsTab → KitsStack
    │   ├── KitList
    │   ├── KitDetail
    │   ├── MedicineDetail
    │   ├── AddMedicine
    │   ├── ShareKit
    │   ├── MedicineInteraction
    │   └── CreateEditKit
    ├── NotificationsTab
    ├── ExpiryTab
    └── ProfileTab → ProfileStack
        ├── ProfileHome
        ├── Settings
        ├── Appointments
        ├── Help
        └── LinkedAccounts
```

---

## State Management (Zustand + MMKV)

`src/store/index.ts` manages kits, medicines, notifications, doctors, and appointments with:

- **Offline-first**: all writes go through the outbox (`src/api/outbox.ts`) which persists to MMKV and drains when online
- **`updatedAt`-based conflict resolution**: server data only overwrites local when it is newer
- **Encrypted storage**: AES-256 key generated on first launch and stored in the OS keychain; all MMKV instances use this key via `LazyMMKV`
- **`skipHydration: true`**: store does not read MMKV until `bootstrapSecurity()` has loaded the key

---

## Auth

- Auto-provisioned device account on first launch (nickname + 192-bit random secret)
- Google Sign-In via `@react-native-google-signin/google-signin` + server-side ID-token verification
- JWT sessions (30-day TTL, `jti` UUID per token)
- Token revocation: `POST /auth/logout` inserts the `jti` into a Postgres `token_blocklist` table; in-memory LRU cache avoids a DB round-trip on every request

---

## Security

| Area | Measure |
|---|---|
| Local storage | MMKV encrypted with AES-256 key from OS keychain |
| Auth secrets | 192-bit `crypto.getRandomValues` secret, never `Math.random` |
| HTTP headers | `helmet` — X-Content-Type-Options, X-Frame-Options, etc. |
| Rate limiting | 20 auth requests / 15 min / IP |
| Token revocation | Postgres `token_blocklist` + in-memory LRU cache |
| WebSocket auth | Token in first message frame, not URL query param |
| TLS | Cleartext blocked in production; allowed only for localhost/10.0.2.2 in debug builds via `network_security_config.xml` |
| Password hashing | bcrypt, cost 10, always async |

---

## Key Dependencies

### Client

| Package | Purpose |
|---|---|
| `@react-navigation/*` | Navigation |
| `zustand` | Global state |
| `react-native-mmkv` | Fast encrypted local storage |
| `react-native-keychain` | OS keychain for MMKV encryption key |
| `react-native-fs` | Permanent file storage for appointment analyses |
| `react-native-document-picker` | Pick analysis/prescription files |
| `@react-native-community/netinfo` | Mid-session outbox drain on reconnect |
| `react-native-reanimated` | Animations |
| `react-native-gesture-handler` | Gestures |
| `react-native-linear-gradient` | Card gradients |
| `react-native-share` | Native share sheet |
| `react-native-qrcode-svg` | QR code generation |
| `react-native-date-picker` | Date/time picker |
| `react-native-image-picker` | Photo/file picking |
| `react-native-haptic-feedback` | Haptics |
| `date-fns` | Date formatting |

### Server

| Package | Purpose |
|---|---|
| `express` | HTTP server |
| `helmet` | Security headers |
| `express-rate-limit` | Auth rate limiting |
| `jsonwebtoken` | JWT sign/verify |
| `bcryptjs` | Password hashing |
| `pg` | PostgreSQL client |
| `zod` | Request validation |
| `google-auth-library` | Google ID-token verification |
| `ws` | WebSocket server |

---

## Screens Checklist

| # | Screen | Status |
|---|---|---|
| 1 | Onboarding | Stub |
| 2 | Home / My Medicine Kits | Done |
| 3 | Create / Edit Kit | Done |
| 4 | Medicine List Inside a Kit | Done |
| 5 | Add Medicine | Done |
| 6 | Scan Medicine | Stub |
| 7 | Manual Medicine Entry | Done |
| 8 | Medicine Details | Done |
| 9 | Medicine Interaction / Warning | Done |
| 10 | Share Medicine | Stub |
| 11 | Share Medicine Kit | Done |
| 12 | Notifications | Done |
| 13 | Expiration Management | Done |
| 14 | Synced Members | Stub |
| 15 | Linked Accounts / Sync | Done |
| 16 | Activity History | Stub |
| 17 | Search | Stub |
| 18 | Profile | Done |
| 19 | Settings | Done |
| 20 | Reminder Settings | Done |
| 21 | Help / How to Use | Done |
| 22 | Doctor Appointments | Done |
| 23 | Empty States | Done (inline) |

---

## Localisation

EN, RU, TR, RO. All strings live in `src/i18n/translations.ts`. To add a language, extend the `translations` object with a new locale key and pass it to the `useT()` hook.
