plugins {

    id("com.android.application")

    id("dev.flutter.flutter-gradle-plugin")

    id("com.google.gms.google-services")

}



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

