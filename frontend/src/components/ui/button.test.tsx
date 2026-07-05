import { render, screen } from "@testing-library/react";
import { Button } from "./button";

describe("Button", () => {
  it("renders children as a button", () => {
    render(<Button>저장</Button>);
    expect(screen.getByRole("button", { name: "저장" })).toBeInTheDocument();
  });

  it("can be disabled", () => {
    render(<Button disabled>저장</Button>);
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
  });
});
