import { describe, expect, test } from "bun:test";
import { connectionEnvKey, connectionEnvSegment } from "./env.ts";
import { isValidKebabCase } from "./config.ts";

describe("connection env keys", () => {
  test("maps kebab-case to UPPER_SNAKE segment", () => {
    expect(connectionEnvSegment("my-connection")).toBe("MY_CONNECTION");
  });

  test("builds SURREAL_<CONNECTION>_<KEY>", () => {
    expect(connectionEnvKey("my-connection", "USERNAME")).toBe(
      "SURREAL_MY_CONNECTION_USERNAME",
    );
    expect(connectionEnvKey("my-connection", "password")).toBe(
      "SURREAL_MY_CONNECTION_PASSWORD",
    );
  });
});

describe("kebab-case validation", () => {
  test("accepts valid names", () => {
    expect(isValidKebabCase("local")).toBe(true);
    expect(isValidKebabCase("my-connection")).toBe(true);
  });

  test("rejects invalid names", () => {
    expect(isValidKebabCase("MyConnection")).toBe(false);
    expect(isValidKebabCase("-bad")).toBe(false);
    expect(isValidKebabCase("bad-")).toBe(false);
  });
});
