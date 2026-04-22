/**
 * Thin design-system wrapper around src/components/member-avatar.tsx.
 *
 * Re-exports the existing MemberAvatar (used in 7+ places) without replacing it.
 * Use this import for new code; existing call sites keep working as-is.
 */
export { default as Avatar } from "@/components/member-avatar";
