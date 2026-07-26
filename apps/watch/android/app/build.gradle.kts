plugins {
    id("com.android.application")
    id("dev.flutter.flutter-gradle-plugin")
    id("com.google.gms.google-services")
}

val keystorePropertiesFile = rootProject.file("key.properties")
val keystoreProperties = java.util.Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(java.io.FileInputStream(keystorePropertiesFile))
}

val stagingStorePath = System.getenv("THE_EYE_STAGING_KEYSTORE_PATH")
    ?: keystoreProperties.getProperty("stagingStoreFile")
val stagingStorePassword = System.getenv("THE_EYE_STAGING_KEYSTORE_PASSWORD")
    ?: keystoreProperties.getProperty("stagingStorePassword")
val stagingKeyAlias = System.getenv("THE_EYE_STAGING_KEY_ALIAS")
    ?: keystoreProperties.getProperty("stagingKeyAlias")
val stagingKeyPassword = System.getenv("THE_EYE_STAGING_KEY_PASSWORD")
    ?: keystoreProperties.getProperty("stagingKeyPassword")
val allowDebugStagingRelease =
    (System.getenv("THE_EYE_ALLOW_DEBUG_STAGING_RELEASE") ?: "false") == "true"
val hasStagingReleaseSigning =
    !stagingStorePath.isNullOrBlank() &&
        !stagingStorePassword.isNullOrBlank() &&
        !stagingKeyAlias.isNullOrBlank() &&
        !stagingKeyPassword.isNullOrBlank()

android {
    namespace = "com.theeye.watch"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        buildConfig = true
    }

    defaultConfig {
        applicationId = "com.theeye.watch"
        minSdk = 26
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        buildConfigField("String", "LAUNCHER_MODE", "\"consumer\"")
    }

    signingConfigs {
        create("stagingRelease") {
            if (hasStagingReleaseSigning) {
                storeFile = file(stagingStorePath!!)
                storePassword = stagingStorePassword
                keyAlias = stagingKeyAlias
                keyPassword = stagingKeyPassword
            }
        }
    }

    flavorDimensions += "environment"
    productFlavors {
        create("development") {
            dimension = "environment"
            applicationIdSuffix = ".dev"
            buildConfigField("String", "LAUNCHER_MODE", "\"consumer\"")
        }
        create("staging") {
            dimension = "environment"
            applicationIdSuffix = ".staging"
            buildConfigField("String", "LAUNCHER_MODE", "\"consumer\"")
        }
        create("production") {
            dimension = "environment"
            buildConfigField("String", "LAUNCHER_MODE", "\"consumer\"")
        }
        create("managedStaging") {
            dimension = "environment"
            applicationIdSuffix = ".staging"
            buildConfigField("String", "LAUNCHER_MODE", "\"managed\"")
        }
        create("managedProduction") {
            dimension = "environment"
            buildConfigField("String", "LAUNCHER_MODE", "\"managed\"")
        }
    }

    buildTypes {
        release {
            // Per-flavor signing is applied via androidComponents below.
        }
        debug {
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

androidComponents {
    onVariants(selector().withBuildType("release")) { variant ->
        val envFlavor = variant.productFlavors.find { it.first == "environment" }?.second
        val isStagingFlavor = envFlavor == "staging" || envFlavor == "managedStaging"

        if (isStagingFlavor) {
            if (allowDebugStagingRelease) {
                variant.signingConfig?.setConfig(android.signingConfigs.getByName("debug"))
                return@onVariants
            }
            if (!hasStagingReleaseSigning) {
                throw GradleException(
                    "Watch staging release signing is not configured. " +
                        "Set THE_EYE_STAGING_KEYSTORE_PATH, THE_EYE_STAGING_KEYSTORE_PASSWORD, " +
                        "THE_EYE_STAGING_KEY_ALIAS, and THE_EYE_STAGING_KEY_PASSWORD " +
                        "(or android/key.properties staging* entries). " +
                        "Emergency override only: THE_EYE_ALLOW_DEBUG_STAGING_RELEASE=true",
                )
            }
            variant.signingConfig?.setConfig(android.signingConfigs.getByName("stagingRelease"))
            return@onVariants
        }

        variant.signingConfig?.setConfig(android.signingConfigs.getByName("debug"))
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}

dependencies {
    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
}
