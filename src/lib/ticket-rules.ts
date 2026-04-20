/** Whether a dinner allows guest (+1) ticket purchases. */
export function allowsGuestTicket(dinner: { guests_allowed: boolean }): boolean {
  return dinner.guests_allowed;
}
