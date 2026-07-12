const fs = require("fs");
const path = require("path");

const validationPath = path.join(__dirname, "..", "apps", "admin-web", "lib", "auth-validation.ts");
const loginFormPath = path.join(__dirname, "..", "apps", "admin-web", "components", "login-form.tsx");
const forgotPasswordPath = path.join(__dirname, "..", "apps", "admin-web", "app", "login", "forgot-password", "page.tsx");

const validationSource = fs.readFileSync(validationPath, "utf8");
const loginFormSource = fs.readFileSync(loginFormPath, "utf8");
const forgotPasswordSource = fs.readFileSync(forgotPasswordPath, "utf8");

const requiredValidation = [
  "passwordMinLength: 8",
  "otpLength: 6",
  "resetTokenMinLength: 10",
  "validateLoginEmail",
  "validatePassword",
  "validateOtpCode",
  "validateResetToken",
  "sanitizeOtpInput",
];

const missingValidation = requiredValidation.filter((needle) => !validationSource.includes(needle));
if (missingValidation.length) {
  console.error("Admin auth validation test failed. Missing validation rules:", missingValidation.join(", "));
  process.exit(1);
}

const requiredWiring = [
  { file: "login-form.tsx", needles: ["validateLoginForm", "emailError", "passwordError", "aria-describedby"] },
  { file: "forgot-password/page.tsx", needles: ["validateLoginEmail", "validateResetToken", "validatePassword", "aria-describedby"] },
];

for (const check of requiredWiring) {
  const source = check.file.includes("forgot") ? forgotPasswordSource : loginFormSource;
  const missing = check.needles.filter((needle) => !source.includes(needle));
  if (missing.length) {
    console.error(`Admin auth validation test failed in ${check.file}. Missing:`, missing.join(", "));
    process.exit(1);
  }
}

console.log("Admin auth validation test passed.");
