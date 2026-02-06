import type { Metadata } from "next";
import RegisterForm from "./RegisterForm";

export const metadata: Metadata = {
  title: "Sign Up",
};

export default function RegisterPage() {
  return <RegisterForm />;
}
