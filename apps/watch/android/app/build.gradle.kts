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



    defaultConfig {

        applicationId = "com.theeye.watch"

        minSdk = 26

        targetSdk = flutter.targetSdkVersion

        versionCode = flutter.versionCode

        versionName = flutter.versionName

    }



    flavorDimensions += "environment"

    productFlavors {

        create("development") {

            dimension = "environment"

            applicationIdSuffix = ".dev"

        }

        create("staging") {

            dimension = "environment"

            applicationIdSuffix = ".staging"

        }

        create("production") {

            dimension = "environment"

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


