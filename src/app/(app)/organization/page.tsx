import { redirect } from "next/navigation";

export default function OrgIndex() {
  redirect("/organization/branches");
}
