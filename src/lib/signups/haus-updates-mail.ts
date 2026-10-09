// Provider plug-in.
// Replace this function when an email service is chosen.
// Name that service on the Privacy page before the first send.
// This function does not contact any provider. Nothing is sent.

export type HausUpdateDelivery = {
  email: string;
  confirmUrl: string;
};

export async function deliverHausUpdateConfirmation(
  _delivery: HausUpdateDelivery,
): Promise<{ attempted: false }> {
  return { attempted: false };
}
