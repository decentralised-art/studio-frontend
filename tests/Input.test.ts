// tests/Input.test.ts
import "@testing-library/jest-dom/vitest";
import { fireEvent, render } from "@testing-library/svelte";
import Input from "../src/lib/components/ui/Input.svelte";

describe("Input component", () => {
  it("renders label and help text", () => {
    const { getByText } = render(Input, {
      props: {
        label: "Track Name",
        help: "This will be visible to others",
      },
    });

    expect(getByText("Track Name")).toBeInTheDocument();
    expect(getByText("This will be visible to others")).toBeInTheDocument();
  });

  it("updates value when user types", async () => {
    const { getByRole } = render(Input, {
      props: { value: "" },
    });

    const input = getByRole("textbox") as HTMLInputElement;
    await fireEvent.input(input, { target: { value: "example.wav" } });

    expect(input.value).toBe("example.wav");
  });
});
