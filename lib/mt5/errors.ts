export class Mt5GatewayError extends Error {
  code: "invalid_credentials" | "unavailable" | "rejected";

  constructor(
    message: string,
    code: "invalid_credentials" | "unavailable" | "rejected" = "unavailable"
  ) {
    super(message);
    this.name = "Mt5GatewayError";
    this.code = code;
  }
}
