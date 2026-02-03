import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import IntegrationWidget from "@/components/onboarding/IntegrationWidget";

// Mock framer-motion to avoid animation issues in tests
jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

describe("IntegrationWidget", () => {
  it("renders waiting state when not connected (9.4)", () => {
    render(<IntegrationWidget connected={false} />);

    expect(screen.getByText("Waiting for first event...")).toBeInTheDocument();
    expect(
      screen.getByText("Run your app with the SDK installed to see data appear here.")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Waiting for connection")).toBeInTheDocument();
  });

  it("renders connected state when connected", () => {
    render(<IntegrationWidget connected={true} />);

    expect(screen.getByText("Connection verified")).toBeInTheDocument();
    expect(
      screen.getByText("Your app is sending telemetry data.")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Connected")).toBeInTheDocument();
  });

  it("does not show connected text when waiting", () => {
    render(<IntegrationWidget connected={false} />);

    expect(screen.queryByText("Connection verified")).not.toBeInTheDocument();
  });

  it("does not show waiting text when connected", () => {
    render(<IntegrationWidget connected={true} />);

    expect(
      screen.queryByText("Waiting for first event...")
    ).not.toBeInTheDocument();
  });
});
