import type { Metadata } from "next";
import CreateOrgForm from "./CreateOrgForm";

export const metadata: Metadata = {
  title: "Create Organization",
};

export default function CreateOrgPage() {
  return <CreateOrgForm />;
}
