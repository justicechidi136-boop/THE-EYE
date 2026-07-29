import { redirect } from "next/navigation";

export default function LegacyRedirect() {
  redirect("/devices/smart-watches/firmware");
}
