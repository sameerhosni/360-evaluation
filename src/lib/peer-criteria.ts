// Cross-Functional peer-rating criteria — T2 deck page 5.
// Shared between the peer-feedback server component and the PeerRatingCard client component.

export type PeerCriterion = { key: string; label: string; max: number; helper: string };

export const PEER_CRITERIA: PeerCriterion[] = [
  { key: "team_spirit",        label: "Team Spirit",                     max: 8, helper: "Lifted the group, not just themselves" },
  { key: "responsiveness",     label: "Responsiveness",                  max: 8, helper: "Engaged quickly when needed" },
  { key: "professionalism",    label: "Professionalism Under Pressure",  max: 7, helper: "Composed in difficult moments" },
  { key: "cross_dept_support", label: "Cross-Departmental Support",      max: 7, helper: "Willing to help outside their lane" },
];
