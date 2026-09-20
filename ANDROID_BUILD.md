# ShopQuick QR — Android APK preparation

This project has been prepared for Capacitor, which can wrap an existing web app as an Android application.

## Build

Run:

```bash
npm install
npm run android:build
```

Then open the generated `android/` folder in Android Studio and build an APK.

## IMPORTANT — backend

The UI uses `/api/...` endpoints from `server.ts` for products, orders, shop settings and image uploads. Capacitor packages the web UI, but does not run the Node/Express server inside the Android APK.

Therefore the final APK needs the Express API deployed on a reachable HTTPS server, and `src/services/api.ts` should use that API base URL instead of relative `/api` paths. Without that backend step, the APK can open the UI but API-backed data/actions will not work.

## Package ID

`com.shopquick.qr`
