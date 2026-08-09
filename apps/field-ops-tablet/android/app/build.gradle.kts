plugins {
    id("com.android.application")
    id("dev.flutter.flutter-gradle-plugin")
    id("com.google.gms.google-services")
}

fun resolveFieldDeviceMode(): String {
    val fromProp = (project.findProperty("FIELD_DEVICE_MODE") as String?)?.trim()?.lowercase()
    val fromEnv = System.getenv("FIELD_DEVICE_MODE")?.trim()?.lowercase()
    val raw = fromProp?.takeIf { it.isNotEmpty() }
        ?: fromEnv?.takeIf { it.isNotEmpty() }
        ?: "standard"
    return when (raw) {
        "launcher", "field_launcher" -> "launcher"
        "managed_kiosk", "kiosk", "managed" -> "managed_kiosk"
        else -> "standard"
    }
}

val fieldDeviceMode = resolveFieldDeviceMode()

android {
    namespace = "com.theeye.fieldops"
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
        applicationId = "com.theeye.fieldops"
        minSdk = 26
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        manifestPlaceholders["fieldDeviceMode"] = fieldDeviceMode
        buildConfigField("String", "FIELD_DEVICE_MODE", "\"$fieldDeviceMode\"")
    }

    flavorDimensions += "environment"
    productFlavors {
        create("staging") {
            dimension = "environment"
            applicationIdSuffix = ".staging"
            // Staging defaults to launcher so agency pilot tablets can set HOME.
            // Override with -PFIELD_DEVICE_MODE=standard|managed_kiosk.
            val stagingMode = if (
                project.hasProperty("FIELD_DEVICE_MODE") ||
                !System.getenv("FIELD_DEVICE_MODE").isNullOrBlank()
            ) {
                fieldDeviceMode
            } else {
                "launcher"
            }
            manifestPlaceholders["fieldDeviceMode"] = stagingMode
            buildConfigField("String", "FIELD_DEVICE_MODE", "\"$stagingMode\"")
        }
        create("production") {
            dimension = "environment"
            // Production stays STANDARD_APP unless explicitly configured.
            val productionMode = if (
                project.hasProperty("FIELD_DEVICE_MODE") ||
                !System.getenv("FIELD_DEVICE_MODE").isNullOrBlank()
            ) {
                fieldDeviceMode
            } else {
                "standard"
            }
            manifestPlaceholders["fieldDeviceMode"] = productionMode
            buildConfigField("String", "FIELD_DEVICE_MODE", "\"$productionMode\"")
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("debug")
        }
        debug {
            signingConfig = signingConfigs.getByName("debug")
        }
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
