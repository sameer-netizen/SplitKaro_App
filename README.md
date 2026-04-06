# SplitKaro — Bill Splitting App

A **Splitwise-style** bill splitting app for Android & iOS, built in Indian Rupees (₹).  
Split expenses across multiple users, sync in real time across devices — **100% free technologies.**

---

## Download & Install

### Android (Direct APK)

> No Play Store needed — just download and install.

1. Go to the [**Releases**](https://github.com/sameer-netizen/SplitKaro_App/releases) page on GitHub.
2. Open the latest release (tagged `apk-{BUILD_ID}`).
3. Download **`SplitKaro-latest.apk`** under *Assets*.
4. On your Android phone:
   - Open the downloaded APK file.
   - If prompted, tap **Settings → Allow from this source** (one-time permission).
   - Tap **Install** → **Done**.
5. Open **SplitKaro** from your app drawer and register a free account.

> **Tip:** You can also share the APK file directly (WhatsApp, email, etc.) — recipients follow steps 4–5.
>
> **Fallback (if release is delayed):** Download the committed APK directly from this repo path: `releases/SplitKaro-latest.apk`.

---

### iOS

> iOS does not allow direct APK installs. Choose one of the options below.

#### Option A — Expo Go (free, no Apple account needed)

1. Install **[Expo Go](https://apps.apple.com/app/expo-go/id982107779)** from the App Store.
2. Ask the developer to share the Expo project link or scan the QR code from `npx expo start`.
3. The app loads instantly — phone and Mac must be on the same Wi-Fi, or run `--tunnel` mode.

#### Option B — TestFlight (standalone, requires Apple Developer account)

1. Build the app using EAS:
   ```bash
   npx eas-cli login
   npm run build:ios
   ```
2. In [App Store Connect](https://appstoreconnect.apple.com), find the build under **TestFlight**.
3. Add testers by email — they receive an invite to install via the **TestFlight** app.

> **Note:** An [Apple Developer Program](https://developer.apple.com/programs/) membership ($99/year) is required for TestFlight distribution.

---

## Features

| Feature | Description |
|---|---|
| User accounts | Register & login with email/password |
| Groups | Create groups (Trip, Flat, Friends) |
| Add members | Add registered users by email or guest members without signup |
| Add expenses | Describe, amount, category (Food / Transport / Stay …) |
| Split modes | Equal split **or** exact custom amounts |
| Paid-by | Track who actually paid |
| Balances | See who owes whom per group |
| Minimize debts | Smart algorithm to minimize the number of transactions |
| Settle up | Record payments to clear debts |
| Real-time sync | Changes appear instantly on all devices (Firebase) |
| Indian Rupees | ₹ throughout, formatted with `en-IN` locale |

---

## Tech Stack (all free)

| Layer | Technology |
|---|---|
| Mobile framework | [Expo](https://expo.dev) (React Native) – SDK 54 |
| Database + Auth | [Firebase](https://firebase.google.com) – Spark free plan |
| Navigation | React Navigation 7 |
| Icons | @expo/vector-icons (Ionicons) |
| Build | EAS Build (free tier – ~30 Android builds/month) |
| Distribution | Expo Go (test) / APK direct install (Android) |

---

## Step-by-Step Setup

### 1. Install prerequisites

```bash
# Node.js 18+ required  (https://nodejs.org)
node --version

# Optional: install EAS CLI globally for APK builds
npm install -g eas-cli
```

### 2. Set up Firebase (free)

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → give it a name (e.g. `splitkaro`) → Continue → Create project
3. In the project dashboard click **< / > Web** to add a web app → Register → copy the `firebaseConfig` object
4. Open `firebase.js` in this project and **replace the placeholder values** with your real config:

```js
const firebaseConfig = {
  apiKey:            'AIzaSy...',
  authDomain:        'splitkaro-xxxx.firebaseapp.com',
  projectId:         'splitkaro-xxxx',
  storageBucket:     'splitkaro-xxxx.appspot.com',
  messagingSenderId: '123456789',
  appId:             '1:123456789:web:abcdef',
};
```

5. **Enable Authentication**
   - Firebase Console → Authentication → Get started → Sign-in method → Email/Password → Enable → Save

6. **Create Firestore database**
   - Firebase Console → Firestore Database → Create database
   - Choose *"Start in test mode"* to get started (you will update rules below)
   - Pick a region close to India (e.g. `asia-south1`)

7. **Apply Firestore security rules**
   - Firebase Console → Firestore → Rules tab
   - Replace the content with the rules from `firestore.rules` in this repo
   - Click **Publish**

### 3. Install dependencies

```bash
cd /path/to/SplitKaro
npm install
npm run doctor
```

### 4. Run on your phone (instant — no build needed)

```bash
# Start the development server
npx expo start
```

- Install **Expo Go** from the App Store (iOS) or Play Store (Android) on your phone
- Scan the QR code shown in the terminal with your phone's camera (iOS) or via the Expo Go app (Android)
- The app will load instantly — **both phones must be on the same WiFi**, or use tunnel mode:

```bash
npx expo start --tunnel
```

> You and your friends can all test together using Expo Go on the same network.

---

## Build a Standalone App (install directly, no Expo Go needed)

### Android APK (recommended — completely free)

```bash
# Login to your free Expo account (create one at expo.dev if needed)
npx eas-cli login

# Link this project to your account
npm run build:configure

# Build a distributable APK (free, ~10-15 min in cloud)
npm run build:android
```

- After the build finishes, EAS will give you a **download link for the APK**
- Send the APK to anyone — they just open it on Android to install
- Android may ask to allow "Install from unknown sources" — that's normal for sideloaded APKs

### Where the APK is generated and saved

1. APK is built on **EAS Build (cloud)** using Android profile `preview`.
2. A GitHub Action then publishes the finished APK to **GitHub Releases** as `SplitKaro-latest.apk`.
3. Release tag format is `apk-{BUILD_ID}` (example: `apk-3bc3b637-...`).
4. A copy is also kept in this repository at `releases/SplitKaro-latest.apk`.

### GitHub workflows used

- `.github/workflows/publish-latest-apk.yml`
  - Deploys web and triggers Android EAS build on push to `main`.
- `.github/workflows/publish-finished-apk.yml`
  - Polls for latest finished Android build and publishes APK to GitHub Releases.
- `.github/workflows/publish-ota-updates.yml`
  - Publishes OTA updates for app code changes.

### iOS (TestFlight — free with Apple Developer Program at $99/year)

```bash
npm run build:ios
```

- Requires an Apple Developer account (paid)
- Alternatively, everyone uses **Expo Go** on iOS for free during testing

---

## Project Structure

```
SplitKaro/
├── App.js                        ← Root component
├── firebase.js                   ← Firebase configuration (edit this!)
├── firestore.rules               ← Paste into Firebase Console → Firestore → Rules
├── app.json                      ← Expo app metadata
├── package.json                  ← Dependencies
├── eas.json                      ← EAS Build configuration
└── src/
    ├── context/
    │   └── AuthContext.js        ← Auth state (login, register, logout)
    ├── navigation/
    │   └── AppNavigator.js       ← Stack + Tab navigation
    ├── screens/
    │   ├── LoginScreen.js        ← Email/password sign-in
    │   ├── RegisterScreen.js     ← New account creation
    │   ├── GroupsScreen.js       ← List of all groups
    │   ├── CreateGroupScreen.js  ← Create group + add registered or guest members
    │   ├── GroupDetailScreen.js  ← Expenses list + totals
    │   ├── AddExpenseScreen.js   ← Add expense (equal or exact split)
    │   ├── BalancesScreen.js     ← Who owes whom + settle up button
    │   ├── SettleUpScreen.js     ← Record a payment
    │   └── ProfileScreen.js      ← Account info + logout
    ├── components/
    │   ├── ExpenseItem.js        ← Expense card component
    │   └── GroupCard.js          ← Group card component
    └── utils/
        └── calculations.js       ← Balance & split math
```

---

## How It Works

### Adding an expense
1. Inside a group, tap **+**
2. Enter description & ₹ amount
3. Choose category
4. Select who paid
5. Choose **Equal split** or **Exact amounts** per person
6. Tap **Add Expense** — the expense syncs to all group members instantly

### Seeing balances
1. In a group, tap **Balances**
2. See each person's net position (positive = owed money, negative = owes)
3. The app shows the **minimum transactions** needed to settle all debts

### Settling up
1. On the Balances screen, tap **Settle Up** next to a transaction you owe
2. Confirm — this records the payment (no real money moves through the app)
3. Balances update immediately for everyone in the group

---

## Firestore Data Model

```
users/
  {uid}/
    name, email, createdAt

groups/
  {groupId}/
    name, description, members[], memberDetails{}, createdBy, createdAt
    memberDetails.{memberId}.registered: true/false
    
    expenses/
      {expenseId}/
        description, amount, paidBy, paidByName, category
        splitAmong: [{userId, amount}]
        date, dateStr, createdBy
    
    settlements/
      {settlementId}/
        paidBy, paidByName, paidTo, paidToName
        amount, date, dateStr, recordedBy
```

---

## Troubleshooting

| Issue | Fix |
|---|---|
| "Firebase config not set" | Edit `firebase.js` with your real credentials |
| App won't load on Expo Go | Make sure phone and Mac are on same WiFi, or run `--tunnel` |
| "User not found" when adding member | Add them as a guest member directly in the group form |
| Build fails | Run `eas build:configure` first, then retry |
| Auth not persisting | AsyncStorage is installed — check `package.json` |

---

## Multi-User Safety

The included Firestore rules now enforce these protections:

1. Only signed-in users can create groups.
2. The logged-in user must be included in the group they create.
3. Only group members can read group data, expenses, and settlements.
4. Expenses and settlements are append-only from the client app; updates and deletes are blocked by rules.
5. Guest members can exist inside a group, but only signed-in users can access the app directly.

---

## Free Tier Limits (Firebase Spark Plan)

| Resource | Free Limit |
|---|---|
| Firestore reads | 50,000 / day |
| Firestore writes | 20,000 / day |
| Firestore deletes | 20,000 / day |
| Storage | 1 GB |
| Authentication | Unlimited |
| EAS Android builds | ~30 / month |

More than enough for personal use with friends & family.

---

*Built with ❤️ using React Native + Firebase*
