import type { Metadata } from "next";
import InviteForm from "./InviteForm";

export const metadata: Metadata = {
  title: "Accept Invitation",
};

export default function InvitePage() {
  return <InviteForm />;
}
