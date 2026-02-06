import type { Metadata } from "next";
import VerifyForm from "./VerifyForm";

export const metadata: Metadata = {
  title: "Verify Email",
};

export default function VerifyPage() {
  return <VerifyForm />;
}
