import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const rootDir = process.cwd();
const androidDir = path.join(rootDir, 'android');
const appDir = path.join(androidDir, 'app');
const resDir = path.join(appDir, 'src', 'main', 'res');

console.log('🚀 Starting SlideCraft AI Android App Bundle (.aab) build...');

// 1. Ensure android directory structure
fs.mkdirSync(path.join(androidDir, 'gradle'), { recursive: true });
fs.mkdirSync(path.join(appDir, 'src', 'main', 'res', 'values'), { recursive: true });
fs.mkdirSync(path.join(appDir, 'src', 'main', 'res', 'xml'), { recursive: true });
fs.mkdirSync(path.join(appDir, 'src', 'main', 'res', 'mipmap-hdpi'), { recursive: true });
fs.mkdirSync(path.join(appDir, 'src', 'main', 'res', 'mipmap-xhdpi'), { recursive: true });
fs.mkdirSync(path.join(appDir, 'src', 'main', 'res', 'mipmap-xxhdpi'), { recursive: true });
fs.mkdirSync(path.join(appDir, 'src', 'main', 'res', 'mipmap-xxxhdpi'), { recursive: true });

// 2. Write settings.gradle
fs.writeFileSync(
  path.join(androidDir, 'settings.gradle'),
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

// 3. Write build.gradle
fs.writeFileSync(
  path.join(androidDir, 'build.gradle'),
  `plugins {
    id 'com.android.application' version '8.7.3' apply false
}
`
);

// 4. Write gradle.properties
fs.writeFileSync(
  path.join(androidDir, 'gradle.properties'),
  `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.enableJetifier=false
android.nonTransitiveRClass=true
`
);

// 5. Write app/build.gradle
const packageName = process.env.ANDROID_PACKAGE_NAME || 'com.slidecraft.ai';
const hostName = process.env.APP_HOST || 'ais-pre-wlqshm6emdlmrytnmfqxcj-576423299118.asia-east1.run.app';
const appName = 'SlideCraft AI';

fs.writeFileSync(
  path.join(appDir, 'build.gradle'),
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

    signingConfigs {
        release {
            storeFile file("release.keystore")
            storePassword "slidecraft123"
            keyAlias "slidecraft"
            keyPassword "slidecraft123"
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
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

// 6. Write app/proguard-rules.pro
fs.writeFileSync(
  path.join(appDir, 'proguard-rules.pro'),
  `-keep class com.google.androidbrowserhelper.** { *; }
-keep class androidx.browser.** { *; }
`
);

// 7. Write AndroidManifest.xml
fs.writeFileSync(
  path.join(appDir, 'src', 'main', 'AndroidManifest.xml'),
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

// 8. Write res XML resources
fs.writeFileSync(
  path.join(resDir, 'values', 'colors.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">#0F172A</color>
    <color name="colorPrimaryDark">#0F172A</color>
    <color name="navigationColor">#FFFFFF</color>
    <color name="backgroundColor">#FFFFFF</color>
</resources>
`
);

fs.writeFileSync(
  path.join(resDir, 'values', 'styles.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.SlideCraftAI" parent="android:Theme.Translucent.NoTitleBar">
        <item name="android:windowBackground">@color/backgroundColor</item>
        <item name="android:statusBarColor">@color/colorPrimary</item>
    </style>
</resources>
`
);

fs.writeFileSync(
  path.join(resDir, 'xml', 'filepaths.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<paths>
    <files-path name="shared" path="." />
    <cache-path name="cache" path="." />
</paths>
`
);

// 9. Copy app launcher icons
const publicDir = path.join(rootDir, 'public');
const icon512Path = path.join(publicDir, 'pwa-512x512.png');
const maskable512Path = path.join(publicDir, 'pwa-maskable-512x512.png');
const icon192Path = path.join(publicDir, 'pwa-192x192.png');

if (fs.existsSync(icon512Path)) {
  fs.copyFileSync(icon512Path, path.join(resDir, 'mipmap-xxxhdpi', 'ic_launcher.png'));
  fs.copyFileSync(icon512Path, path.join(resDir, 'mipmap-xxhdpi', 'ic_launcher.png'));
  fs.copyFileSync(icon512Path, path.join(resDir, 'mipmap-hdpi', 'ic_launcher.png'));
}
if (fs.existsSync(maskable512Path)) {
  fs.copyFileSync(maskable512Path, path.join(resDir, 'mipmap-xxxhdpi', 'ic_launcher_round.png'));
  fs.copyFileSync(maskable512Path, path.join(resDir, 'mipmap-xxhdpi', 'ic_launcher_round.png'));
  fs.copyFileSync(maskable512Path, path.join(resDir, 'mipmap-hdpi', 'ic_launcher_round.png'));
} else if (fs.existsSync(icon512Path)) {
  fs.copyFileSync(icon512Path, path.join(resDir, 'mipmap-xxxhdpi', 'ic_launcher_round.png'));
  fs.copyFileSync(icon512Path, path.join(resDir, 'mipmap-xxhdpi', 'ic_launcher_round.png'));
  fs.copyFileSync(icon512Path, path.join(resDir, 'mipmap-hdpi', 'ic_launcher_round.png'));
}
if (fs.existsSync(icon192Path)) {
  fs.copyFileSync(icon192Path, path.join(resDir, 'mipmap-xhdpi', 'ic_launcher.png'));
  fs.copyFileSync(icon192Path, path.join(resDir, 'mipmap-xhdpi', 'ic_launcher_round.png'));
}

console.log('✅ Android Studio project files generated successfully in /android');

// 10. Generate release.keystore if missing
const keystorePath = path.join(appDir, 'release.keystore');
if (!fs.existsSync(keystorePath)) {
  console.log('🔑 Generating release keystore...');
  try {
    execSync(
      `keytool -genkeypair -v -keystore "${keystorePath}" -alias slidecraft -keyalg RSA -keysize 2048 -validity 10000 -storepass slidecraft123 -keypass slidecraft123 -dname "CN=SlideCraft AI, OU=Engineering, O=SlideCraft, L=San Francisco, ST=CA, C=US"`,
      { stdio: 'inherit' }
    );
    console.log('✅ Keystore generated at app/release.keystore');
  } catch (err) {
    console.error('⚠️ Failed to generate keystore:', err.message);
  }
} else {
  console.log('🔑 Keystore already exists at app/release.keystore');
}

// 11. Extract SHA-256 Fingerprint
let sha256Fingerprint = '';
try {
  const keytoolOutput = execSync(
    `keytool -list -v -keystore "${keystorePath}" -alias slidecraft -storepass slidecraft123`,
    { encoding: 'utf-8' }
  );
  const match = keytoolOutput.match(/SHA256:\s*([A-FA-f0-9:]+)/);
  if (match) {
    sha256Fingerprint = match[1].trim().toUpperCase();
    console.log('📌 SHA-256 Fingerprint:', sha256Fingerprint);
  }
} catch (e) {
  console.warn('Could not extract SHA-256 fingerprint automatically.');
}

// 12. Run Gradle bundleRelease
console.log('📦 Building Android App Bundle (.aab) with Gradle...');
const gradleBat = 'C:\\Users\\HP\\.gradle\\wrapper\\dists\\gradle-8.14.3-all\\10utluxaxniiv4wxiphsi49nj\\gradle-8.14.3\\bin\\gradle.bat';

const userHome = process.env.USERPROFILE || 'C:\\Users\\HP';
const androidUserHome = path.join(userHome, '.android');
if (!fs.existsSync(androidUserHome)) {
  fs.mkdirSync(androidUserHome, { recursive: true });
}

const buildEnv = { ...process.env };
delete buildEnv.ANDROID_PREFS_ROOT;
delete buildEnv.ANDROID_SDK_HOME;
buildEnv.ANDROID_HOME = 'C:\\Users\\HP\\AppData\\Local\\Android\\Sdk';
buildEnv.ANDROID_SDK_ROOT = 'C:\\Users\\HP\\AppData\\Local\\Android\\Sdk';
buildEnv.ANDROID_USER_HOME = androidUserHome;
buildEnv.GRADLE_USER_HOME = path.join(userHome, '.gradle');
buildEnv.JAVA_HOME = process.env.JAVA_HOME || 'C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.13.9-hotspot';

try {
  execSync(`"${gradleBat}" bundleRelease`, {
    cwd: androidDir,
    env: buildEnv,
    stdio: 'inherit',
  });
  console.log('🎉 Gradle build completed!');
} catch (err) {
  console.error('❌ Gradle build failed:', err.message);
  process.exit(1);
}

// 13. Copy generated .aab to project root
const generatedAab = path.join(appDir, 'build', 'outputs', 'bundle', 'release', 'app-release.aab');
const outputAab = path.join(rootDir, 'SlideCraftAI-release.aab');

if (fs.existsSync(generatedAab)) {
  fs.copyFileSync(generatedAab, outputAab);
  const size = (fs.statSync(outputAab).size / (1024 * 1024)).toFixed(2);
  console.log(`\n========================================`);
  console.log(`✨ SUCCESS! Android App Bundle created:`);
  console.log(`📍 Path: ${outputAab}`);
  console.log(`📦 Size: ${size} MB`);
  if (sha256Fingerprint) {
    console.log(`🔑 SHA-256 Fingerprint: ${sha256Fingerprint}`);
  }
  console.log(`========================================\n`);
} else {
  console.error('❌ Could not locate generated .aab file.');
  process.exit(1);
}
