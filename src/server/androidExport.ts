import fs from 'fs';
import JSZip from 'jszip';
import path from 'path';

export interface AndroidProjectOptions {
  packageName: string;
  hostName: string;
  appName?: string;
}

function sanitizePackageName(raw: string): string {
  const cleaned = raw.trim().toLowerCase().replace(/[^a-z0-9._]/g, '');
  if (/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(cleaned)) {
    return cleaned;
  }
  return 'com.slidecraft.ai';
}

function sanitizeHostName(raw: string): string {
  const trimmed = raw.trim().replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];
  return trimmed || 'ais-pre-wlqshm6emdlmrytnmfqxcj-576423299118.asia-east1.run.app';
}

export async function generateAndroidStudioProjectZip(
  options: AndroidProjectOptions
): Promise<Buffer> {
  const packageName = sanitizePackageName(options.packageName);
  const hostName = sanitizeHostName(options.hostName);
  const appName = (options.appName || 'SlideCraft AI').replace(/[<>&'"]/g, '');

  const zip = new JSZip();
  const root = zip.folder('SlideCraftAI-AndroidStudio')!;

  root.file(
    'settings.gradle',
    `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "SlideCraftAI"
include ':app'
`
  );

  root.file(
    'build.gradle',
    `plugins {
    id 'com.android.application' version '8.5.2' apply false
}
`
  );

  root.file(
    'gradle.properties',
    `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.enableJetifier=false
android.nonTransitiveRClass=true
`
  );

  root.file(
    'gradle/wrapper/gradle-wrapper.properties',
    `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-8.7-bin.zip
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
`
  );

  const appDir = root.folder('app')!;
  appDir.file(
    'build.gradle',
    `plugins {
    id 'com.android.application'
}

def twaManifest = [
    applicationId: '${packageName}',
    hostName: '${hostName}',
    launchUrl: '/',
    name: '${appName}',
    launcherName: 'SlideCraft',
    themeColor: '#0F172A',
    themeColorDark: '#0F172A',
    navigationColor: '#FFFFFF',
    navigationColorDark: '#0F172A',
    navigationDividerColor: '#E2E8F0',
    navigationDividerColorDark: '#1E293B',
    backgroundColor: '#FFFFFF',
    enableNotifications: true,
    fallbackType: 'customtabs',
    orientation: 'default'
]

android {
    namespace '${packageName}'
    compileSdk 35

    defaultConfig {
        applicationId twaManifest.applicationId
        minSdk 23
        targetSdk 35
        versionCode 1
        versionName "1.0.0"

        resValue "string", "app_name", twaManifest.name
        resValue "string", "launcher_name", twaManifest.launcherName
        resValue "string", "host_name", twaManifest.hostName
        resValue "string", "launch_url", "https://" + twaManifest.hostName + twaManifest.launchUrl
        resValue "string", "provider_authority", twaManifest.applicationId + ".fileprovider"
        resValue "string", "asset_statements", '[{"relation": ["delegate_permission/common.handle_all_urls"], "target": {"namespace": "android_app", "package_name": "' + twaManifest.applicationId + '", "site": "https://' + twaManifest.hostName + '"}}]'

        manifestPlaceholders = [
            hostName: twaManifest.hostName,
            defaultUrl: "https://" + twaManifest.hostName + twaManifest.launchUrl,
            launcherName: twaManifest.launcherName,
            fallbackStrategy: twaManifest.fallbackType
        ]
    }

    buildTypes {
        release {
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
}

dependencies {
    implementation 'com.google.androidbrowserhelper:androidbrowserhelper:2.5.0'
    implementation 'androidx.browser:browser:1.8.0'
}
`
  );

  appDir.file(
    'proguard-rules.pro',
    `-keep class com.google.androidbrowserhelper.** { *; }
-keep class androidx.browser.** { *; }
`
  );

  const mainDir = appDir.folder('src/main')!;
  mainDir.file(
    'AndroidManifest.xml',
    `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:label="@string/app_name"
        android:supportsRtl="true"
        android:theme="@style/Theme.SlideCraftAI">

        <meta-data
            android:name="asset_statements"
            android:resource="@string/asset_statements" />

        <activity
            android:name="com.google.androidbrowserhelper.trusted.LauncherActivity"
            android:exported="true"
            android:label="@string/launcher_name">

            <meta-data
                android:name="android.support.customtabs.trusted.DEFAULT_URL"
                android:value="\${defaultUrl}" />

            <meta-data
                android:name="android.support.customtabs.trusted.STATUS_BAR_COLOR"
                android:resource="@color/colorPrimary" />

            <meta-data
                android:name="android.support.customtabs.trusted.NAVIGATION_BAR_COLOR"
                android:resource="@color/navigationColor" />

            <meta-data
                android:name="android.support.customtabs.trusted.FALLBACK_STRATEGY"
                android:value="\${fallbackStrategy}" />

            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>

            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data
                    android:scheme="https"
                    android:host="\${hostName}" />
            </intent-filter>
        </activity>

        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="@string/provider_authority"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/filepaths" />
        </provider>
    </application>
</manifest>
`
  );

  const resDir = mainDir.folder('res')!;
  resDir.file(
    'values/colors.xml',
    `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">#0F172A</color>
    <color name="colorPrimaryDark">#0F172A</color>
    <color name="navigationColor">#FFFFFF</color>
    <color name="backgroundColor">#FFFFFF</color>
</resources>
`
  );

  resDir.file(
    'values/styles.xml',
    `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.SlideCraftAI" parent="android:Theme.Translucent.NoTitleBar">
        <item name="android:windowBackground">@color/backgroundColor</item>
        <item name="android:statusBarColor">@color/colorPrimary</item>
    </style>
</resources>
`
  );

  resDir.file(
    'xml/filepaths.xml',
    `<?xml version="1.0" encoding="utf-8"?>
<paths>
    <files-path name="shared" path="." />
    <cache-path name="cache" path="." />
</paths>
`
  );

  // Embed real SlideCraft AI launcher PNG icons from public/
  const publicDir = path.join(process.cwd(), 'public');
  const icon512Path = path.join(publicDir, 'pwa-512x512.png');
  const maskable512Path = path.join(publicDir, 'pwa-maskable-512x512.png');
  const icon192Path = path.join(publicDir, 'pwa-192x192.png');

  if (fs.existsSync(icon512Path)) {
    const buf512 = fs.readFileSync(icon512Path);
    resDir.file('mipmap-xxxhdpi/ic_launcher.png', buf512);
    resDir.file('mipmap-xxhdpi/ic_launcher.png', buf512);
  }
  if (fs.existsSync(maskable512Path)) {
    const bufMask = fs.readFileSync(maskable512Path);
    resDir.file('mipmap-xxxhdpi/ic_launcher_round.png', bufMask);
    resDir.file('mipmap-xxhdpi/ic_launcher_round.png', bufMask);
  } else if (fs.existsSync(icon512Path)) {
    const buf512 = fs.readFileSync(icon512Path);
    resDir.file('mipmap-xxxhdpi/ic_launcher_round.png', buf512);
    resDir.file('mipmap-xxhdpi/ic_launcher_round.png', buf512);
  }
  if (fs.existsSync(icon192Path)) {
    const buf192 = fs.readFileSync(icon192Path);
    resDir.file('mipmap-xhdpi/ic_launcher.png', buf192);
    resDir.file('mipmap-xhdpi/ic_launcher_round.png', buf192);
  }

  root.file(
    'README.md',
    `# SlideCraft AI — Android Studio Project (Trusted Web Activity)

This Gradle project wraps your deployed SlideCraft AI web app for editing, testing, and publishing on **Google Play Store** using **Android Studio** on your laptop.

## Quick Setup in Android Studio
1. Extract this ZIP folder on your laptop.
2. Open **Android Studio** -> **Open** -> select the extracted \`SlideCraftAI-AndroidStudio\` folder.
3. Wait for Android Studio to download Gradle and sync dependencies (\`androidbrowserhelper:2.5.0\`).
4. Check \`app/build.gradle\`:
   - \`applicationId\`: \`${packageName}\`
   - \`hostName\`: \`${hostName}\` (make sure your app is deployed/shared at this public HTTPS domain!)
5. Run on an Android Emulator or USB-connected Android phone using the **Run (▶)** button.

## Building for Google Play Store (.aab)
1. In Android Studio, click **Build -> Generate Signed App Bundle / APK...**
2. Choose **Android App Bundle (.aab)** and create or select your upload keystore (keep this \`.jks\` file safe forever!).
3. Upload the generated \`app-release.aab\` in **Google Play Console**.
4. Copy the **SHA-256 certificate fingerprint** from **Play Console -> App Integrity -> App Signing** and paste it into SlideCraft AI (**Founder Console -> Founder Settings -> Google Play Store Publishing**) so \`https://${hostName}/.well-known/assetlinks.json\` verifies full-screen mode without the Chrome address bar.
`
  );

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
