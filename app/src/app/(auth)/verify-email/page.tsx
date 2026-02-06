import type { Metadata } from "next";
import VerifyEmailForm from "./VerifyEmailForm";

export const metadata: Metadata = {
  title: "Check Email",
};

export default function VerifyEmailPage() {
  return <VerifyEmailForm />;
}
