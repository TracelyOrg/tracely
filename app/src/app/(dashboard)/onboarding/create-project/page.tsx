import type { Metadata } from "next";
import CreateProjectForm from "./CreateProjectForm";

export const metadata: Metadata = {
  title: "Create Project",
};

export default function CreateProjectPage() {
  return <CreateProjectForm />;
}
