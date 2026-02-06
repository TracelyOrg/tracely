import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Log In",
};

export default function LoginPage() {
  return <LoginForm />;
}
