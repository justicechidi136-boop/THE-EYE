import { redirect } from "next/navigation";

export default function LegacySmartwatchRedirect() {
  redirect("/devices/smart-watches");
}
